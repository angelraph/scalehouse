import { NextResponse } from "next/server";
import { isHex } from "viem";
import { publicClient, readHouse } from "@/lib/chain";
import { confirmersOf, createConfirmer } from "@/lib/confirmers";
import { confirmersMessage } from "@/lib/messages";
import { CHAIN_ID, siteUrl } from "@/lib/network";

export const dynamic = "force-dynamic";

/**
 * The house owner adds a confirmer who needs no wallet app ("add"), or gets their links again
 * ("list"). Both require a fresh signature from the owner's wallet. "add" returns the confirmer's
 * Circle wallet address; the owner's wallet then grants it the witness role on-chain.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const houseId = Number(body?.houseId);
  const action = body?.action === "add" ? "add" : "list";
  const at = Number(body?.at);
  const name = String(body?.name ?? "").trim().slice(0, 40);
  if (!houseId || !isHex(body?.signature ?? "") || !at) return bad("houseId, at and signature required");
  if (Math.abs(Date.now() / 1000 - at) > 600) return bad("That signature is too old. Try again.");
  if (action === "add" && !name) return bad("Give the confirmer a name");

  const house = await readHouse(houseId);
  if (!house) return bad("Unknown house", 404);
  const ok = await publicClient.verifyMessage({ address: house.owner, message: confirmersMessage(houseId, CHAIN_ID, action, at), signature: body.signature });
  if (!ok) return bad("Only the house owner can manage confirmers", 401);

  const link = (token: string) => `${siteUrl}/c/${token}`;
  try {
    if (action === "add") {
      const c = await createConfirmer(houseId, name);
      return NextResponse.json({ name: c.name, address: c.address, link: link(c.token) });
    }
    const list = await confirmersOf(houseId);
    return NextResponse.json({ confirmers: list.map((c) => ({ name: c.name, address: c.address, link: link(c.token) })) });
  } catch (e) {
    return bad((e as Error).message.split("\n")[0], 500);
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
