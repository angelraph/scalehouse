// Moves the testnet agent to its Circle wallet: funds gas from the old agent key, then the owner
// appoints the new agent on every testnet house it owns.   node scripts/switch-testnet-agent.mjs <newAgent>
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const [newAgent] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync("../.keys/testnet.env", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")));
const abiSrc = readFileSync("lib/abi.ts", "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const ST = "0x321322aC12e419111E27781c5B2618fCB97AC7b7";
const chain = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } });
const pub = createPublicClient({ chain, transport: http() });
const oldAgent = createWalletClient({ account: privateKeyToAccount(env.AGENT_KEY), chain, transport: http() });
const owner = createWalletClient({ account: privateKeyToAccount(env.OWNER_KEY), chain, transport: http() });
const bal = await pub.getBalance({ address: newAgent });
if (bal < parseEther("1")) {
  const h = await oldAgent.sendTransaction({ to: newAgent, value: parseEther("2") });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log("funded 2 USDC gas", h);
}
const n = await pub.readContract({ address: ST, abi, functionName: "houseCount" });
for (let i = 1n; i <= n; i++) {
  const h = await pub.readContract({ address: ST, abi, functionName: "houses", args: [i] });
  if (h[0].toLowerCase() !== owner.account.address.toLowerCase()) { console.log(`house ${i}: not ours, skip`); continue; }
  if (h[2].toLowerCase() === newAgent.toLowerCase()) { console.log(`house ${i}: already`); continue; }
  const tx = await owner.writeContract({ address: ST, abi, functionName: "setAgent", args: [i, newAgent] });
  const r = await pub.waitForTransactionReceipt({ hash: tx });
  console.log(`house ${i}: setAgent ${r.status}`, tx);
}
