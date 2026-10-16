"use client";

import { useState } from "react";
import { siteUrl } from "@/lib/network";

/**
 * After a ticket is cut, the clerk sends the confirmer one link. Opening it shows the ticket
 * and a single "Sign my count" button: no house page, no menus.
 */
export function ShareConfirm({ ticketId, house, what, reference, amount, payee }: { ticketId: number; house: string; what: string; reference?: string; amount: string; payee: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${siteUrl}/t/${ticketId}`;
  const text = [
    "Hi! Can you confirm this for me on Scalehouse? 🙏",
    "",
    `🧾 Ticket #${ticketId} · ${house}`,
    `📦 ${what}${reference ? ` (ref: ${reference})` : ""}`,
    `💵 ${amount} to ${payee}`,
    "",
    "What to do (1 minute, free for you):",
    `1. Open this link: ${url}`,
    '2. Tap "Connect" and pick your wallet',
    '3. Check the quantity, then tap "Sign my count"',
    "",
    "Nothing gets paid until you sign. Thank you!",
  ].join("\n");

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="halftone pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60" />
      <div className="relative">
        <div className="font-semibold">Send it to the confirmer</div>
        <p className="mt-1 text-sm text-muted">They open the link, count, and tap once. Nothing is paid until they do.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
            Share on WhatsApp
          </a>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title: `Confirm ticket #${ticketId}`, text, url });
                else {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }
              } catch {
                // share sheet dismissed
              }
            }}
          >
            {copied ? "Copied ✓" : "Share or copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
