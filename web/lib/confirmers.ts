import "server-only";
import { randomBytes } from "node:crypto";
import { getAddress, type Address } from "viem";
import { CIRCLE_BLOCKCHAIN, circle, walletSet } from "./circle";
import { sql } from "./db";
import { CHAIN_ID, networkName } from "./network";

/**
 * Confirmers who don't need a wallet app. Each one gets a Circle Developer-Controlled Wallet
 * that holds the house's witness role, and a private link. Opening the link and tapping Confirm
 * makes Circle sign the confirmation for them. The link is their credential, like a magic link.
 */
export interface Confirmer {
  houseId: number;
  address: Address;
  walletId: string;
  name: string;
  token: string;
}

let ready = false;
async function ensureTable() {
  if (ready) return;
  await sql()`
    create table if not exists sh_confirmers (
      chain_id   integer not null,
      house_id   integer not null,
      address    text not null,
      wallet_id  text not null,
      name       text not null,
      token      text not null unique,
      created_at timestamptz not null default now(),
      primary key (chain_id, house_id, address)
    )`;
  ready = true;
}

const row = (r: Record<string, unknown>): Confirmer => ({
  houseId: Number(r.house_id),
  address: getAddress(String(r.address)),
  walletId: String(r.wallet_id),
  name: String(r.name),
  token: String(r.token),
});

export async function createConfirmer(houseId: number, name: string): Promise<Confirmer> {
  await ensureTable();
  const setId = await walletSet(`Scalehouse confirmers (${networkName})`);
  const created = await circle().createWallets({ walletSetId: setId, blockchains: [CIRCLE_BLOCKCHAIN], count: 1, accountType: "EOA" });
  const w = created.data?.wallets?.[0];
  if (!w?.id || !w.address) throw new Error("Circle didn't create the wallet");
  const token = randomBytes(18).toString("base64url");
  await sql()`
    insert into sh_confirmers (chain_id, house_id, address, wallet_id, name, token)
    values (${CHAIN_ID}, ${houseId}, ${w.address.toLowerCase()}, ${w.id}, ${name}, ${token})`;
  return { houseId, address: getAddress(w.address), walletId: w.id, name, token };
}

export async function confirmerByToken(token: string): Promise<Confirmer | null> {
  await ensureTable();
  const rows = (await sql()`select * from sh_confirmers where chain_id = ${CHAIN_ID} and token = ${token} limit 1`) as Record<string, unknown>[];
  return rows[0] ? row(rows[0]) : null;
}

export async function confirmersOf(houseId: number): Promise<Confirmer[]> {
  await ensureTable();
  const rows = (await sql()`select * from sh_confirmers where chain_id = ${CHAIN_ID} and house_id = ${houseId} order by created_at`) as Record<string, unknown>[];
  return rows.map(row);
}
