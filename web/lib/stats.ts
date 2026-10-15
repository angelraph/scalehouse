import "server-only";
import { allTickets } from "./chain";
import { grossOf } from "./format";
import { eventsByName, syncIfStale } from "./indexer";

/** Headline numbers, all derived from contract state and contract events. */
export async function publicStats() {
  await syncIfStale();
  const [tickets, refusals] = await Promise.all([allTickets(), eventsByName(["ReleaseRefused", "TicketFrozen"], 5000)]);
  const paid = tickets.filter((t) => t.status === "Paid");
  const houses = new Set(tickets.map((t) => t.houseId));
  const payees = new Set(paid.map((t) => t.payee.toLowerCase()));
  return {
    tickets: tickets.length,
    paid: paid.length,
    paidVolume: paid.reduce((s, t) => s + grossOf(t.confirmedQuantity, t.unitPrice), 0n),
    refusals: refusals.length,
    houses: houses.size,
    payees: payees.size,
    recent: tickets.slice(0, 8),
  };
}
