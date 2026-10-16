import "server-only";
import type { Hex } from "viem";
import { readHouse, readRoles, readTicket } from "./chain";
import { circle } from "./circle";
import { createConfirmer, confirmersOf, type Confirmer } from "./confirmers";
import { sql } from "./db";
import { grossOf, money } from "./format";
import { CHAIN_ID } from "./network";
import { relayConfirm } from "./relay";
import { screen } from "./agent/screening";
import { confirmTypedData } from "./typed";

/**
 * Auto-approve: the owner's rule "payments up to X don't need a person to confirm". A dedicated
 * Circle wallet (the house's checker) holds the confirmer role and confirms a ticket only when:
 * it is under the limit, and the payee passes screening. Everything else waits for a person.
 * The contract still enforces payee lock, exact amount, pays-once and the daily budget.
 */
export const CHECKER_NAME = "Auto-approve checker";

let ready = false;
async function ensureTable() {
  if (ready) return;
  await sql()`
    create table if not exists sh_policies (
      chain_id   integer not null,
      house_id   integer not null,
      auto_limit text not null,
      updated_at timestamptz not null default now(),
      primary key (chain_id, house_id)
    )`;
  ready = true;
}

async function autoLimitRow(houseId: number): Promise<bigint | null> {
  await ensureTable();
  const rows = (await sql()`select auto_limit from sh_policies where chain_id = ${CHAIN_ID} and house_id = ${houseId}`) as { auto_limit: string }[];
  return rows[0] ? BigInt(rows[0].auto_limit) : null;
}

/** The house's auto-approve limit: the owner's saved rule, else (once the checker holds its role) the per-payment maximum. */
export async function autoLimit(houseId: number): Promise<bigint> {
  const saved = await autoLimitRow(houseId);
  if (saved != null) return saved;
  const checker = await checkerOf(houseId);
  if (!checker || ((await readRoles(houseId, checker.address)) & 2) === 0) return 0n;
  return (await readHouse(houseId))?.maxTicket ?? 0n;
}

export async function setAutoLimit(houseId: number, limit: bigint) {
  await ensureTable();
  await sql()`
    insert into sh_policies (chain_id, house_id, auto_limit) values (${CHAIN_ID}, ${houseId}, ${limit.toString()})
    on conflict (chain_id, house_id) do update set auto_limit = excluded.auto_limit, updated_at = now()`;
}

export async function checkerOf(houseId: number, create = false): Promise<Confirmer | null> {
  const found = (await confirmersOf(houseId)).find((c) => c.name === CHECKER_NAME);
  if (found || !create) return found ?? null;
  return createConfirmer(houseId, CHECKER_NAME);
}

export type AutoResult = { approved: true; txHash: Hex } | { approved: false; reason: string };

/** Confirms a ticket with the house's checker if the owner's rule allows it. */
export async function tryAutoApprove(ticketId: number): Promise<AutoResult> {
  const ticket = await readTicket(ticketId);
  if (!ticket) return { approved: false, reason: "Unknown ticket" };
  if (ticket.status !== "Open") return { approved: false, reason: `Ticket is already ${ticket.status.toLowerCase()}` };
  const house = await readHouse(ticket.houseId);
  if (!house) return { approved: false, reason: "Unknown house" };

  const saved = await autoLimitRow(house.id);
  const limit = saved ?? house.maxTicket;
  const amount = grossOf(ticket.quantity, ticket.unitPrice);
  if (limit === 0n) return { approved: false, reason: "Auto-approve is off. Your confirmer needs to confirm it." };
  if (amount > limit) return { approved: false, reason: `${money(amount)} is above your auto-approve limit of ${money(limit)}, so your confirmer needs to confirm it.` };

  const checker = await checkerOf(house.id);
  if (!checker || ((await readRoles(house.id, checker.address)) & 2) === 0) return { approved: false, reason: "Auto-approve isn't switched on for this house yet." };

  const s = await screen(house, ticket.payee, true);
  if (s.risk !== "clear") return { approved: false, reason: `The payee's screening came back ${s.risk}, so a person needs to confirm it.` };

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const typed = confirmTypedData({ ticketId: BigInt(ticketId), observedQuantity: ticket.quantity, payee: ticket.payee, evidenceHash: ticket.evidenceHash, deadline });
  const data = JSON.stringify(
    {
      ...typed,
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        ...typed.types,
      },
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
  );
  const signed = await circle().signTypedData({ walletId: checker.walletId, data });
  const signature = signed.data?.signature as Hex | undefined;
  if (!signature) return { approved: false, reason: "Circle didn't return a signature" };
  const r = await relayConfirm({ ticketId, observed: ticket.quantity, witness: checker.address, deadline, signature });
  return { approved: true, txHash: r.txHash };
}
