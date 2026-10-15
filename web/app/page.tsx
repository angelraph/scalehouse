import Link from "next/link";
import { LiveTicket, type LiveTicketData } from "@/components/LiveTicket";
import { Marquee } from "@/components/Marquee";
import { MoneyFlow, type FlowData } from "@/components/MoneyFlow";
import { Reveal } from "@/components/Reveal";
import { Stamp } from "@/components/Stamp";
import { UseCases } from "@/components/UseCases";
import { grossOf, money, qty, short, timeAgo } from "@/lib/format";
import { chain, scaleTicketAddress } from "@/lib/network";
import { publicStats } from "@/lib/stats";
import { readHouse } from "@/lib/chain";
import type { Ticket } from "@/lib/types";

export const dynamic = "force-dynamic";

const RULES = [
  ["The payee is locked when the ticket is cut.", "Nobody types a wallet at payment time: not the clerk, not the owner, not the agent.", "lock"],
  ["A second person counts.", "Whoever cut the ticket or gets paid by it can't witness it. Neither can the agent.", "eye"],
  ["The contract does the sum.", "Confirmed quantity × the posted price. The agent's number is checked, never trusted.", "sum"],
  ["A ticket pays once.", "A retry, a duplicate invoice, the same delivery note twice: refused, in public.", "one"],
  ["A mismatch freezes. It never rounds.", "Wrong wallet or wrong amount from the agent stops the ticket and says why.", "stop"],
] as const;

function toLive(t: Ticket | undefined): LiveTicketData | null {
  if (!t) return null;
  const q = t.confirmedQuantity || t.quantity;
  return {
    id: t.id,
    house: `House ${t.houseId}`,
    payee: short(t.payee),
    quantity: qty(t.quantity),
    witnessed: t.confirmedQuantity ? qty(t.confirmedQuantity) : null,
    price: money(t.unitPrice),
    amount: money(grossOf(q, t.unitPrice)),
    status: t.status as LiveTicketData["status"],
    cutAt: timeAgo(t.cutAt),
    settledAt: t.settledAt ? timeAgo(t.settledAt) : null,
    freezeText: null,
  };
}

export default async function Home() {
  const stats = scaleTicketAddress ? await publicStats().catch(() => null) : null;
  const hero = stats?.recent.find((t) => t.status === "Paid") ?? stats?.recent[0];
  const heroHouse = hero ? await readHouse(hero.houseId).catch(() => null) : null;
  const flow: FlowData | null = hero
    ? {
        ticketId: hero.id,
        payer: heroHouse ? short(heroHouse.owner) : `House ${hero.houseId}`,
        payee: short(hero.payee),
        amount: money(grossOf(hero.confirmedQuantity || hero.quantity, hero.unitPrice)),
        quantity: qty(hero.confirmedQuantity || hero.quantity),
        price: money(hero.unitPrice),
        status: hero.status as FlowData["status"],
        when: timeAgo(hero.settledAt || hero.cutAt),
        network: chain.name,
      }
    : null;

  return (
    <div className="space-y-28">
      {/* Hero */}
      <section className="relative grid items-center gap-12 pt-6 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
        <div className="dots dots-fade pointer-events-none absolute -inset-x-4 -top-10 bottom-0 -z-10" />
        <Reveal>
          <span className="tag">Evidence-locked payments on {chain.name}</span>
          <h1 className="display mt-6 text-[3.4rem] sm:text-7xl lg:text-[5.6rem]">
            Weighed in public.
            <br />
            <span className="italic text-forest">Paid once.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
            In most small businesses the person who counts the goods is the person who sends the money. That&apos;s how
            suppliers get short-weighed, paid late, or paid twice. Scalehouse splits the two:{" "}
            <span className="text-ink">an agent decides when to pay, and a contract decides what is owed and to whom.</span>
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/house/new" className="btn">
              Open a house
              <span aria-hidden>→</span>
            </Link>
            <Link href="/board" className="btn btn-quiet">
              See every ticket
            </Link>
          </div>
        </Reveal>
        <MoneyFlow f={flow} />
      </section>

      {/* Live strip */}
      {stats && stats.recent.length > 0 && (
        <section className="-mx-4">
          <Marquee label="Recent tickets">
            {stats.recent.map((t) => (
              <Link
                key={t.id}
                href={`/t/${t.id}`}
                className="flex items-center gap-3 rounded-full bg-sheet py-2 pr-5 pl-2 whitespace-nowrap shadow-[var(--ring)] transition-shadow hover:shadow-[var(--lift)]"
              >
                <Stamp status={t.status} />
                <span className="figure text-sm">#{t.id}</span>
                <span className="figure text-sm">{money(grossOf(t.confirmedQuantity || t.quantity, t.unitPrice))}</span>
                <span className="figure text-sm text-muted">→ {short(t.payee)}</span>
                <span className="text-xs text-faint">{timeAgo(t.settledAt || t.cutAt)}</span>
              </Link>
            ))}
          </Marquee>
        </section>
      )}

      {/* Figures */}
      <section>
        <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <span className="tag">On the chain right now</span>
            <h2 className="two-tone mt-5 max-w-3xl text-3xl sm:text-4xl">
              Every ticket is public. <em>Paid, waiting, refused or frozen, with the reason, read straight from the contract.</em>
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <LiveTicket t={toLive(hero)} network={chain.name} />
          </Reveal>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-rule lg:grid-cols-4">
          {[
            ["Paid out", stats ? money(stats.paidVolume) : "—", stats ? `${stats.paid} tickets` : ""],
            ["People paid", stats ? String(stats.payees) : "—", "distinct wallets"],
            ["Refused or frozen", stats ? String(stats.refusals ?? stats.frozenNow) : "—", "each one on the board"],
            ["Houses", stats ? String(stats.houses) : "—", "businesses paying through Scalehouse"],
          ].map(([k, v, s], i) => (
            <Reveal key={k} delay={i * 90} className="bg-paper p-6 sm:p-8">
              <div className="figure text-3xl tracking-tight sm:text-4xl">{v}</div>
              <div className="mt-3 text-sm font-medium">{k}</div>
              <div className="text-xs text-muted">{s}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The rule */}
      <section>
        <Reveal>
          <span className="tag">The rule</span>
          <h2 className="two-tone mt-5 max-w-3xl text-3xl sm:text-4xl">
            The agent can&apos;t talk its way past five lines. <em>They live in a contract on {chain.name}, not in a prompt.</em>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {RULES.map(([title, body, glyph], i) => (
            <Reveal key={title} delay={i * 80} className={`tile flex min-h-64 flex-col justify-between p-7 ${i === 0 ? "lg:row-span-2 lg:min-h-0" : ""}`}>
              <Glyph kind={glyph} big={i === 0} />
              <div>
                <div className="figure text-xs text-bronze">0{i + 1}</div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How: dark band */}
      <section id="how" className="relative -mx-4 scroll-mt-24 overflow-hidden rounded-[32px] bg-night px-6 py-16 text-[#e9e7d8] sm:px-12">
        <div className="dots-lime pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative grid gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="tag !bg-white/10 !text-lime">How a ticket moves</span>
            <h2 className="two-tone mt-5 text-3xl text-white sm:text-4xl">
              Four people, one rule. <em className="!text-white/50">Each can only do their part.</em>
            </h2>
            <ol className="mt-10 space-y-6">
              {[
                ["Clerk", "cuts the ticket: what, how many, at which posted price, to which wallet."],
                ["Witness", "counts it again and signs what they saw. Free, no gas."],
                ["Agent", "screens the payee, reads the history, decides what to pay first, and writes down why."],
                ["Contract", "checks the agent's payee and amount against the ticket, then pays, or freezes."],
              ].map(([who, what]) => (
                <li key={who} className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-white/10 pt-5">
                  <span className="font-semibold text-lime">{who}</span>
                  <span className="text-white/70">{what}</span>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={150}>
            <div className="overflow-hidden rounded-2xl bg-night-2 ring-1 ring-white/10">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="figure ml-3 text-xs text-white/40">ScaleTicket.release</span>
              </div>
              <pre className="figure overflow-x-auto p-5 text-[0.8rem] leading-6 text-white/80">
                <span className="text-white/40">{"// the agent names who and how much\n"}</span>
                {"release(ticket, "}
                <span className="text-lime">payee</span>
                {", "}
                <span className="text-lime">amount</span>
                {", rationaleHash)\n\n"}
                <span className="text-white/40">{"// the contract checks it against the ticket\n"}</span>
                {"payee  == ticket.payee           "}
                <span className="text-white/40">{"// locked at cut\n"}</span>
                {"amount == witnessed × postedPrice"}
                <span className="text-white/40">{"\n// then pays, once\n"}</span>
                <span className="text-lime">{"→ TicketReleased"}</span>
                {"\n"}
                <span className="text-white/40">{"// or, if the agent got either wrong\n"}</span>
                <span className="text-[#ff8a75]">{"→ TicketFrozen(PayeeMismatch)"}</span>
                <span className="caret text-lime" />
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Use cases */}
      <section>
        <Reveal>
          <span className="tag">Who it&apos;s for</span>
        </Reveal>
        <div className="mt-6">
          <UseCases />
        </div>
      </section>

      {/* Quote */}
      <Reveal as="section" className="mx-auto max-w-3xl text-center">
        <p className="display text-3xl leading-snug text-ink-2 sm:text-4xl">
          &lsquo;The same possessions are wealth to the man who knows how to use them, and not wealth to one who does not.&rsquo;
        </p>
        <p className="mt-5 text-sm font-medium text-muted">Xenophon, Oikonomikos</p>
      </Reveal>

      {/* Start */}
      <section>
        <Reveal>
          <h2 className="two-tone text-3xl sm:text-4xl">
            Start today. <em>It costs about a cent a ticket.</em>
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Open a house", "Connect the wallet you pay from, set limits, post prices.", "/house/new"],
            ["Watch the board", "Every ticket in every house, as it happens.", "/board"],
            ["Read the rule", "The ScaleTicket specification, for builders.", "https://github.com/angelraph/scalehouse/blob/main/docs/SPEC.md"],
          ].map(([t, d, href], i) => (
            <Reveal key={t} delay={i * 90}>
              <Link href={href} className="group card flex h-full flex-col justify-between p-6 transition-shadow duration-300 hover:shadow-[var(--lift)]">
                <div className="dots mb-8 h-16 w-24 rounded-md opacity-70" />
                <div>
                  <div className="flex items-center justify-between font-semibold">
                    {t}
                    <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{d}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Big, bold geometric glyphs in the spirit of Wise's icon tiles. */
function Glyph({ kind, big }: { kind: (typeof RULES)[number][2]; big?: boolean }) {
  const s = big ? 140 : 64;
  const common = { width: s, height: s, viewBox: "0 0 64 64", "aria-hidden": true } as const;
  switch (kind) {
    case "lock":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="30" fill="var(--lime)" />
          <rect x="20" y="29" width="24" height="18" rx="4" fill="var(--forest)" />
          <path d="M25 29v-5a7 7 0 0114 0v5" stroke="var(--forest)" strokeWidth="4" fill="none" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="60" height="60" rx="18" fill="var(--forest)" />
          <path d="M12 32s7-12 20-12 20 12 20 12-7 12-20 12-20-12-20-12z" fill="var(--lime)" />
          <circle cx="32" cy="32" r="6" fill="var(--forest)" />
        </svg>
      );
    case "sum":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="30" fill="var(--bronze-wash)" />
          <path d="M20 26h24M20 38h24" stroke="var(--bronze)" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "one":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="60" height="60" rx="30" fill="var(--forest)" />
          <path d="M28 20l6-4v32" stroke="var(--lime)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="60" height="60" rx="14" fill="var(--red-wash)" />
          <rect x="20" y="20" width="24" height="24" rx="4" fill="var(--red)" />
        </svg>
      );
  }
}
