// Probe: can a Circle developer-controlled wallet sign ScaleTicket's EIP-712 Confirm, and does it verify?
//   node scripts/probe-circle-typed.mjs
import { readFileSync } from "node:fs";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { recoverTypedDataAddress } from "viem";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const circle = initiateDeveloperControlledWalletsClient({ apiKey: env.CIRCLE_API_KEY, entitySecret: env.CIRCLE_ENTITY_SECRET });
const name = "Scalehouse confirmers (testnet)";
let set = (await circle.listWalletSets({ pageSize: 50 })).data?.walletSets?.find((s) => s.name === name);
if (!set) set = (await circle.createWalletSet({ name })).data.walletSet;
const w = (await circle.createWallets({ walletSetId: set.id, blockchains: ["ARC-TESTNET"], count: 1, accountType: "EOA" })).data.wallets[0];

const typed = {
  domain: { name: "ScaleTicket", version: "1", chainId: 5042002, verifyingContract: "0x321322aC12e419111E27781c5B2618fCB97AC7b7" },
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Confirm: [
      { name: "ticketId", type: "uint256" },
      { name: "observedQuantity", type: "uint64" },
      { name: "payee", type: "address" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Confirm",
  message: { ticketId: "13", observedQuantity: "1000", payee: "0x8A2b0FFb644206d8c7be908d87b043C9ABB8874B", evidenceHash: "0x" + "11".repeat(32), deadline: "9999999999" },
};
const sig = (await circle.signTypedData({ walletId: w.id, data: JSON.stringify(typed) })).data.signature;
const { EIP712Domain, ...types } = typed.types;
const rec = await recoverTypedDataAddress({
  domain: typed.domain,
  types,
  primaryType: "Confirm",
  message: { ...typed.message, ticketId: 13n, observedQuantity: 1000n, deadline: 9999999999n },
  signature: sig,
});
console.log("wallet", w.address, "recovered", rec, rec.toLowerCase() === w.address.toLowerCase() ? "MATCH" : "MISMATCH");
