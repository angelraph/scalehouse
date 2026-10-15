import Link from "next/link";
import { Stamp } from "@/components/Stamp";
import { allTickets, counts, readHouses } from "@/lib/chain";
import { grossOf, money, qty, short, timeAgo } from "@/lib/format";
import { eventsByName, syncIfStale } from "@/lib/indexer";
import { scaleTicketAddress, tokenSymbol } from "@/lib/network";
import { REASON, REASON_TEXT, type StatusName } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: (StatusName | "All")[] = ["All", "Open", "Confirmed", "Paid", "Frozen", "Voided"];

export default async function Board({ searchParams }: { searchParams: Promise<{ status?: string; house?: string }> }) {
  if (!scaleTicketAddress) return <p className="text-muted">ScaleTicket isn&apos;t deployed on this network yet.</p>;
  const { status = "All", house } = await searchParams;

  await syncIfStale();
  const [tickets, { houseCount }, created, freezes] = await Promise.all([
    allTickets(),
    counts(),
    // Names and freeze reasons come from the event index; the ticket rows themselves don't.
    eventsByName(["HouseCreated"], 1000).catch(() => []),
    eventsByName(["TicketFrozen"], 5000).catch(() => []),
  ]);
  const houses = await readHouses(Array.from({ length: houseCount }, (_, i) => i + 1));
  const names = new Map(created.map((e) => [Number(e.house_id), String((e.args as Record<string, unknown>).name)]));
  const freezeReason = new Map(freezes.map((e) => [Number(e.ticket_id), REASON[Number((e.args as Record<string, unknown>).reason)]]));
  const symbolOf = new Map(houses.map((h) => [h.id, tokenSymbol(h.token)]));

  const shown = tickets.filter((t) => (status === "All" || t.status === status) && (!house || t.houseId === Number(house)));

  return (
    <div className="space-y-8">
      <div className="relative pt-8">
        <div className="dots dots-fade pointer-events-none absolute -inset-x-4 -top-6 bottom-0 -z-10" />
        <span className="tag">The public ledger</span>
        <h1 className="display mt-5 text-6xl sm:text-7xl">The board</h1>
        <p className="two-tone mt-4 max-w-2xl text-xl">
          Every ticket in every house. <em>Paid, waiting, frozen and why, read directly from the contract. Nothing here can be edited after the fact.</em>
        </p>
      </div>

      <nav className="tabs text-sm">
        {FILTERS.map((f) => (
          <Link key={f} href={`/board?status=${f}${house ? `&house=${house}` : ""}`} aria-current={f === status}>
            {f === "Open" ? "Awaiting witness" : f}
            <span className="figure ml-1.5 text-xs text-faint">
              {f === "All" ? tickets.length : tickets.filter((t) => t.status === f).length}
            </span>
          </Link>
        ))}
      </nav>

      {houses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="eyebrow mr-1">Houses</span>
          {houses.map((h) => (
            <Link
              key={h.id}
              href={`/house/${h.id}`}
              className="rounded-full bg-sheet px-3 py-1.5 shadow-[var(--ring)] transition-shadow hover:shadow-[var(--lift)]"
            >
              {names.get(h.id) ?? `House ${h.id}`}
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card p-8 text-center text-muted">No tickets here yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 font-medium">Ticket</th>
                <th className="px-4 py-3 font-medium">House</th>
                <th className="px-4 py-3 font-medium">Pays</th>
                <th className="px-4 py-3 text-right font-medium">Quantity</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const q = t.confirmedQuantity || t.quantity;
                const reason = freezeReason.get(t.id);
                return (
                  <tr key={t.id} className="border-b border-rule last:border-0 hover:bg-paper-2">
                    <td className="px-4 py-3">
                      <Link href={`/t/${t.id}`} className="link figure">
                        #{t.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{names.get(t.houseId) ?? `House ${t.houseId}`}</td>
                    <td className="figure px-4 py-3">{short(t.payee)}</td>
                    <td className="figure px-4 py-3 text-right">{qty(q)}</td>
                    <td className="figure px-4 py-3 text-right">{money(grossOf(q, t.unitPrice), symbolOf.get(t.houseId))}</td>
                    <td className="px-4 py-3">
                      <Stamp status={t.status} />
                      {t.status === "Frozen" && reason && <div className="mt-1 max-w-[16rem] text-xs text-red">{REASON_TEXT[reason]}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted">{timeAgo(t.settledAt || t.cutAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
