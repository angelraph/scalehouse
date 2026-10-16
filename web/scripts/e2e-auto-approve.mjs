// End-to-end test of auto-approve on Arc TESTNET against the live testnet site:
// owner sets a limit (checker Circle wallet is created) -> owner grants it the confirmer role ->
// clerk records a payment under the limit -> auto-approve -> agent pays. No second person.
//   node scripts/e2e-auto-approve.mjs [houseId]
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, encodePacked, http, keccak256, parseEventLogs } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const SITE = "https://scalehouse-testnet.vercel.app";
const HOUSE = BigInt(process.argv[2] ?? "3");
const env = Object.fromEntries(readFileSync("../.keys/testnet.env", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")));
const abiSrc = readFileSync("lib/abi.ts", "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const ST = "0x321322aC12e419111E27781c5B2618fCB97AC7b7";
const chain = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } });
const pub = createPublicClient({ chain, transport: http() });
const owner = createWalletClient({ account: privateKeyToAccount(env.OWNER_KEY), chain, transport: http() });
const clerk = createWalletClient({ account: privateKeyToAccount(env.CLERK_KEY), chain, transport: http() });
const post = async (path, body) => {
  const r = await fetch(SITE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${j.error}`);
  return j;
};
const tx = async (w, functionName, args) => {
  const h = await w.writeContract({ address: ST, abi, functionName, args });
  const r = await pub.waitForTransactionReceipt({ hash: h });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
  return r;
};

const at = Math.floor(Date.now() / 1000);
const msg = `Scalehouse: auto-approve link confirmers for house #${HOUSE} on chain 5042002.\nTime: ${at}`;
const set = await post("/api/auto-approve", { houseId: Number(HOUSE), action: "set", limit: "0.05", at, signature: await owner.signMessage({ message: msg }) });
console.log("1. limit", set.label, "checker", set.checker);
const roles = Number(await pub.readContract({ address: ST, abi, functionName: "roles", args: [HOUSE, set.checker] }));
if ((roles & 2) === 0) await tx(owner, "setRoles", [HOUSE, set.checker, 2]);
console.log("   checker has the confirmer role");

const payee = privateKeyToAccount(generatePrivateKey()).address;
const form = new FormData();
form.set("houseId", String(HOUSE));
form.set("payee", payee);
form.set("issuer", clerk.account.address);
form.set("reference", `e2e-auto-${Date.now().toString(36)}`);
form.set("note", "E2E auto-approve test");
const evRes = await fetch(SITE + "/api/evidence", { method: "POST", body: form });
const ev = await evRes.json();
if (!evRes.ok) throw new Error("evidence: " + ev.error);
const started = Date.now();
const cutR = await tx(clerk, "cut", [HOUSE, payee, keccak256(encodePacked(["string"], ["bread, 1 loaf"])), 1000n, ev.evidenceHash]);
const id = parseEventLogs({ abi, logs: cutR.logs, eventName: "TicketCut" })[0].args.ticketId;
console.log("2. ticket", id.toString(), "to", payee);

const a = await post("/api/auto-approve", { ticketId: Number(id) });
console.log("3. auto-approve:", JSON.stringify(a));

const S = ["None", "Open", "Confirmed", "Paid", "Frozen", "Voided"];
for (let i = 0; i < 40; i++) {
  const t = await pub.readContract({ address: ST, abi, functionName: "tickets", args: [id] });
  const status = S[Number(t[t.length - 1])];
  if (status === "Paid" || status === "Frozen") {
    console.log("4. ticket", status, `in ${Math.round((Date.now() - started) / 1000)}s from recording`, `${SITE}/t/${id}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 3000));
}
console.log("4. not paid within 120s");
