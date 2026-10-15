import "server-only";
import { allTickets } from "./chain";
import { grossOf } from "./format";
import { eventsByName, syncIfStale } from "./indexer";

/**
 * Headline numbers. Ticket, payment and payee counts come straight from contract state, so
 * they render even if the event index is unavailable; only the refusal count needs the index.
 */
export async function publicStats() {
  await syncIfStale();
  const [tickets, refusals] = await Promise.all([
    allTickets(),
    eventsByName(["ReleaseRefused", "TicketFrozen"], 5000).then(
      (rows) => rows.length,
      () => null,
    ),
  ]);
  const paid = tickets.filter((t) => t.status === "Paid");
  return {
    tickets: tickets.length,
    paid: paid.length,
    paidVolume: paid.reduce((s, t) => s + grossOf(t.confirmedQuantity, t.unitPrice), 0n),
    refusals,
    frozenNow: tickets.filter((t) => t.status === "Frozen").length,
    houses: new Set(tickets.map((t) => t.houseId)).size,
    payees: new Set(paid.map((t) => t.payee.toLowerCase())).size,
    recent: tickets.slice(0, 8),
  };
}
