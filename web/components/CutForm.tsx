"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAddress, isAddress, parseEventLogs, type Abi, type Hex } from "viem";
import { useWallet } from "./Providers";
import { RequireWallet } from "./Wallet";
import { useTx } from "./useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { grossOf, money, toQty } from "@/lib/format";
import { scaleTicketAddress } from "@/lib/network";

interface Props {
  houseId: number;
  symbol: string;
  maxTicket: string;
  rates: { rateId: Hex; label: string; unitPrice: string }[];
}

export function CutForm({ houseId, symbol, maxTicket, rates }: Props) {
  const router = useRouter();
  const { address } = useWallet();
  const { send, pending, error, setError } = useTx();
  const [rateId, setRateId] = useState(rates[0].rateId);
  const [quantity, setQuantity] = useState("");
  const [payee, setPayee] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [stage, setStage] = useState<string | null>(null);

  const rate = rates.find((r) => r.rateId === rateId)!;
  const amount = useMemo(() => {
    try {
      return grossOf(toQty(quantity), BigInt(rate.unitPrice));
    } catch {
      return null;
    }
  }, [quantity, rate]);
  const overCap = amount != null && amount > BigInt(maxTicket);
  const valid = amount != null && amount > 0n && !overCap && isAddress(payee) && reference.trim().length > 0;

  async function cut() {
    setError(null);
    setStage("Saving the evidence");
    const form = new FormData();
    form.set("houseId", String(houseId));
    form.set("payee", payee);
    form.set("issuer", address ?? "");
    form.set("reference", reference);
    form.set("note", note);
    if (photo) form.set("photo", photo);
    const res = await fetch("/api/evidence", { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok) {
      setStage(null);
      setError(body.error);
      return;
    }

    setStage(null);
    const receipt = await send("Cutting the ticket", {
      address: scaleTicketAddress,
      abi: scaleTicketAbi as Abi,
      functionName: "cut",
      args: [BigInt(houseId), getAddress(payee), rateId, toQty(quantity), body.evidenceHash as Hex],
    });
    if (!receipt) return;
    const [ev] = parseEventLogs({ abi: scaleTicketAbi, logs: receipt.logs, eventName: "TicketCut" });
    router.push(`/t/${ev.args.ticketId}`);
  }

  return (
    <RequireWallet why="Connect your clerk wallet for this house.">
      <div className="card space-y-5 p-6">
        <div>
          <label className="label" htmlFor="rate">What</label>
          <select id="rate" className="field" value={rateId} onChange={(e) => setRateId(e.target.value as Hex)}>
            {rates.map((r) => (
              <option key={r.rateId} value={r.rateId}>
                {r.label} at {money(BigInt(r.unitPrice), symbol)} per unit
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="qty">How many (as counted by you)</label>
          <input id="qty" className="field figure" inputMode="decimal" placeholder="e.g. 10 or 2.5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="payee">Who gets paid (their wallet)</label>
          <input id="payee" className="field figure" placeholder="0x…" value={payee} onChange={(e) => setPayee(e.target.value.trim())} />
          <p className="mt-1 text-xs text-muted">Check it twice. This wallet is locked onto the ticket and can&apos;t be changed later by anyone.</p>
        </div>
        <div>
          <label className="label" htmlFor="ref">Reference</label>
          <input id="ref" className="field" placeholder="Invoice, delivery note or job number" value={reference} onChange={(e) => setReference(e.target.value)} />
          <p className="mt-1 text-xs text-muted">The same reference from the same payee can only be ticketed once.</p>
        </div>
        <div>
          <label className="label" htmlFor="note">Note (optional)</label>
          <textarea id="note" className="field" rows={2} placeholder="e.g. 10 bags, two slightly torn" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="photo">Photo (optional)</label>
          <input id="photo" type="file" accept="image/*" capture="environment" className="text-sm" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-muted">Photos are public on the board. Don&apos;t include faces or personal details.</p>
        </div>

        <div className="flex items-baseline justify-between border-t border-rule pt-4">
          <span className="text-muted">The rule will pay</span>
          <span className={`figure text-2xl ${overCap ? "text-red" : ""}`}>{amount != null ? money(amount, symbol) : "—"}</span>
        </div>
        {overCap && <p className="text-sm text-red">That&apos;s above this house&apos;s limit of {money(BigInt(maxTicket), symbol)} per ticket. Split it or ask the owner.</p>}

        <button className="btn w-full" disabled={!valid || !!pending || !!stage} onClick={cut}>
          {stage ?? pending ?? "Cut the ticket"}
        </button>
        {error && <p className="text-sm text-red">{error}</p>}
      </div>
    </RequireWallet>
  );
}
