import "server-only";
import { keccak256, toBytes, type Hex } from "viem";
import { canonicalJson } from "../format";
import { sql } from "../db";

export type RationaleKind = "RELEASE" | "DEFER" | "FLAG" | "CAP";

/**
 * Stores the agent's full reasoning off-chain and returns its hash, which goes on-chain with
 * the action. The canonical JSON is stored verbatim, so anyone can recompute the hash and check
 * it against the event: the record can't be quietly rewritten afterwards.
 */
export async function saveRationale(input: {
  houseId: number;
  ticketId: number | null;
  kind: RationaleKind;
  model: string;
  body: Record<string, unknown>;
}): Promise<Hex> {
  const json = canonicalJson(input.body);
  const hash = keccak256(toBytes(json));
  await sql()`
    insert into sh_rationales (rationale_hash, house_id, ticket_id, kind, model, rationale)
    values (${hash}, ${input.houseId}, ${input.ticketId}, ${input.kind}, ${input.model}, ${json})
    on conflict (rationale_hash) do nothing`;
  return hash;
}

export async function attachTx(hash: Hex, txHash: Hex) {
  await sql()`update sh_rationales set tx_hash = ${txHash} where rationale_hash = ${hash}`;
}

export function verifyRationale(row: { rationale_hash: string; rationale: string }): boolean {
  return keccak256(toBytes(row.rationale)) === row.rationale_hash;
}
