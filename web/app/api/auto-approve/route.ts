import { NextResponse } from "next/server";
import { isHex } from "viem";
import { autoLimit, checkerOf, setAutoLimit, tryAutoApprove } from "@/lib/autoapprove";
import { publicClient, readHouse } from "@/lib/chain";
import { money, toUnits } from "@/lib/format";
import { confirmersMessage } from "@/lib/messages";
import { CHAIN_ID } from "@/lib/network";

export const maxDuration = 300;

/**
 * POST { ticketId }                                  → confirm it now if the house's rule allows
 * POST { houseId, action: "set", limit, at, signature } → owner sets the auto-approve limit; returns
 *    the checker wallet, which the owner's wallet then grants the confirmer role (once)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return bad("Bad request");

  if (body.action === "set") {
    const houseId = Number(body.houseId);
    const at = Number(body.at);
    if (!houseId || !at || !isHex(body.signature ?? "")) return bad("houseId, at and signature required");
    if (Math.abs(Date.now() / 1000 - at) > 600) return bad("That signature is too old. Try again.");
    let limit: bigint;
    try {
      limit = toUnits(String(body.limit ?? "0"));
    } catch {
      return bad("Enter a limit like 5 or 0.50");
    }
    const house = await readHouse(houseId);
    if (!house) return bad("Unknown house", 404);
    const ok = await publicClient.verifyMessage({ address: house.owner, message: confirmersMessage(houseId, CHAIN_ID, "auto-approve", at), signature: body.signature });
    if (!ok) return bad("Only the house owner can change auto-approve", 401);
    try {
      const checker = await checkerOf(houseId, limit > 0n);
      await setAutoLimit(houseId, limit);
      return NextResponse.json({ limit: limit.toString(), label: money(limit), checker: checker?.address ?? null });
    } catch (e) {
      return bad((e as Error).message.split("\n")[0], 500);
    }
  }

  if (body.houseId && body.action === "get") {
    const houseId = Number(body.houseId);
    const [limit, checker] = await Promise.all([autoLimit(houseId), checkerOf(houseId)]);
    return NextResponse.json({ limit: limit.toString(), checker: checker?.address ?? null });
  }

  const ticketId = Number(body.ticketId);
  if (!ticketId) return bad("ticketId required");
  try {
    return NextResponse.json(await tryAutoApprove(ticketId));
  } catch (e) {
    return bad((e as Error).message.split("\n")[0], 500);
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
