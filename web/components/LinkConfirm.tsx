"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { qty, toQty } from "@/lib/format";

/** One-tap confirm for a link confirmer. "Count is different?" lets them record what they found. */
export function LinkConfirm({ token, ticketId, quantity }: { token: string; ticketId: number; quantity: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [differs, setDiffers] = useState(false);
  const [count, setCount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function confirm(observed: bigint) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/confirmers/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ticketId, observedQuantity: observed.toString() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't confirm");
      setMsg(
        body.result === "frozen"
          ? { ok: false, text: "Your count didn't match, so the payment is on hold for the owner to review." }
          : { ok: true, text: "Confirmed ✓ The agent is paying now. This usually takes under a minute." },
      );
      setTimeout(() => router.refresh(), 4000);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (msg?.ok) return <p className="mt-4 font-semibold text-forest">{msg.text}</p>;

  return (
    <div className="mt-4">
      {!differs ? (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={busy} onClick={() => confirm(BigInt(quantity))}>
            {busy ? "Confirming…" : "Confirm"}
          </button>
          <button className="text-sm underline opacity-70" disabled={busy} onClick={() => setDiffers(true)}>
            Count is different?
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field figure w-40"
            inputMode="decimal"
            placeholder={`You found (recorded ${qty(BigInt(quantity))})`}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            aria-label="Quantity you found"
          />
          <button
            className="btn"
            disabled={busy || !count.trim()}
            onClick={() => {
              try {
                confirm(toQty(count));
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message });
              }
            }}
          >
            {busy ? "Saving…" : "Submit my count"}
          </button>
          <button className="text-sm underline opacity-70" onClick={() => setDiffers(false)}>
            Cancel
          </button>
        </div>
      )}
      {msg && !msg.ok && <p className="mt-2 text-sm text-red">{msg.text}</p>}
    </div>
  );
}
