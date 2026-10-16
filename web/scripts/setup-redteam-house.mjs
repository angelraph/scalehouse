// One-time: create the public "Red Team Kitchen" house on Arc TESTNET that /attack runs against.
// Uses the throwaway testnet keys in ../.keys/testnet.env. Prints the house id.
//   node scripts/setup-redteam-house.mjs
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, encodePacked, http, keccak256, parseEventLogs, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = Object.fromEntries(readFileSync(process.env.KEYS_FILE ?? "../.keys/testnet.env", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")));
const abiSrc = readFileSync("lib/abi.ts", "utf8");
const abi = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const ST = "0x321322aC12e419111E27781c5B2618fCB97AC7b7";
const USDC = "0x3600000000000000000000000000000000000000";
const chain = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } });
const pub = createPublicClient({ chain, transport: http() });
const owner = createWalletClient({ account: privateKeyToAccount(env.OWNER_KEY), chain, transport: http() });
const erc20 = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] }];

async function tx(functionName, args, address = ST, theAbi = abi) {
  const hash = await owner.writeContract({ address, abi: theAbi, functionName, args });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${functionName} reverted`);
  return r;
}
const u = (v) => parseUnits(v, 6);

const created = await tx("createHouse", [USDC, "Red Team Kitchen (testnet)", u("0.5"), u("5"), 500]);
const houseId = parseEventLogs({ abi, logs: created.logs, eventName: "HouseCreated" })[0].args.houseId;
await tx("setAgent", [houseId, env.AGENT_ADDRESS]);
await tx("setRoles", [houseId, env.CLERK_ADDRESS, 1]);
await tx("setRoles", [houseId, env.WITNESS_ADDRESS, 2]);
await tx("setRate", [houseId, keccak256(encodePacked(["string"], ["bread, 1 loaf"])), u("0.01"), BigInt(Math.floor(Date.now() / 1000) + 365 * 86400), true, "Bread, 1 loaf"]);
await tx("approve", [ST, u("5")], USDC, erc20);
console.log(`REDTEAM_HOUSE_ID=${houseId}`);
