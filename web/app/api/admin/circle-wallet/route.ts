import { NextResponse } from "next/server";
import { initiateDeveloperControlledWalletsClient, registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import { networkName } from "@/lib/network";

export const dynamic = "force-dynamic";

/**
 * Creates (or finds) the agent's Circle Developer-Controlled Wallet on this deployment's Arc
 * network. Runs server-side because the live Circle key only exists in the deployment. Returns
 * ids and addresses only. Requires the ADMIN_SECRET bearer token. Idempotent by wallet set name.
 */
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const apiKey = (networkName === "mainnet" ? process.env.CIRCLEMAINNET_API_KEY : undefined) || process.env.CIRCLE_API_KEY;
  const body = (await req.json().catch(() => ({}))) as { registerEntitySecret?: string };
  if (body.registerEntitySecret) {
    // One-time: register a fresh entity secret with this key's entity. Returns the recovery file.
    try {
      const r = await registerEntitySecretCiphertext({ apiKey: apiKey!, entitySecret: body.registerEntitySecret });
      return NextResponse.json({ registered: true, recoveryFile: r.data?.recoveryFile ?? null });
    } catch (e) {
      const err = e as { response?: { data?: unknown }; message: string };
      return NextResponse.json({ error: err.message, detail: err.response?.data ?? null }, { status: 500 });
    }
  }
  const entitySecret = (networkName === "mainnet" ? process.env.CIRCLEMAINNET_ENTITY_SECRET : undefined) || process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) return NextResponse.json({ error: "Circle key or entity secret missing" }, { status: 503 });

  const blockchain = networkName === "mainnet" ? "ARC" : "ARC-TESTNET";
  const name = `Scalehouse agent (${networkName})`;
  try {
    const circle = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
    const sets = await circle.listWalletSets({ pageSize: 50 });
    let set = sets.data?.walletSets?.find((s) => (s as { name?: string }).name === name);
    if (!set) set = (await circle.createWalletSet({ name })).data?.walletSet;
    if (!set?.id) throw new Error("Couldn't create a wallet set");

    const existing = await circle.listWallets({ walletSetId: set.id, blockchain, pageSize: 10 });
    let wallet = existing.data?.wallets?.[0];
    if (!wallet) {
      const created = await circle.createWallets({ walletSetId: set.id, blockchains: [blockchain], count: 1, accountType: "EOA", metadata: [{ name }] });
      wallet = created.data?.wallets?.[0];
    }
    if (!wallet) throw new Error("Circle returned no wallet");
    return NextResponse.json({ keyType: apiKey.split(":")[0], blockchain, walletSetId: set.id, walletId: wallet.id, address: wallet.address, state: wallet.state });
  } catch (e) {
    const err = e as { response?: { data?: unknown }; message: string };
    return NextResponse.json({ error: err.message, detail: err.response?.data ?? null }, { status: 500 });
  }
}
