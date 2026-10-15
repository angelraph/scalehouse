import "server-only";
import { keccak256, toBytes, type Hex } from "viem";
import { canonicalJson } from "../format";
import { db, must } from "../db";

export type RationaleKind = "RELEASE" | "DEFER" | "FLAG" | "CAP";

/**
 * Stores the agent's full reasoning off-chain and returns its hash, which goes on-chain with
 * the action. Anyone can recompute the hash from the stored JSON and check it against the
 * event, so the record can't be quietly rewritten afterwards.
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
  must(
    await db().from("sh_rationales").upsert({
      rationale_hash: hash,
      house_id: input.houseId,
      ticket_id: input.ticketId,
      kind: input.kind,
      model: input.model,
      rationale: JSON.parse(json),
    }),
    "sh_rationales insert",
  );
  return hash;
}

export async function attachTx(hash: Hex, txHash: Hex) {
  must(await db().from("sh_rationales").update({ tx_hash: txHash }).eq("rationale_hash", hash), "sh_rationales update");
}

export function verifyRationale(row: { rationale_hash: string; rationale: unknown }): boolean {
  return keccak256(toBytes(canonicalJson(row.rationale))) === row.rationale_hash;
}
