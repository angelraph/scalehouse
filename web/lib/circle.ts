import "server-only";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { networkName } from "./network";

type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;
let cached: CircleClient | null = null;

/** Circle Developer-Controlled Wallets client for this deployment's network (live key on mainnet). */
export function circle(): CircleClient {
  if (cached) return cached;
  const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "");
  const apiKey = clean((networkName === "mainnet" ? process.env.CIRCLEMAINNET_API_KEY : undefined) || process.env.CIRCLE_API_KEY);
  const entitySecret = clean((networkName === "mainnet" ? process.env.CIRCLEMAINNET_ENTITY_SECRET : undefined) || process.env.CIRCLE_ENTITY_SECRET);
  if (!apiKey || !entitySecret) throw new Error("Circle API key or entity secret missing");
  cached = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  return cached;
}

export const CIRCLE_BLOCKCHAIN = networkName === "mainnet" ? "ARC" : "ARC-TESTNET";

/** Finds or creates a named wallet set. */
export async function walletSet(name: string): Promise<string> {
  const c = circle();
  const sets = await c.listWalletSets({ pageSize: 50 });
  const found = sets.data?.walletSets?.find((s) => (s as { name?: string }).name === name);
  if (found?.id) return found.id;
  const created = await c.createWalletSet({ name });
  if (!created.data?.walletSet?.id) throw new Error("Circle didn't create the wallet set");
  return created.data.walletSet.id;
}
