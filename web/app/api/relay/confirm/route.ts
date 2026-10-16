import { NextResponse } from "next/server";
import { getAddress, isAddress, isHex } from "viem";
import { RelayError, relayConfirm } from "@/lib/relay";

export const maxDuration = 300;

/**
 * Gasless witness confirmation. The witness signs an EIP-712 message in their wallet (free);
 * the agent's wallet submits it. The signature is checked here and again by the contract, so
 * the relayer can't alter the quantity or the ticket it applies to.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return bad("Bad request");
  if (!isAddress(body.witness ?? "") || !isHex(body.signature ?? "")) return bad("Missing witness or signature");
  try {
    const r = await relayConfirm({
      ticketId: Number(body.ticketId),
      observed: BigInt(String(body.observedQuantity ?? "0")),
      witness: getAddress(body.witness),
      deadline: BigInt(String(body.deadline ?? "0")),
      signature: body.signature,
    });
    return NextResponse.json({ txHash: r.txHash, result: r.result });
  } catch (e) {
    if (e instanceof RelayError) return bad(e.message, e.status);
    throw e;
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
