import "server-only";
import { after } from "next/server";
import { decodeEventLog, type Address, type Hex } from "viem";
import { scaleTicketAbi } from "./abi";
import { publicClient, readHouse, readRoles, readTicket } from "./chain";
import { agentSigner } from "./agent/signer";
import { runAgent } from "./agent/run";
import { confirmTypedData } from "./typed";
import { houseTeam } from "./house";

export class RelayError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/**
 * Submits a witness's signed confirmation through the agent's wallet (so it's free for the
 * witness), after checking it here; the contract checks it again. On a clean confirm it wakes the
 * agent for the house.
 */
export async function relayConfirm(p: { ticketId: number; observed: bigint; witness: Address; deadline: bigint; signature: Hex }) {
  const ticket = await readTicket(p.ticketId);
  if (!ticket) throw new RelayError("Unknown ticket", 404);
  if (ticket.status !== "Open") throw new RelayError(`This ticket is ${ticket.status.toLowerCase()}, not waiting for a confirmation`, 409);
  if (((await readRoles(ticket.houseId, p.witness)) & 2) === 0) {
    const witnesses = (await houseTeam(ticket.houseId)).filter((m) => m.roles & 2).map((m) => `${m.address.slice(0, 6)}…${m.address.slice(-4)}`);
    throw new RelayError(
      `The connected wallet (${p.witness.slice(0, 6)}…${p.witness.slice(-4)}) isn't a confirmer in this house. ` +
        (witnesses.length ? `Switch your wallet to ${witnesses.join(" or ")} and sign again.` : "The owner hasn't added a confirmer yet."),
      403,
    );
  }
  if ([ticket.issuer, ticket.payee].some((a) => a.toLowerCase() === p.witness.toLowerCase())) {
    throw new RelayError("The person who recorded the payment or gets paid by it can't also confirm it", 403);
  }
  const valid = await publicClient.verifyTypedData({
    address: p.witness,
    signature: p.signature,
    ...confirmTypedData({ ticketId: BigInt(p.ticketId), observedQuantity: p.observed, payee: ticket.payee, evidenceHash: ticket.evidenceHash, deadline: p.deadline }),
  });
  if (!valid) throw new RelayError("Signature does not match this confirmer and ticket", 401);

  const receipt = await agentSigner().write("confirmBySig", [BigInt(p.ticketId), p.observed, p.witness, p.deadline, p.signature]);
  let result: "confirmed" | "frozen" = "confirmed";
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
          await runAgent(ticket.houseId, `ticket #${p.ticketId} confirmed`);
        } catch (err) {
          console.error("agent run after confirm failed", err);
        }
      });
    }
  }
  return { txHash: receipt.transactionHash, result, houseId: ticket.houseId };
}
