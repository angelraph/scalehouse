import Link from "next/link";
import { LiveTicket, type LiveTicketData } from "@/components/LiveTicket";
import { Marquee } from "@/components/Marquee";
import { MoneyFlow, type FlowData } from "@/components/MoneyFlow";
import { Reveal } from "@/components/Reveal";
import { Stamp } from "@/components/Stamp";
import { UseCases } from "@/components/UseCases";
import { DotField } from "@/components/motion/DotField";
import { DotChart, LayerStack, Scramble } from "@/components/motion/Motion";
import { StickySteps, type StepTicket } from "@/components/motion/StickySteps";
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

const STACK = [
  { name: "Your business", note: "Owner, clerks and witnesses" },
  { name: "Scalehouse agent", note: "Decides when to pay, explains why" },
  { name: "ScaleTicket contract", note: "Decides what is owed, and to whom" },
  { name: "USDC and EURC by Circle", note: "Money that settles like a message" },
  { name: `Arc`, note: "Stablecoin-native chain, sub-second finality" },
];

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
  const step: StepTicket | null = hero
    ? {
        id: hero.id,
        payee: short(hero.payee),
        quantity: qty(hero.quantity),
        witnessed: hero.confirmedQuantity ? qty(hero.confirmedQuantity) : "—",
        price: money(hero.unitPrice),
        amount: money(grossOf(hero.confirmedQuantity || hero.quantity, hero.unitPrice)),
        status: hero.status,
      }
    : null;

  return (
    <div className="space-y-28 sm:space-y-32">
      {/* Hero: Column's dot-matrix world, flowing in brand colors, with the real money flow on top */}
      <section className="relative isolate pt-4 lg:pt-10">
        <div className="pointer-events-none absolute top-[-1.5rem] left-1/2 -z-10 h-[calc(100%+6rem)] w-screen -translate-x-1/2">
          <DotField />
          {/* Keep the headline side clean, let the world show on the right, fade into the page below. */}
          <div className="hero-fade absolute inset-0" />
        </div>
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <span className="tag">Evidence-locked payments on {chain.name}</span>
            <h1 className="display mt-6 text-[2.75rem] sm:text-7xl lg:text-[5.6rem]">
              Weighed in public.
              <br />
              <span className="italic text-forest">Paid once.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
              <span className="text-ink">Spending limits stop an AI agent overspending. They don&apos;t stop it paying the wrong person.</span>{" "}
              Scalehouse locks every payment to its evidence: the payee is fixed when the ticket is cut, a second person counts, and a
              contract pays once, or freezes in public.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/house/new" className="btn">
                Open a house
                <span aria-hidden>→</span>
              </Link>
              <Link href="/board" className="btn btn-quiet bg-sheet/70 backdrop-blur">
                See every ticket
              </Link>
            </div>
          </Reveal>
          <MoneyFlow f={flow} />
        </div>
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

      {/* Figures over Column's rising dot chart */}
      <section className="relative">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <span className="tag">On the chain right now</span>
            <h2 className="two-tone mt-5 max-w-xl text-3xl sm:text-4xl">
              Every ticket is public. <em>Paid, waiting, refused or frozen, with the reason, read straight from the contract.</em>
            </h2>
          </Reveal>
          <DotChart className="h-44 sm:h-56" />
        </div>
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-rule lg:grid-cols-4">
          {[
            ["Paid out", stats ? money(stats.paidVolume) : "—", stats ? `${stats.paid} tickets` : ""],
            ["People paid", stats ? String(stats.payees) : "—", "distinct wallets"],
            ["Refused or frozen", stats ? String(stats.refusals ?? stats.frozenNow) : "—", "each one on the board"],
            ["Houses", stats ? String(stats.houses) : "—", "businesses paying through Scalehouse"],
          ].map(([k, v, s], i) => (
            <Reveal key={k} delay={i * 90} className="bg-paper p-6 sm:p-8">
              <Scramble text={v} className="figure block text-3xl tracking-tight sm:text-4xl" />
              <div className="mt-3 text-sm font-medium">{k}</div>
              <div className="text-xs text-muted">{s}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* A real ticket as the case study, over a gold halftone (Column's Brex card) */}
      <section className="relative overflow-hidden rounded-[32px] bg-sheet p-6 shadow-[var(--ring)] sm:p-10">
        <div className="halftone pointer-events-none absolute inset-y-0 right-0 w-2/3" />
        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <span className="tag">A real ticket</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Every payment has a receipt anyone can check</h2>
            <p className="mt-4 max-w-md text-muted">
              Who was paid, how much, who counted, and why the agent released it. Read from {chain.name}, with the agent&apos;s
              reasoning checked against the hash it put on-chain.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              {["Payee locked", "Second witness", "Paid once", "Reasoning on record"].map((x) => (
                <span key={x} className="rounded-full bg-paper-2 px-3 py-1.5 text-ink-2">
                  {x}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={150}>
            <LiveTicket t={toLive(hero)} network={chain.name} />
          </Reveal>
        </div>
      </section>

      {/* Limits vs evidence: the positioning, side by side */}
      <section>
        <Reveal>
          <span className="tag">Why not just limits?</span>
          <h2 className="two-tone mt-5 max-w-3xl text-3xl sm:text-4xl">
            A budget answers &ldquo;how much&rdquo;. <em>Scalehouse also answers &ldquo;to whom, for what, and did it really arrive&rdquo;.</em>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Reveal className="tile p-7">
            <div className="eyebrow !text-muted">Agent with spending limits</div>
            <ul className="mt-4 space-y-3 text-ink-2">
              {[
                "Stops it spending more than $X a day",
                "Pays any allowed wallet the agent names",
                "Pays an invoice twice if it's presented twice",
                "Can't tell 10 bags delivered from 12 claimed",
              ].map((x, i) => (
                <li key={x} className="flex gap-3">
                  <span className={i === 0 ? "text-forest" : "text-red"}>{i === 0 ? "✓" : "✕"}</span>
                  {x}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120} className="relative overflow-hidden rounded-[32px] bg-forest p-7 text-[#eaf3e6]">
            <div className="dots-lime pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative">
              <div className="eyebrow !text-lime">Scalehouse</div>
              <ul className="mt-4 space-y-3">
                {[
                  "Daily, per-ticket and per-person limits too",
                  "Pays only the wallet locked on the ticket",
                  "One document, one ticket, paid once",
                  "A second person counts; the AI reads the invoice and flags overcharges",
                ].map((x) => (
                  <li key={x} className="flex gap-3">
                    <span className="text-lime">✓</span>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
        <Reveal className="mt-6 flex flex-col items-start justify-between gap-4 rounded-[24px] border border-rule-strong p-6 sm:flex-row sm:items-center">
          <p className="text-ink-2">
            <strong className="text-ink">Don&apos;t take our word for it.</strong> Hide an instruction in an invoice, hijack the agent, try to pay twice. Six real attacks, live on testnet.
          </p>
          <a href="https://scalehouse-testnet.vercel.app/attack" className="btn shrink-0">Try to trick the agent →</a>
        </Reveal>
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
            <Reveal key={title} delay={i * 80} className={`tile group flex min-h-64 flex-col justify-between p-7 transition-transform duration-500 hover:-translate-y-1 ${i === 0 ? "lg:row-span-2 lg:min-h-0" : ""}`}>
              <div className="transition-transform duration-500 group-hover:scale-105">
                <Glyph kind={glyph} big={i === 0} />
              </div>
              <div>
                <div className="figure text-xs text-bronze">0{i + 1}</div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Dark band: the stack, then the sticky walk-through */}
      <section id="how" className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-24 overflow-x-clip bg-night text-[#e9e7d8]">
        <div className="dots-lime pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <span className="tag !bg-white/10 !text-lime">Infrastructure</span>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Built in layers that check each other</h2>
              <p className="mt-4 max-w-md text-white/65">
                The agent sits between your business and the contract. It can decide when money moves, never how much or to
                whom. Under it, Circle&apos;s stablecoins settle on Arc in under a second, for about a cent.
              </p>
            </Reveal>
            <LayerStack layers={STACK} />
          </div>

          <div className="mt-24">
            <Reveal>
              <span className="tag !bg-white/10 !text-lime">How a ticket moves</span>
              <h2 className="two-tone mt-5 max-w-2xl text-3xl text-white sm:text-4xl">
                Four people, one rule. <em className="!text-white/50">Scroll through a real ticket.</em>
              </h2>
            </Reveal>
            <div className="mt-6">
              <StickySteps t={step} />
            </div>
          </div>
        </div>
      </section>

      {/* Use cases: Column's big switching list with pixel-dot art */}
      <section>
        <Reveal>
          <span className="tag">Who it&apos;s for</span>
        </Reveal>
        <div className="mt-8">
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
            ["Read the docs", "Roles, the agent, the contract, step by step.", "/docs"],
          ].map(([t, d, href], i) => (
            <Reveal key={t} delay={i * 90}>
              <Link href={href} className="group card flex h-full flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--lift)]">
                <div className="dots mb-8 h-16 w-24 rounded-md opacity-70 transition-opacity group-hover:opacity-100" />
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
