"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunAgentButton({ houseId }: { houseId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ houseId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button className="btn btn-quiet" disabled={busy} onClick={run}>
        {busy ? "Agent is reviewing…" : "Ask the agent to review"}
      </button>
      {msg && <span className="mt-1 max-w-xs text-right text-xs text-red">{msg}</span>}
    </div>
  );
}
