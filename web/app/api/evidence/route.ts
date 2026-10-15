import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { scaleTicketAbi } from "@/lib/abi";
import { publicClient, readHouse, readRoles } from "@/lib/chain";
import { db, EVIDENCE_BUCKET, must } from "@/lib/db";
import { evidenceHash, normalizeReference } from "@/lib/format";
import { scaleTicketAddress } from "@/lib/network";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

  let photoPath: string | null = null;
  let photoSha: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) return bad("Photo must be under 5 MB");
    if (!photo.type.startsWith("image/")) return bad("Evidence must be an image");
    const bytes = new Uint8Array(await photo.arrayBuffer());
    photoSha = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
    const ext = photo.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg";
    photoPath = `${houseId}/${hash}.${ext}`;
    must(
      await db().storage.from(EVIDENCE_BUCKET).upload(photoPath, bytes, { contentType: photo.type, upsert: true }),
      "evidence upload",
    );
  }

  must(
    await db().from("sh_evidence").upsert({
      evidence_hash: hash,
      house_id: houseId,
      payee,
      reference,
      note,
      photo_path: photoPath,
      photo_sha256: photoSha,
      created_by: issuer,
    }),
    "sh_evidence upsert",
  );

  return NextResponse.json({ evidenceHash: hash });
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
