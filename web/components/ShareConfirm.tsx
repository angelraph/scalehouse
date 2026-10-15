"use client";

import { useState } from "react";

/**
 * After a ticket is cut, the clerk sends the confirmer one link. Opening it shows the ticket
 * and a single "Sign my count" button: no house page, no menus.
 */
export function ShareConfirm({ ticketId, what, amount }: { ticketId: number; what: string; amount: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/t/${ticketId}` : `/t/${ticketId}`;
  const text = `Please confirm Scalehouse ticket #${ticketId}: ${what}, ${amount}. Count it yourself, then tap "Sign my count" (free): ${url}`;

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
