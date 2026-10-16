// End-to-end test of confirm-by-link on Arc TESTNET against the live testnet site:
// owner adds a confirmer (Circle wallet) -> owner grants the witness role -> clerk records a
// payment -> the confirmer's link page lists it -> tap Confirm (no wallet) -> agent pays.
//   node scripts/e2e-link-confirm.mjs [houseId]
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

// 1. Owner adds a confirmer.
const at = Math.floor(Date.now() / 1000);
const msg = `Scalehouse: add link confirmers for house #${HOUSE} on chain 5042002.\nTime: ${at}`;
const added = await post("/api/confirmers", { houseId: Number(HOUSE), action: "add", at, name: "E2E Ada", signature: await owner.signMessage({ message: msg }) });
console.log("1. confirmer", added.name, added.address);
await tx(owner, "setRoles", [HOUSE, added.address, 2]);
console.log("   witness role granted");

// 2. Clerk records a payment to a fresh wallet.
const payee = privateKeyToAccount(generatePrivateKey()).address;
const reference = `e2e-link-${Date.now().toString(36)}`;
const form = new FormData();
form.set("houseId", String(HOUSE));
form.set("payee", payee);
form.set("issuer", clerk.account.address);
form.set("reference", reference);
form.set("note", "E2E confirm-by-link test");
const evRes = await fetch(SITE + "/api/evidence", { method: "POST", body: form });
const ev = await evRes.json();
if (!evRes.ok) throw new Error("evidence: " + ev.error);
const cutR = await tx(clerk, "cut", [HOUSE, payee, keccak256(encodePacked(["string"], ["bread, 1 loaf"])), 1000n, ev.evidenceHash]);
const id = parseEventLogs({ abi, logs: cutR.logs, eventName: "TicketCut" })[0].args.ticketId;
console.log("2. ticket", id.toString(), "to", payee);

// 3. The link page lists it.
const token = added.link.split("/c/")[1];
const page = await (await fetch(`${SITE}/c/${token}`)).text();
console.log("3. link page lists it:", page.includes(`#${id}`) || page.includes(`>${id}<`) ? "yes" : "NO");

// 4. Confirm with no wallet.
const c = await post("/api/confirmers/confirm", { token, ticketId: Number(id), observedQuantity: "1000" });
console.log("4. confirmed:", c.result, c.txHash);

// 5. Wait for the agent to pay.
const S = ["None", "Open", "Confirmed", "Paid", "Frozen", "Voided"];
for (let i = 0; i < 30; i++) {
  const t = await pub.readContract({ address: ST, abi, functionName: "tickets", args: [id] });
  const status = S[Number(Array.isArray(t) ? t[t.length - 1] : t.status)];
  if (status === "Paid" || status === "Frozen") {
    console.log("5. ticket", status, `${SITE}/t/${id}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("5. not paid within 150s");
