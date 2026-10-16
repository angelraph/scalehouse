import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { readRoles, readTicket } from "@/lib/chain";
import { circle } from "@/lib/circle";
import { confirmerByToken } from "@/lib/confirmers";
import { RelayError, relayConfirm } from "@/lib/relay";
import { confirmTypedData } from "@/lib/typed";

export const maxDuration = 300;

/**
 * A link confirmer taps Confirm. Their Circle wallet signs the EIP-712 confirmation (they never
 * see a wallet), and the agent relays it on-chain, exactly like a wallet-signed confirmation.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const ticketId = Number(body?.ticketId);
  let observed: bigint;
  try {
    observed = BigInt(String(body?.observedQuantity ?? ""));
  } catch {
    return bad("Enter the quantity you checked");
  }

  const who = token ? await confirmerByToken(token) : null;
  if (!who) return bad("This confirm link isn't valid. Ask the owner for a new one.", 401);
  const ticket = await readTicket(ticketId);
  if (!ticket || ticket.houseId !== who.houseId) return bad("That payment isn't in this house", 404);
  if (ticket.status !== "Open") return bad(`This payment is already ${ticket.status.toLowerCase()}`, 409);
  if (((await readRoles(who.houseId, who.address)) & 2) === 0) return bad("The owner hasn't finished adding you yet. Ask them to tap Add again.", 403);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const typed = confirmTypedData({ ticketId: BigInt(ticketId), observedQuantity: observed, payee: ticket.payee, evidenceHash: ticket.evidenceHash, deadline });
  const data = JSON.stringify(
    {
      ...typed,
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        ...typed.types,
      },
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
  );

  try {
    const signed = await circle().signTypedData({ walletId: who.walletId, data });
    const signature = signed.data?.signature as Hex | undefined;
    if (!signature) return bad("Circle didn't return a signature. Try again.", 502);
    const r = await relayConfirm({ ticketId, observed, witness: who.address, deadline, signature });
    return NextResponse.json({ txHash: r.txHash, result: r.result });
  } catch (e) {
    if (e instanceof RelayError) return bad(e.message, e.status);
    return bad((e as Error).message.split("\n")[0], 500);
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
