// Runs one real ticket through the LIVE site's pipeline on Arc testnet: evidence upload,
// cut (clerk wallet), witness signature relayed by the site, then the agent decides.
//   node scripts/live-ticket.mjs <siteUrl> <houseId>
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, encodePacked, http, keccak256, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const [site = "https://scalehouse-app.vercel.app", houseArg = "2"] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(process.env.KEYS_FILE ?? "../.keys/testnet.env", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")));
const abiSrc = readFileSync("lib/abi.ts", "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const ST = "0x321322aC12e419111E27781c5B2618fCB97AC7b7";
const chain = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } });
const pub = createPublicClient({ chain, transport: http() });
const clerk = createWalletClient({ account: privateKeyToAccount(env.CLERK_KEY), chain, transport: http() });
const witness = privateKeyToAccount(env.WITNESS_KEY);
const houseId = BigInt(houseArg);
const payee = env.SUPPLIER_ADDRESS;
const rateId = keccak256(encodePacked(["string"], ["test item"]));
const reference = `LIVE-${Date.now()}`;

const form = new FormData();
form.set("houseId", houseArg);
form.set("payee", payee);
form.set("issuer", clerk.account.address);
form.set("reference", reference);
form.set("note", "Pipeline check on testnet: 2 test items.");
const ev = await fetch(`${site}/api/evidence`, { method: "POST", body: form }).then((r) => r.json());
console.log("evidence:", ev.evidenceHash ?? ev);

const hash = await clerk.writeContract({ address: ST, abi, functionName: "cut", args: [houseId, payee, rateId, 2000n, ev.evidenceHash] });
const r = await pub.waitForTransactionReceipt({ hash });
const ticketId = parseEventLogs({ abi, logs: r.logs, eventName: "TicketCut" })[0].args.ticketId;
console.log("cut ticket", ticketId.toString());

const t = await pub.readContract({ address: ST, abi, functionName: "tickets", args: [ticketId] });
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
const signature = await witness.signTypedData({
  domain: { name: "ScaleTicket", version: "1", chainId: chain.id, verifyingContract: ST },
  types: { Confirm: [{ name: "ticketId", type: "uint256" }, { name: "observedQuantity", type: "uint64" }, { name: "payee", type: "address" }, { name: "evidenceHash", type: "bytes32" }, { name: "deadline", type: "uint256" }] },
  primaryType: "Confirm",
  message: { ticketId, observedQuantity: 2000n, payee: t[2], evidenceHash: t[5], deadline },
});
const relay = await fetch(`${site}/api/relay/confirm`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ticketId: Number(ticketId), observedQuantity: "2000", witness: witness.address, deadline: deadline.toString(), signature }),
}).then((r) => r.json());
console.log("relay:", relay);
console.log(`ticket page: ${site}/t/${ticketId}`);
