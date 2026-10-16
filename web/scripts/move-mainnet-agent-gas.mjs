import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const to = process.argv[2];
const env = Object.fromEntries(readFileSync("C:/Users/Admin/Desktop/scalehouse/.keys/mainnet.env", "utf8").split(/\r?\n/).filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const chain = defineChain({ id: 5042, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } } });
const pub = createPublicClient({ chain, transport: http() });
const w = createWalletClient({ account: privateKeyToAccount(env.AGENT_PRIVATE_KEY), chain, transport: http() });
const bal = await pub.getBalance({ address: w.account.address });
console.log("old agent", formatEther(bal));
const value = bal - parseEther("0.03");
const h = await w.sendTransaction({ to, value });
const r = await pub.waitForTransactionReceipt({ hash: h });
console.log("sent", formatEther(value), r.status, h, "new balance", formatEther(await pub.getBalance({ address: to })));
const abiSrc = readFileSync("lib/abi.ts", "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const ST = "0x8b5355CD5Ed88F6E70eA47C9dacC8bD2015A3BF7";
const n = await pub.readContract({ address: ST, abi, functionName: "houseCount" });
for (let i = 1n; i <= n; i++) { const x = await pub.readContract({ address: ST, abi, functionName: "houses", args: [i] }); console.log("house", i, "owner", x[0], "agent", x[2]); }
