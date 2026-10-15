"use client";

import { useState } from "react";
import { Scramble } from "./motion/Motion";

/** The agent's three-sentence brief at the top of a house page, with a refresh. */
export function AgentBrief({ houseId, initial, at }: { houseId: number; initial: string | null; at: string | null }) {
  const [brief, setBrief] = useState(initial);
  const [when, setWhen] = useState(at);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/agent/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ houseId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setBrief(body.brief);
      setWhen(body.at);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-night p-6 text-[#e9e7d8] sm:p-8">
      <div className="dots-lime pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="live-dot" /> Your agent&apos;s brief
          {when && <span className="figure">· {new Date(when).toLocaleString()}</span>}
        </div>
        <button className="btn btn-lime h-9 px-4 text-xs" disabled={busy} onClick={refresh}>
          {busy ? "Thinking…" : brief ? "Refresh" : "Write today's brief"}
        </button>
      </div>
      <p className="relative mt-4 max-w-3xl text-lg leading-relaxed text-white sm:text-xl">
        {busy ? <Scramble text="Reading the house, the tickets and today's limits" /> : brief ?? "Ask the agent for a three-sentence brief: what you can pay today, what's waiting, and anything worth a look."}
      </p>
      {err && <p className="relative mt-2 text-sm text-[#ff8a75]">{err}</p>}
    </section>
  );
}
