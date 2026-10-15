import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { scaleTicketAbi } from "@/lib/abi";
import { publicClient, readHouse, readRoles } from "@/lib/chain";
import { sql } from "@/lib/db";
import { evidenceHash, normalizeReference } from "@/lib/format";
import { CHAIN_ID, scaleTicketAddress } from "@/lib/network";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/**
 * Stores the evidence behind a ticket before it is cut, and returns the hash the issuer puts
 * on-chain. Refuses up front if the same payee + reference already backs a live ticket, which
 * is the same check the contract makes.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const houseId = Number(form.get("houseId"));
  const payeeRaw = String(form.get("payee") ?? "");
  const issuerRaw = String(form.get("issuer") ?? "");
  const reference = String(form.get("reference") ?? "").trim();
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  const photo = form.get("photo");

  if (!Number.isInteger(houseId) || houseId <= 0) return bad("Unknown house");
  if (!isAddress(payeeRaw)) return bad("The payee must be a wallet address (0x…)");
  if (!isAddress(issuerRaw)) return bad("Connect the wallet that is cutting this ticket");
  if (!normalizeReference(reference)) return bad("Add a reference: an invoice, delivery note or job number");

  const payee = getAddress(payeeRaw);
  const issuer = getAddress(issuerRaw);
  const house = await readHouse(houseId);
  if (!house) return bad("Unknown house");
  if (((await readRoles(houseId, issuer)) & 1) === 0) return bad("This wallet is not a clerk in this house", 403);

  const hash = evidenceHash(payee, reference);
  const existing = await publicClient.readContract({
    address: scaleTicketAddress,
    abi: scaleTicketAbi,
    functionName: "evidenceTicket",
    args: [BigInt(houseId), hash],
  });
  if (existing !== 0n) {
    return bad(`This reference from this payee is already on ticket #${existing}. The same document can't be paid twice.`, 409);
  }

  let photoBytes: Buffer | null = null;
  let photoType: string | null = null;
  let photoSha: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) return bad("Photo must be under 3 MB");
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(photo.type)) return bad("Evidence must be a JPEG, PNG or WebP photo");
    photoBytes = Buffer.from(await photo.arrayBuffer());
    photoType = photo.type;
    photoSha = createHash("sha256").update(photoBytes).digest("hex");
  }

  // Re-submitting before the ticket is cut (e.g. after a failed transaction) replaces the draft.
  await sql()`
    insert into sh_evidence (chain_id, evidence_hash, house_id, payee, reference, note, photo, photo_type, photo_sha256, created_by)
    values (${CHAIN_ID}, ${hash}, ${houseId}, ${payee}, ${reference}, ${note}, ${photoBytes}, ${photoType}, ${photoSha}, ${issuer})
    on conflict (chain_id, evidence_hash) do update set
      house_id = excluded.house_id, payee = excluded.payee, reference = excluded.reference, note = excluded.note,
      photo = excluded.photo, photo_type = excluded.photo_type, photo_sha256 = excluded.photo_sha256,
      created_by = excluded.created_by, created_at = now()`;

  return NextResponse.json({ evidenceHash: hash });
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
