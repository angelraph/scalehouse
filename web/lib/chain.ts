import "server-only";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { scaleTicketAbi } from "./abi";
import { chain, scaleTicketAddress } from "./network";
import { STATUS, type House, type Rate, type Ticket } from "./types";

export const rpcUrl = process.env.ARC_RPC_URL || chain.rpcUrls.default.http[0];

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { batch: true, retryCount: 3 }) });

const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isBlacklisted", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

const st = { address: scaleTicketAddress, abi: scaleTicketAbi } as const;

type HouseTuple = readonly [Address, Address, Address, Address, bigint, bigint, number, number, Address, boolean];
type TicketTuple = readonly [bigint, Address, Address, Address, Hex, Hex, bigint, bigint, bigint, bigint, bigint, number];

const toHouse = (id: number, h: HouseTuple): House => ({
  id,
  owner: h[0],
  pendingOwner: h[1],
  agent: h[2],
  token: h[3],
  maxTicket: h[4],
  dailyCap: h[5],
  quantityToleranceBps: h[6],
  levyBps: h[7],
  levyRecipient: h[8],
  paused: h[9],
});

const toTicket = (id: number, t: TicketTuple): Ticket => ({
  id,
  houseId: Number(t[0]),
  issuer: t[1],
  payee: t[2],
  witness: t[3],
  rateId: t[4],
  evidenceHash: t[5],
  unitPrice: t[6],
  quantity: t[7],
  confirmedQuantity: t[8],
  cutAt: Number(t[9]),
  settledAt: Number(t[10]),
  status: STATUS[t[11]] ?? "None",
});

export async function counts() {
  const [houseCount, ticketCount] = await Promise.all([
    publicClient.readContract({ ...st, functionName: "houseCount" }),
    publicClient.readContract({ ...st, functionName: "ticketCount" }),
  ]);
  return { houseCount: Number(houseCount), ticketCount: Number(ticketCount) };
}

export async function readHouse(id: number): Promise<House | null> {
  const h = (await publicClient.readContract({ ...st, functionName: "houses", args: [BigInt(id)] })) as HouseTuple;
  if (h[0] === "0x0000000000000000000000000000000000000000") return null;
  return toHouse(id, h);
}

export async function readHouses(ids: number[]): Promise<House[]> {
  if (!ids.length) return [];
  const res = await publicClient.multicall({
    contracts: ids.map((id) => ({ ...st, functionName: "houses" as const, args: [BigInt(id)] as const })),
    allowFailure: false,
  });
  return res.map((h, i) => toHouse(ids[i], h as HouseTuple));
}

export async function readTicket(id: number): Promise<Ticket | null> {
  const t = (await publicClient.readContract({ ...st, functionName: "tickets", args: [BigInt(id)] })) as TicketTuple;
  if (t[11] === 0) return null;
  return toTicket(id, t);
}

export async function readTickets(ids: number[]): Promise<Ticket[]> {
  if (!ids.length) return [];
  const out: Ticket[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const res = await publicClient.multicall({
      contracts: slice.map((id) => ({ ...st, functionName: "tickets" as const, args: [BigInt(id)] as const })),
      allowFailure: false,
    });
    res.forEach((t, j) => out.push(toTicket(slice[j], t as TicketTuple)));
  }
  return out;
}

/** Every ticket ever cut, newest first. State is read straight from the contract. */
export async function allTickets(): Promise<Ticket[]> {
  const { ticketCount } = await counts();
  const ids = Array.from({ length: ticketCount }, (_, i) => ticketCount - i);
  return readTickets(ids);
}

export async function readRate(houseId: number, rateId: Hex): Promise<Rate> {
  const r = (await publicClient.readContract({ ...st, functionName: "rates", args: [BigInt(houseId), rateId] })) as readonly [bigint, bigint, boolean];
  return { unitPrice: r[0], validUntil: Number(r[1]), active: r[2] };
}

export async function readRoles(houseId: number, who: Address): Promise<number> {
  return Number(await publicClient.readContract({ ...st, functionName: "roles", args: [BigInt(houseId), who] }));
}

export async function housePosition(house: House) {
  const [balance, allowance, spentToday] = await Promise.all([
    publicClient.readContract({ address: house.token, abi: erc20Abi, functionName: "balanceOf", args: [house.owner] }),
    publicClient.readContract({ address: house.token, abi: erc20Abi, functionName: "allowance", args: [house.owner, scaleTicketAddress] }),
    publicClient.readContract({ ...st, functionName: "spentToday", args: [BigInt(house.id)] }),
  ]);
  const spendable = [balance, allowance, house.dailyCap - spentToday].reduce((a, b) => (b < a ? b : a));
  return { balance, allowance, spentToday, spendable: spendable < 0n ? 0n : spendable };
}

export async function effectivePayeeCap(houseId: number, payee: Address): Promise<bigint> {
  return (await publicClient.readContract({ ...st, functionName: "effectivePayeeCap", args: [BigInt(houseId), payee] })) as bigint;
}

/** Circle's USDC blocklist, read live from the token contract on Arc. */
export async function isUsdcBlocklisted(token: Address, who: Address): Promise<boolean> {
  return publicClient.readContract({ address: token, abi: erc20Abi, functionName: "isBlacklisted", args: [who] });
}

export { erc20Abi };
