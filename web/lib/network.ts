import { defineChain, type Address } from "viem";

// Arc mainnet and testnet. Token addresses are from docs.arc.io/arc/references/contract-addresses
// and were checked against the live chain (USDC: symbol "USDC", 6 decimals on both).
export const NETWORKS = {
  mainnet: {
    chain: defineChain({
      id: 5042,
      name: "Arc",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
      blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
      contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
    }),
    tokens: {
      USDC: "0x3600000000000000000000000000000000000000",
      EURC: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
    },
  },
  testnet: {
    chain: defineChain({
      id: 5042002,
      name: "Arc Testnet",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
      blockExplorers: { default: { name: "Arc Testnet Explorer", url: "https://explorer.testnet.arc.io" } },
      contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
      testnet: true,
    }),
    tokens: {
      USDC: "0x3600000000000000000000000000000000000000",
      EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    },
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

export const networkName: NetworkName =
  process.env.NEXT_PUBLIC_NETWORK === "testnet" ? "testnet" : "mainnet";

export const network = NETWORKS[networkName];
export const chain = network.chain;
export const isMainnet = networkName === "mainnet";

/** Every off-chain row is tagged with this, so mainnet and testnet can share one database. */
export const CHAIN_ID = network.chain.id;

export const scaleTicketAddress = (process.env.NEXT_PUBLIC_SCALETICKET_ADDRESS ?? "") as Address;
export const deployBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "0");

/** The address of the Scalehouse agent. A house opts in by naming it with setAgent. */
export const agentAddress = (process.env.NEXT_PUBLIC_AGENT_ADDRESS ?? "") as Address;

export const tokenSymbol = (token: string): string => {
  const t = token.toLowerCase();
  for (const [symbol, addr] of Object.entries(network.tokens)) {
    if (addr.toLowerCase() === t) return symbol;
  }
  return "TOKEN";
};

export const explorerTx = (hash: string) => `${chain.blockExplorers.default.url}/tx/${hash}`;
export const explorerAddress = (addr: string) => `${chain.blockExplorers.default.url}/address/${addr}`;

/** Both supported stablecoins use 6 decimals at their ERC-20 interface. */
export const TOKEN_DECIMALS = 6;
export const QTY_SCALE = 1000;
