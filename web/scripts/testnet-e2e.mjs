// End-to-end check of ScaleTicket on Arc TESTNET with real transactions and separate wallets
// for owner, clerk, witness and agent. Exercises the clean path and every refusal.
// Not traction: it uses throwaway testnet wallets from ../.keys/testnet.env.
//
//   node scripts/testnet-e2e.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodePacked,
  http,
  keccak256,
  parseEventLogs,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(process.env.KEYS_FILE ?? path.join(here, "../../.keys/testnet.env"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.split("=")),
);
const abiSrc = readFileSync(process.env.ABI_FILE ?? path.join(here, "../lib/abi.ts"), "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));

const ST = process.env.ST ?? "0x321322aC12e419111E27781c5B2618fCB97AC7b7";
const USDC = "0x3600000000000000000000000000000000000000";
const chain = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
});
const pub = createPublicClient({ chain, transport: http() });
const wallet = (k) => createWalletClient({ account: privateKeyToAccount(k), chain, transport: http() });
const owner = wallet(env.OWNER_KEY);
const clerk = wallet(env.CLERK_KEY);
const agent = wallet(env.AGENT_KEY);
const witnessAcct = privateKeyToAccount(env.WITNESS_KEY);
const supplier = env.SUPPLIER_ADDRESS;

const REASON = ["None","NotConfirmed","AlreadyPaid","TicketFrozen","TicketVoided","Paused","OverTicketCap","OverPayeeCap","OverDailyCap","InsufficientFloat","QuantityMismatch","AmountMismatch","PayeeMismatch"];
const erc20 = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
];

async function tx(w, functionName, args, address = ST, theAbi = abi) {
  const hash = await w.writeContract({ address, abi: theAbi, functionName, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted: ${hash}`);
  return r;
}
const events = (r) => parseEventLogs({ abi, logs: r.logs });
const outcome = (r) =>
  events(r)
    .filter((e) => ["TicketReleased", "ReleaseRefused", "TicketFrozen", "TicketConfirmed"].includes(e.eventName))
    .map((e) => (e.args.reason !== undefined ? `${e.eventName}(${REASON[e.args.reason]})` : e.eventName))
    .join(", ");

const usdc = (v) => parseUnits(v, 6);
const evidence = (ref) => keccak256(encodePacked(["address", "string"], [supplier, ref.toLowerCase()]));
const run = `${Date.now()}`;

async function cut(houseId, rateId, qty, ref) {
  const r = await tx(clerk, "cut", [houseId, supplier, rateId, qty, evidence(ref)]);
  return events(r).find((e) => e.eventName === "TicketCut").args.ticketId;
}

async function witness(ticketId, observed) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const t = await pub.readContract({ address: ST, abi, functionName: "tickets", args: [ticketId] });
  const signature = await witnessAcct.signTypedData({
    domain: { name: "ScaleTicket", version: "1", chainId: chain.id, verifyingContract: ST },
    types: { Confirm: [{ name: "ticketId", type: "uint256" }, { name: "observedQuantity", type: "uint64" }, { name: "payee", type: "address" }, { name: "evidenceHash", type: "bytes32" }, { name: "deadline", type: "uint256" }] },
    primaryType: "Confirm",
    message: { ticketId, observedQuantity: observed, payee: t[2], evidenceHash: t[5], deadline },
  });
  // The agent relays the witness's signature, so the witness never needs gas.
  return tx(agent, "confirmBySig", [ticketId, observed, witnessAcct.address, deadline, signature]);
}

const results = [];
const check = (name, got, want) => {
  const ok = got.includes(want);
  results.push({ name, ok, got });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${got}`);
};

console.log("Setting up a testnet house…");
const created = await tx(owner, "createHouse", [USDC, `Scalehouse e2e ${run} (testnet)`, usdc("5"), usdc("10"), 500]);
const houseId = events(created).find((e) => e.eventName === "HouseCreated").args.houseId;
await tx(owner, "setAgent", [houseId, agent.account.address]);
await tx(owner, "setRoles", [houseId, clerk.account.address, 1]);
await tx(owner, "setRoles", [houseId, witnessAcct.address, 2]);
const rateId = keccak256(encodePacked(["string"], ["test item"]));
await tx(owner, "setRate", [houseId, rateId, usdc("0.25"), BigInt(Math.floor(Date.now() / 1000) + 86400), true, "Test item"]);
await tx(owner, "approve", [ST, usdc("10")], USDC, erc20);
console.log(`House #${houseId} ready.\n`);

const before = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [supplier] });

// 1. Clean ticket: 4 units × 0.25 = 1.00 USDC
const t1 = await cut(houseId, rateId, 4000n, `E2E-${run}-1`);
check("witness confirms matching count", outcome(await witness(t1, 4000n)), "TicketConfirmed");
check("clean release pays", outcome(await tx(agent, "release", [t1, supplier, usdc("1"), keccak256("0x01")])), "TicketReleased");

// 2. Same ticket again
check("second release is refused", outcome(await tx(agent, "release", [t1, supplier, usdc("1"), keccak256("0x02")])), "ReleaseRefused(AlreadyPaid)");

// 3. Agent names a different wallet
const t2 = await cut(houseId, rateId, 4000n, `E2E-${run}-2`);
await witness(t2, 4000n);
check("wrong payee freezes", outcome(await tx(agent, "release", [t2, agent.account.address, usdc("1"), keccak256("0x03")])), "TicketFrozen(PayeeMismatch)");

// 4. Agent names a different amount
const t3 = await cut(houseId, rateId, 4000n, `E2E-${run}-3`);
await witness(t3, 4000n);
check("wrong amount freezes", outcome(await tx(agent, "release", [t3, supplier, usdc("1.5"), keccak256("0x04")])), "TicketFrozen(AmountMismatch)");

// 5. Witness counts 3.5 against a claimed 4 (12.5% off, tolerance 5%)
const t4 = await cut(houseId, rateId, 4000n, `E2E-${run}-4`);
check("short count freezes", outcome(await witness(t4, 3500n)), "TicketFrozen(QuantityMismatch)");

// 6. Same invoice reference twice
try {
  await pub.simulateContract({ account: clerk.account, address: ST, abi, functionName: "cut", args: [houseId, supplier, rateId, 1000n, evidence(`E2E-${run}-1`)] });
  check("duplicate invoice rejected", "was accepted", "DuplicateEvidence");
} catch (e) {
  const reverted = e.walk?.((x) => x.data?.errorName);
  check("duplicate invoice rejected", reverted?.data?.errorName ?? e.shortMessage, "DuplicateEvidence");
}

const after = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [supplier] });
check("supplier received exactly 1.00 USDC", String(after - before), "1000000");

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed on house #${houseId}, contract ${ST}`);
process.exit(failed ? 1 : 0);
