// Creates (or finds) the agent's Circle Developer-Controlled Wallet on Arc testnet and lists the
// testnet houses with their owner and current agent.   node scripts/circle-agent-testnet.mjs
import { readFileSync } from "node:fs";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http } from "viem";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const circle = initiateDeveloperControlledWalletsClient({ apiKey: env.CIRCLE_API_KEY, entitySecret: env.CIRCLE_ENTITY_SECRET });
const name = "Scalehouse agent (testnet)";
let set = (await circle.listWalletSets({ pageSize: 50 })).data?.walletSets?.find((s) => s.name === name);
if (!set) set = (await circle.createWalletSet({ name })).data.walletSet;
try {
let wallet = (await circle.listWallets({ walletSetId: set.id, blockchain: "ARC-TESTNET" })).data?.wallets?.[0];
if (!wallet) wallet = (await circle.createWallets({ walletSetId: set.id, blockchains: ["ARC-TESTNET"], count: 1, accountType: "EOA" })).data.wallets[0];
console.log(`AGENT_CIRCLE_WALLET_ID=${wallet.id}\nCIRCLE_AGENT_ADDRESS=${wallet.address}`);
} catch (e) { console.log('CIRCLE ERROR', e.status, e.message, JSON.stringify(e.response?.data ?? e.data ?? null)); }

const abiSrc = readFileSync("lib/abi.ts", "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const pub = createPublicClient({ transport: http("https://rpc.testnet.arc.io") });
const ST = env.NEXT_PUBLIC_SCALETICKET_ADDRESS;
const n = await pub.readContract({ address: ST, abi, functionName: "houseCount" }).catch(() => null);
console.log("houses:", n);
for (let i = 1n; n && i <= n; i++) {
  const h = await pub.readContract({ address: ST, abi, functionName: "houses", args: [i] }).catch((e) => e.shortMessage);
  console.log(i, JSON.stringify(h, (_, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 220));
}
