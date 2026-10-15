import { NextResponse } from "next/server";
import { getAddress, isAddress, isHex } from "viem";
import { publicClient, readHouse } from "@/lib/chain";
import { sql } from "@/lib/db";
import { labelMessage } from "@/lib/messages";
import { CHAIN_ID } from "@/lib/network";

/** The house owner names a wallet ("Chidi, rice supplier"). Signed so nobody else can relabel. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const houseId = Number(body?.houseId);
  const label = String(body?.label ?? "").trim().slice(0, 60);
  if (!isAddress(body?.address ?? "") || !isHex(body?.signature ?? "") || !label) {
    return NextResponse.json({ error: "address, label and signature required" }, { status: 400 });
  }
  const address = getAddress(body.address);
  const house = await readHouse(houseId);
  if (!house) return NextResponse.json({ error: "Unknown house" }, { status: 404 });

  const ok = await publicClient.verifyMessage({
    address: house.owner,
    message: labelMessage(houseId, address, label),
    signature: body.signature,
  });
  if (!ok) return NextResponse.json({ error: "Only the house owner can name wallets" }, { status: 401 });

  await sql()`
    insert into sh_labels (chain_id, house_id, address, label) values (${CHAIN_ID}, ${houseId}, ${address.toLowerCase()}, ${label})
    on conflict (chain_id, house_id, address) do update set label = excluded.label`;
  return NextResponse.json({ ok: true });
}
