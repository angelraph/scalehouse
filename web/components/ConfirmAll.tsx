"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { useWallet } from "./Providers";
import { scaleTicketAbi } from "@/lib/abi";
import { qty } from "@/lib/format";
import { scaleTicketAddress } from "@/lib/network";
import { confirmTypedData } from "@/lib/typed";

type Open = { id: number; quantity: string; payee: Address; payeeLabel: string; evidenceHash: Hex };
const ROLE_WITNESS = 2;

/**
 * For a witness with several tickets waiting: confirm them all in one go, each at the claimed
 * quantity. Every ticket still gets its own signature (the wallet asks once per ticket), and the
 * agent relays them, so it stays free.
 */
export function ConfirmAll({ houseId, open }: { houseId: number; open: Open[] }) {
  const router = useRouter();
  const { address, wallet, publicClient } = useWallet();
  const [isWitness, setIsWitness] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!address) return setIsWitness(false);
    publicClient
      .readContract({ address: scaleTicketAddress, abi: scaleTicketAbi, functionName: "roles", args: [BigInt(houseId), address] })
      .then((r) => setIsWitness((Number(r) & ROLE_WITNESS) !== 0))
      .catch(() => setIsWitness(false));
  }, [address, houseId, publicClient]);

  if (!isWitness || open.length === 0) return null;

  async function run() {
    setBusy(true);
    setLog([]);
    for (const t of open) {
      try {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const observed = BigInt(t.quantity);
        const typed = confirmTypedData({ ticketId: BigInt(t.id), observedQuantity: observed, payee: t.payee, evidenceHash: t.evidenceHash, deadline });
        const signature = await wallet().signTypedData({ account: address!, ...typed });
        const res = await fetch("/api/relay/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: t.id, observedQuantity: observed.toString(), witness: address, deadline: deadline.toString(), signature }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "failed");
        setLog((l) => [...l, `✓ #${t.id} confirmed (${t.payeeLabel})`]);
      } catch (e) {
        setLog((l) => [...l, `✕ #${t.id}: ${(e as Error).message.split("\n")[0]}`]);
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card mb-6 border-forest p-5">
      <div className="font-semibold">
        {open.length} ticket{open.length > 1 ? "s" : ""} waiting for you to confirm
      </div>
      <p className="mt-1 text-sm text-muted">
        Checked them all? Confirm each at the amount recorded. Your wallet asks you to sign once per ticket. It&apos;s free.
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {open.map((t) => (
          <li key={t.id}>
            #{t.id} · {qty(BigInt(t.quantity))} · {t.payeeLabel}
          </li>
        ))}
      </ul>
      <button className="btn mt-4" disabled={busy} onClick={run}>
        {busy ? "Confirming…" : `Confirm all ${open.length}`}
      </button>
      {log.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {log.map((l, i) => (
            <li key={i} className={l.startsWith("✓") ? "text-forest" : "text-red"}>
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
