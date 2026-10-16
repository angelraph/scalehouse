"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAddress, isAddress, parseEventLogs, type Abi, type Address, type Hex } from "viem";
import { useWallet } from "./Providers";
import { useTx } from "./useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { money, rateIdOf, short, toUnits } from "@/lib/format";
import { scaleTicketAddress } from "@/lib/network";

const ROLE_ISSUER = 1;
const st = { address: scaleTicketAddress, abi: scaleTicketAbi as Abi };

/**
 * The owner's one-box way to pay someone: who, how much, what for. Behind the scenes it posts a
 * fixed price for that amount (once), makes sure the owner can record, and cuts the ticket.
 * Then it opens the ticket, whose top card sends the confirm link. The second person still has
 * to confirm: that rule is the product.
 */
export function QuickPay({ houseId, owner, symbol, maxTicket }: { houseId: number; owner: Address; symbol: string; maxTicket: string }) {
  const router = useRouter();
  const { address, publicClient } = useWallet();
  const { send, pending, error, setError } = useTx();
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [stage, setStage] = useState<string | null>(null);

  if (!address || address.toLowerCase() !== owner.toLowerCase()) {
    return (
      <p className="card p-4 text-sm text-muted">
        Is this your house?{" "}
        {address ? `You're connected as ${short(address)}. Switch your wallet to the owner account ${short(owner)}` : `Connect the owner wallet ${short(owner)}`} to pay someone from here.
      </p>
    );
  }

  let units: bigint | null = null;
  try {
    units = amount.trim() ? toUnits(amount) : null;
  } catch {
    units = null;
  }
  const overCap = units != null && units > BigInt(maxTicket);
  const valid = units != null && units > 0n && !overCap && isAddress(payee.trim()) && what.trim().length > 0;

  async function pay() {
    setError(null);
    const h = BigInt(houseId);
    const to = getAddress(payee.trim());
    const label = `Payment of ${amount.trim()} ${symbol}`;
    const rateId = rateIdOf(label);

    // 1. A fixed price for this amount, posted once and reused next time.
    setStage("Checking the price");
    const r = (await publicClient.readContract({ ...st, functionName: "rates", args: [h, rateId] })) as readonly [bigint, bigint, boolean];
    if (!(r[2] && r[0] === units && Number(r[1]) > Date.now() / 1000 + 86400)) {
      setStage(null);
      const ok = await send("Setting the amount (once)", { ...st, functionName: "setRate", args: [h, rateId, units!, BigInt(Math.floor(Date.now() / 1000) + 365 * 86400), true, label] });
      if (!ok) return;
    }

    // 2. The owner records it themselves.
    const roles = Number(await publicClient.readContract({ ...st, functionName: "roles", args: [h, address!] }));
    if ((roles & ROLE_ISSUER) === 0) {
      const ok = await send("Letting you record payments (once)", { ...st, functionName: "setRoles", args: [h, address!, roles | ROLE_ISSUER] });
      if (!ok) return;
    }

    // 3. Save what it's for, then cut the ticket. The payee is locked here.
    setStage("Saving the details");
    const form = new FormData();
    form.set("houseId", String(houseId));
    form.set("payee", to);
    form.set("issuer", address!);
    form.set("reference", `${what.trim()} · ${new Date().toISOString().slice(0, 16)}`);
    form.set("note", what.trim());
    const res = await fetch("/api/evidence", { method: "POST", body: form });
    const body = await res.json();
    setStage(null);
    if (!res.ok) return setError(body.error);

    const receipt = await send("Creating the payment", { ...st, functionName: "cut", args: [h, to, rateId, 1000n, body.evidenceHash as Hex] });
    if (!receipt) return;
    const [ev] = parseEventLogs({ abi: scaleTicketAbi, logs: receipt.logs, eventName: "TicketCut" });
    router.push(`/t/${ev.args.ticketId}?new=1`);
  }

  const busy = !!pending || !!stage;
  return (
    <section className="card border-forest p-6">
      <h2 className="display text-2xl">Pay someone</h2>
      <p className="mt-1 text-sm text-muted">Fill three boxes and tap once. Then send the confirm link to your second person. The agent pays when they confirm.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <input className="field figure" placeholder="Their wallet address 0x…" value={payee} onChange={(e) => setPayee(e.target.value)} aria-label="Their wallet address" />
        <input className="field figure" placeholder={`Amount in ${symbol}, e.g. 0.10`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
      </div>
      <input className="field mt-3 w-full" placeholder="What it's for, e.g. Tester thank-you, Chidi" value={what} onChange={(e) => setWhat(e.target.value)} aria-label="What it's for" />
      {overCap && <p className="mt-2 text-sm text-red">The most one payment can be is {money(BigInt(maxTicket), symbol)}. Raise it under Limits below.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn" disabled={!valid || busy} onClick={pay}>
          {stage ? `${stage}…` : pending ? `${pending}…` : "Pay"}
        </button>
        {error && <span className="text-sm text-red">{error}</span>}
      </div>
    </section>
  );
}
