"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Address, Hex } from "viem";
import { useWallet } from "./Providers";
import { RequireWallet } from "./Wallet";
import { qty, toQty } from "@/lib/format";
import { confirmTypedData } from "@/lib/typed";

/**
 * The witness counts the goods (or checks the work) and signs what they counted. Signing is
 * free; the agent's wallet submits it. If their count is outside the house's tolerance the
 * ticket freezes instead of paying.
 */
export function WitnessPanel(props: { ticketId: number; houseId: number; claimed: string; payee: Address; evidenceHash: Hex }) {
  const router = useRouter();
  const { address, wallet } = useWallet();
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    let observed: bigint;
    try {
      observed = toQty(count);
    } catch (e) {
      setMsg({ tone: "text-frozen", text: (e as Error).message });
      return;
    }
    setBusy(true);
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const typed = confirmTypedData({
        ticketId: BigInt(props.ticketId),
        observedQuantity: observed,
        payee: props.payee,
        evidenceHash: props.evidenceHash,
        deadline,
      });
      const signature = await wallet().signTypedData({ account: address!, ...typed });
      const res = await fetch("/api/relay/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: props.ticketId,
          observedQuantity: observed.toString(),
          witness: address,
          deadline: deadline.toString(),
          signature,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Confirmation failed");
      setMsg(
        body.result === "frozen"
          ? { tone: "text-frozen", text: "Your count is outside the allowed difference, so the ticket froze. The owner will review it." }
          : { tone: "text-paid", text: "Confirmed. The agent is reviewing it for payment now." },
      );
      router.refresh();
    } catch (e) {
      setMsg({ tone: "text-frozen", text: (e as Error).message.split("\n")[0] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet p-5">
      <h2 className="mb-1 font-serif text-xl font-bold">Witness this ticket</h2>
      <p className="mb-4 text-sm text-ink-soft">
        Count it yourself and enter what you counted, not what the ticket says. The ticket claims{" "}
        <span className="figure">{qty(BigInt(props.claimed))}</span>. Signing costs nothing.
      </p>
      <RequireWallet why="Connect the witness wallet for this house.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="field figure" inputMode="decimal" placeholder="What you counted" value={count} onChange={(e) => setCount(e.target.value)} />
          <button className="btn shrink-0" disabled={busy || !count} onClick={submit}>
            {busy ? "Signing…" : "Sign my count"}
          </button>
        </div>
      </RequireWallet>
      {msg && <p className={`mt-3 text-sm ${msg.tone}`}>{msg.text}</p>}
    </div>
  );
}
