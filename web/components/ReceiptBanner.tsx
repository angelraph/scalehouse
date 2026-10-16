"use client";

import { useState } from "react";
import { siteUrl } from "@/lib/network";

/** The top of a paid ticket: a plain "you were paid" receipt, with one-tap sharing. */
export function ReceiptBanner(p: { ticketId: number; amount: string; payee: string; house: string; what?: string; when: string; txUrl?: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${siteUrl}/t/${p.ticketId}`;
  const text = [
    `✅ Payment sent: ${p.amount}`,
    `From: ${p.house}`,
    `To: ${p.payee}`,
    p.what ? `For: ${p.what}` : null,
    "",
    `It's already in your wallet. Receipt: ${url}`,
  ]
    .filter((x) => x !== null)
    .join("\n");

  return (
    <div className="card relative overflow-hidden border-forest p-6">
      <div className="halftone pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-50" />
      <div className="relative">
        <div className="eyebrow !text-forest">Paid ✓</div>
        <div className="figure mt-2 text-4xl">{p.amount}</div>
        <p className="mt-2 text-ink-2">
          to <strong className="figure">{p.payee}</strong> from <strong>{p.house}</strong>
          {p.what ? <> for &ldquo;{p.what}&rdquo;</> : null} · {p.when}
        </p>
        <p className="mt-1 text-sm text-muted">The money is already in their wallet. This page is the receipt anyone can check.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            Share receipt on WhatsApp
          </a>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // clipboard blocked
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy receipt link"}
          </button>
          {p.txUrl && (
            <a className="btn btn-quiet" href={p.txUrl} target="_blank" rel="noreferrer">
              See it on the explorer ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
