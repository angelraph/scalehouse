// End-to-end: a brand-new owner on Arc TESTNET, exactly as the app does it, with ONE wallet.
// Open a house (prepare checker + the 5 setup calls) -> "Pay someone" (price for the amount +
// cut) -> auto-approve -> agent pays. Prints how long the payment took.
//   node scripts/e2e-new-owner.mjs
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, encodePacked, http, keccak256, parseEventLogs, parseUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const SITE = "https://scalehouse-testnet.vercel.app";
const env = Object.fromEntries(readFileSync("../.keys/testnet.env", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")));
const abiSrc = readFileSync("lib/abi.ts", "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const ST = "0x321322aC12e419111E27781c5B2618fCB97AC7b7";
const USDC = "0x3600000000000000000000000000000000000000";
const AGENT = "0xc4DE96eac3593fAcc6da55d7A2E2fEcC4A43Ebcf";
const chain = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } });
const pub = createPublicClient({ chain, transport: http() });
const me = createWalletClient({ account: privateKeyToAccount(env.OWNER_KEY), chain, transport: http() });
const erc20 = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] }];
const u = (v) => parseUnits(v, 6);
const tx = async (functionName, args, address = ST, theAbi = abi) => {
  const h = await me.writeContract({ address, abi: theAbi, functionName, args });
  const r = await pub.waitForTransactionReceipt({ hash: h });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
  return r;
};
const post = async (path, body) => {
  const r = await fetch(SITE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${j.error}`);
  return j;
};

// Open a house
const houseId = (await pub.readContract({ address: ST, abi, functionName: "houseCount" })) + 1n;
const prep = await post("/api/auto-approve", { action: "prepare", houseId: houseId.toString() });
await tx("createHouse", [USDC, "E2E Corner Shop (testnet)", u("0.5"), u("2"), 200]);
await tx("setAgent", [houseId, AGENT]);
await tx("setRoles", [houseId, me.account.address, 1]);
await tx("setRoles", [houseId, prep.checker, 2]);
await tx("approve", [ST, u("2")], USDC, erc20);
console.log("1. house", houseId.toString(), "opened; checker", prep.checker);

// Pay someone: 0.02 USDC
const started = Date.now();
const payee = privateKeyToAccount(generatePrivateKey()).address;
const label = "Payment of 0.02 USDC";
const rateId = keccak256(encodePacked(["string"], [label.toLowerCase()]));
await tx("setRate", [houseId, rateId, u("0.02"), BigInt(Math.floor(Date.now() / 1000) + 365 * 86400), true, label]);
const form = new FormData();
form.set("houseId", houseId.toString());
form.set("payee", payee);
form.set("issuer", me.account.address);
form.set("reference", `Logo tweak · ${new Date().toISOString().slice(0, 16)}`);
form.set("note", "Logo tweak");
const ev = await (await fetch(SITE + "/api/evidence", { method: "POST", body: form })).json();
if (!ev.evidenceHash) throw new Error("evidence: " + ev.error);
const cutR = await tx("cut", [houseId, payee, rateId, 1000n, ev.evidenceHash]);
const id = parseEventLogs({ abi, logs: cutR.logs, eventName: "TicketCut" })[0].args.ticketId;
const a = await post("/api/auto-approve", { ticketId: Number(id) });
console.log("2. ticket", id.toString(), "auto-approve:", a.approved ? "yes" : a.reason);

const S = ["None", "Open", "Confirmed", "Paid", "Frozen", "Voided"];
for (let i = 0; i < 40; i++) {
  const t = await pub.readContract({ address: ST, abi, functionName: "tickets", args: [id] });
  const status = S[Number(t[t.length - 1])];
  if (status === "Paid" || status === "Frozen") {
    console.log("3.", status, `${Math.round((Date.now() - started) / 1000)}s after tapping Pay`, `${SITE}/t/${id}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 3000));
}
console.log("3. not paid within 120s");
