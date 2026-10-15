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
  if (!scaleTicketAddress) return <p className="text-ink-soft">ScaleTicket isn&apos;t deployed on this network yet.</p>;
  const { status = "All", house } = await searchParams;

  await syncIfStale();
  const [tickets, { houseCount }, created, freezes] = await Promise.all([
    allTickets(),
    counts(),
    eventsByName(["HouseCreated"], 1000),
    eventsByName(["TicketFrozen"], 5000),
  ]);
  const houses = await readHouses(Array.from({ length: houseCount }, (_, i) => i + 1));
  const names = new Map(created.map((e) => [Number(e.house_id), String((e.args as Record<string, unknown>).name)]));
  const freezeReason = new Map(freezes.map((e) => [Number(e.ticket_id), REASON[Number((e.args as Record<string, unknown>).reason)]]));
  const symbolOf = new Map(houses.map((h) => [h.id, tokenSymbol(h.token)]));

  const shown = tickets.filter((t) => (status === "All" || t.status === status) && (!house || t.houseId === Number(house)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl font-bold">The board</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Every ticket in every house, read directly from the ScaleTicket contract. Paid, waiting, frozen and why. Nothing
          here can be edited after the fact.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/board?status=${f}${house ? `&house=${house}` : ""}`}
            className={`stamp ${f === status ? "bg-ink text-paper" : "text-ink-soft"}`}
          >
            {f === "Open" ? "Awaiting witness" : f}
          </Link>
        ))}
      </div>

      {houses.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-ink-soft">Houses:</span>
          {houses.map((h) => (
            <Link key={h.id} href={`/house/${h.id}`} className="link">
              {names.get(h.id) ?? `House ${h.id}`}
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="sheet p-8 text-center text-ink-soft">No tickets here yet.</div>
      ) : (
        <div className="sheet overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs uppercase tracking-[0.12em] text-ink-soft">
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
                  <tr key={t.id} className="border-b border-rule last:border-0 hover:bg-paper">
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
                      {t.status === "Frozen" && reason && <div className="mt-1 max-w-[16rem] text-xs text-frozen">{REASON_TEXT[reason]}</div>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{timeAgo(t.settledAt || t.cutAt)}</td>
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
