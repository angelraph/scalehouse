"use client";

import { useEffect, useRef, useState } from "react";
import { Scramble, TypeLines } from "./Motion";

export interface StepTicket {
  id: number;
  payee: string;
  quantity: string;
  witnessed: string;
  price: string;
  amount: string;
  status: string;
}

const STEPS = [
  {
    who: "Clerk",
    title: "Cut the ticket",
    body: "What arrived, how many, at which posted price, and the wallet that gets paid. From this moment the payee and the price are locked.",
    code: [
      { text: "cut(house, ", cls: "text-white/70" },
      { text: "payee", cls: "text-lime" },
      { text: ", rate, quantity, evidence)\n", cls: "text-white/70" },
      { text: "→ TicketCut", cls: "text-lime" },
    ],
  },
  {
    who: "Check",
    title: "A second check",
    body: "Small payments: an automatic check signs once the wallet screens clear and it fits your rule. Bigger ones: a person you trust taps Confirm on a link. Free, no wallet. A count that doesn't match freezes the ticket.",
    code: [
      { text: "confirmBySig(ticket, ", cls: "text-white/70" },
      { text: "counted", cls: "text-lime" },
      { text: ", witness, sig)\n", cls: "text-white/70" },
      { text: "→ TicketConfirmed", cls: "text-lime" },
    ],
  },
  {
    who: "Agent",
    title: "Decide, and say why",
    body: "The agent screens the payee, reads the house's balance and limits, chooses what to pay first, and stores its reasoning with a hash on-chain.",
    code: [
      { text: "screen_counterparty(payee)  ", cls: "text-white/70" },
      { text: "// clear\n", cls: "text-white/40" },
      { text: "get_position()              ", cls: "text-white/70" },
      { text: "// within today's limit\n", cls: "text-white/40" },
      { text: "release_ticket(id, payee, amount, why)", cls: "text-lime" },
    ],
  },
  {
    who: "Contract",
    title: "Check, then pay once",
    body: "ScaleTicket recomputes the amount and checks the payee itself. Match: the money moves wallet to wallet. Mismatch: the ticket freezes, in public.",
    code: [
      { text: "payee  == ticket.payee\n", cls: "text-white/70" },
      { text: "amount == counted × price\n", cls: "text-white/70" },
      { text: "→ TicketReleased", cls: "text-lime" },
    ],
  },
];

/**
 * Column's sticky product walk-through (1:03–1:18): steps scroll on the left while a pinned
 * panel on the right changes to match, here filled with a real ticket from the chain.
 */
export function StickySteps({ t }: { t: StepTicket | null }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        {STEPS.map((s, i) => (
          <div
            key={s.who}
            data-i={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="border-t border-white/10 py-10 transition-opacity duration-500 lg:min-h-[52vh]"
            style={{ opacity: active === i ? 1 : 0.35 }}
          >
            <div className="eyebrow !text-lime">
              0{i + 1} · {s.who}
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-white">{s.title}</h3>
            <p className="mt-2 max-w-md text-white/65">{s.body}</p>
            <TypeLines lines={s.code} className="figure mt-5 overflow-x-auto rounded-xl bg-night-2 p-4 text-[0.78rem] leading-6 ring-1 ring-white/10" />
            {/* On phones the pinned panel isn't shown, so each step carries its own card. */}
            <div className="mt-5 lg:hidden">
              <Panel i={i} t={t} />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <div className="relative grid h-[min(440px,calc(100vh-8rem))] place-items-center overflow-hidden rounded-3xl bg-night-2 ring-1 ring-white/10">
            <div className="dots-lime pointer-events-none absolute inset-0 opacity-40" />
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="absolute w-[78%] transition-all duration-700"
                style={{
                  opacity: active === i ? 1 : 0,
                  transform: active === i ? "none" : `translateY(${i < active ? -18 : 18}px) scale(0.97)`,
                  filter: active === i ? "none" : "blur(6px)",
                }}
              >
                <Panel i={i} t={t} />
              </div>
            ))}
            <div className="absolute bottom-0 inset-x-0 grid grid-cols-4 border-t border-white/10 text-center text-xs">
              {STEPS.map((s, i) => (
                <div key={s.who} className={`py-3 transition-colors duration-500 ${active === i ? "text-lime" : "text-white/35"}`}>
                  {s.who}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ i, t }: { i: number; t: StepTicket | null }) {
  const id = t ? `#${t.id}` : "#—";
  const rows: [string, string][][] = [
    [
      ["Ticket", id],
      ["Quantity", t?.quantity ?? "—"],
      ["Posted price", t?.price ?? "—"],
      ["Payee", `${t?.payee ?? "—"} 🔒`],
    ],
    [
      ["Claimed", t?.quantity ?? "—"],
      ["Witness counted", t?.witnessed ?? "—"],
      ["Signature", "free, no gas"],
    ],
    [
      ["Screening", "clear"],
      ["Within limits", t?.status === "Paid" ? "yes" : "checked"],
      ["Decision", t?.status === "Paid" ? "pay now" : t?.status === "Frozen" ? "asked to pay" : "waiting"],
    ],
    [
      ["Payee matches", t?.status === "Frozen" ? "checked" : "yes"],
      ["Amount matches", t?.status === "Frozen" ? "checked" : "yes"],
      ["Result", t?.status === "Paid" ? "released" : t?.status === "Frozen" ? "frozen" : "pending"],
    ],
  ];
  return (
    <div className="rounded-2xl bg-[#f8f6ea] p-5 text-ink shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{["Cut", "Witnessed", "Agent", "On-chain"][i]}</span>
        <span className="figure">Ticket {id}</span>
      </div>
      <div className="figure mt-2 text-3xl tracking-tight">{t ? <Scramble text={t.amount} /> : "—"}</div>
      <dl className="mt-3 divide-y divide-rule text-sm">
        {rows[i].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-2">
            <dt className="text-muted">{k}</dt>
            <dd className="figure">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
