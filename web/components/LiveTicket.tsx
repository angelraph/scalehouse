"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface LiveTicketData {
  id: number;
  house: string;
  payee: string;
  quantity: string;
  witnessed: string | null;
  price: string;
  amount: string;
  status: "Open" | "Confirmed" | "Paid" | "Frozen" | "Voided";
  cutAt: string;
  settledAt: string | null;
  freezeText: string | null;
}

/**
 * A real ticket read from the chain, replayed step by step: the Column hero device (a product
 * card showing real amounts) with the stamp landing at the end.
 */
export function LiveTicket({ t, network }: { t: LiveTicketData | null; network: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!t) return;
    const timers = [1, 2, 3, 4].map((s) => setTimeout(() => setStep(s), 500 + s * 650));
    return () => timers.forEach(clearTimeout);
  }, [t]);

  if (!t) {
    return (
      <div className="card p-6">
        <div className="eyebrow mb-2">The first ticket</div>
        <p className="text-muted">No tickets have been cut on {network} yet. The first one will appear here, live.</p>
      </div>
    );
  }

  const rows: { k: string; v: string; at: number }[] = [
    { k: "Cut, payee locked", v: t.payee, at: 1 },
    { k: "Witness counted", v: t.witnessed ?? "waiting", at: 2 },
    { k: "Rule computes", v: `${t.witnessed ?? t.quantity} × ${t.price}`, at: 3 },
  ];
  const final = t.status === "Paid" ? "paid" : t.status === "Frozen" ? "frozen" : "waiting";

  return (
    <Link href={`/t/${t.id}`} className="group card block overflow-hidden transition-shadow duration-300 hover:shadow-[var(--lift)]">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3">
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className="live-dot" /> Live from {network}
        </span>
        <span className="figure text-xs text-muted">{t.house}</span>
      </div>
      <div className="px-5 pt-5">
        <div className="flex items-baseline justify-between">
          <span className="figure text-sm text-muted">Ticket #{t.id}</span>
          <span className="figure text-xs text-faint">{t.cutAt}</span>
        </div>
        <div className="figure mt-2 text-4xl tracking-tight">{t.amount}</div>
      </div>
      <ol className="mt-4 space-y-0 px-5">
        {rows.map((r) => (
          <li
            key={r.k}
            className="flex items-center justify-between gap-4 border-t border-rule py-3 text-sm transition-all duration-700"
            style={{ opacity: step >= r.at ? 1 : 0.15, transform: step >= r.at ? "none" : "translateY(6px)" }}
          >
            <span className="flex items-center gap-2 text-muted">
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] ${step >= r.at ? "bg-forest text-lime" : "bg-rule"}`}>✓</span>
              {r.k}
            </span>
            <span className="figure truncate">{r.v}</span>
          </li>
        ))}
      </ol>
      <div className="relative mt-2 flex min-h-24 items-center justify-between border-t border-rule bg-paper-2 px-5 py-4">
        <span className="text-sm text-muted">{final === "frozen" && t.freezeText ? t.freezeText : "Outcome on-chain"}</span>
        {step >= 4 && (
          <span
            className={`stamp-in rounded-md border-2 px-3 py-1 font-mono text-sm tracking-[0.15em] uppercase ${
              final === "paid" ? "border-forest text-forest" : final === "frozen" ? "border-red text-red" : "border-bronze text-bronze"
            }`}
          >
            {final === "paid" ? `Paid · ${t.settledAt}` : final}
          </span>
        )}
      </div>
    </Link>
  );
}
