import { after, NextResponse } from "next/server";
import { decodeEventLog, getAddress, isAddress, isHex } from "viem";
import { scaleTicketAbi } from "@/lib/abi";
import { publicClient, readHouse, readRoles, readTicket } from "@/lib/chain";
import { agentSigner } from "@/lib/agent/signer";
import { runAgent } from "@/lib/agent/run";
import { confirmTypedData } from "@/lib/typed";

export const maxDuration = 300;

/**
 * Gasless witness confirmation. The witness signs an EIP-712 message in their wallet (free);
 * the agent's wallet submits it. The signature is checked here and again by the contract, so
 * the relayer can't alter the quantity or the ticket it applies to.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return bad("Bad request");
  const ticketId = Number(body.ticketId);
  const observed = BigInt(String(body.observedQuantity ?? "0"));
  const deadline = BigInt(String(body.deadline ?? "0"));
  if (!isAddress(body.witness ?? "") || !isHex(body.signature ?? "")) return bad("Missing witness or signature");
  const witness = getAddress(body.witness);

  const ticket = await readTicket(ticketId);
  if (!ticket) return bad("Unknown ticket", 404);
  if (ticket.status !== "Open") return bad(`This ticket is ${ticket.status.toLowerCase()}, not waiting for a witness`, 409);
  if (((await readRoles(ticket.houseId, witness)) & 2) === 0) return bad("This wallet is not a witness in this house", 403);
  if ([ticket.issuer, ticket.payee].some((a) => a.toLowerCase() === witness.toLowerCase())) {
    return bad("The person who cut the ticket or gets paid by it can't also witness it", 403);
  }

  const valid = await publicClient.verifyTypedData({
    address: witness,
    signature: body.signature,
    ...confirmTypedData({ ticketId: BigInt(ticketId), observedQuantity: observed, payee: ticket.payee, evidenceHash: ticket.evidenceHash, deadline }),
  });
  if (!valid) return bad("Signature does not match this witness and ticket", 401);

  const receipt = await agentSigner().write("confirmBySig", [BigInt(ticketId), observed, witness, deadline, body.signature]);

  let result = "confirmed";
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: scaleTicketAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "TicketFrozen") result = "frozen";
    } catch {
      // other contract's log
    }
  }

  // A confirmed ticket is the moment money can move: wake the agent for this house.
  if (result === "confirmed") {
    const house = await readHouse(ticket.houseId);
    if (house && house.agent.toLowerCase() === agentSigner().address.toLowerCase()) {
      after(async () => {
        try {
          await runAgent(ticket.houseId, `ticket #${ticketId} confirmed by witness`);
        } catch (err) {
          console.error("agent run after confirm failed", err);
        }
      });
    }
  }

  return NextResponse.json({ txHash: receipt.transactionHash, result });
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
