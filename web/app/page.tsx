import Link from "next/link";
import { Stamp } from "@/components/Stamp";
import { grossOf, money, qty, short, timeAgo } from "@/lib/format";
import { chain, scaleTicketAddress } from "@/lib/network";
import { publicStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

const LAW = [
  ["The payee is locked when the ticket is cut.", "Nobody can type in a different wallet at payment time, not a clerk, not the owner, not the agent."],
  ["A second person confirms the quantity.", "The person who cut the ticket or gets paid by it can't be the witness. Neither can the agent."],
  ["The contract computes the amount.", "Confirmed quantity × the price that was posted. The agent's number is checked, never trusted."],
  ["A ticket pays once.", "A retry, a duplicate invoice, or the same delivery note twice is refused in public."],
  ["A mismatch freezes. It never rounds.", "If the agent names a different wallet or amount, the ticket stops and the reason is on the board."],
];

export default async function Home() {
  const stats = scaleTicketAddress ? await publicStats().catch(() => null) : null;

  return (
    <div className="space-y-16">
      <section className="grid gap-10 pt-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
        <div>
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-ink-soft">Evidence-locked payments on {chain.name}</p>
          <h1 className="font-serif text-5xl leading-[1.05] font-bold sm:text-6xl">
            Weighed in public.
            <br />
            Paid once.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            In most small businesses, the person who counts the goods is the person who sends the money. That&apos;s how
            suppliers get short-weighed, paid late, or paid twice, and how money ends up with the wrong person.
            Scalehouse separates the two. An agent decides when to pay; a contract decides what is owed and to whom.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/house/new" className="btn">
              Open a house
            </Link>
            <Link href="/board" className="btn btn-quiet">
              See every ticket
            </Link>
          </div>
        </div>

        <div className="sheet ruled">
          <Figure label="Tickets cut" value={stats ? String(stats.tickets) : "—"} />
          <Figure label="Paid" value={stats ? money(stats.paidVolume) : "—"} sub={stats ? `${stats.paid} tickets to ${stats.payees} people` : undefined} />
          <Figure label="Refused or frozen in public" value={stats ? String(stats.refusals ?? stats.frozenNow) : "—"} />
          <Figure label="Houses" value={stats ? String(stats.houses) : "—"} />
        </div>
      </section>

      <section>
        <h2 className="mb-6 font-serif text-3xl font-bold">The rule the agent can&apos;t talk past</h2>
        <ol className="sheet ruled">
          {LAW.map(([title, body], i) => (
            <li key={title} className="grid gap-1 px-5 py-4 sm:grid-cols-[2.5rem_1fr_1.4fr] sm:gap-4">
              <span className="figure text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-semibold">{title}</span>
              <span className="text-ink-soft">{body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["A shop buying stock", "The clerk cuts a ticket when a delivery arrives: 10 bags at the posted price, paid to the supplier's wallet. The owner counts and confirms. The agent pays."],
          ["A freelancer or a team", "Each milestone is a ticket bound to the worker's wallet. The client confirms the work. Payment follows the work, not the end of the month."],
          ["A bounty or a grant", "Each accepted submission is a ticket. A reviewer witnesses it. Nobody can pay the same submission twice."],
        ].map(([title, body]) => (
          <div key={title} className="sheet p-5">
            <h3 className="mb-2 font-serif text-xl font-bold">{title}</h3>
            <p className="text-ink-soft">{body}</p>
          </div>
        ))}
      </section>

      {stats && stats.recent.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-serif text-3xl font-bold">Latest on the board</h2>
            <Link href="/board" className="link text-sm">
              All tickets
            </Link>
          </div>
          <div className="sheet ruled">
            {stats.recent.map((t) => (
              <Link key={t.id} href={`/t/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-paper">
                <span className="figure">#{t.id}</span>
                <span className="figure text-ink-soft">{qty(t.confirmedQuantity || t.quantity)} units</span>
                <span className="figure">{money(grossOf(t.confirmedQuantity || t.quantity, t.unitPrice))}</span>
                <span className="figure text-ink-soft">→ {short(t.payee)}</span>
                <span className="text-xs text-ink-soft">{timeAgo(t.settledAt || t.cutAt)}</span>
                <Stamp status={t.status} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs uppercase tracking-[0.15em] text-ink-soft">{label}</div>
      <div className="figure mt-1 text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}
