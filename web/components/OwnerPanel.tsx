"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAddress, isAddress, keccak256, toBytes, type Abi, type Address } from "viem";
import { useWallet } from "./Providers";
import { useTx } from "./useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { money, rateIdOf, toUnits } from "@/lib/format";
import { labelMessage } from "@/lib/messages";
import { agentAddress, scaleTicketAddress } from "@/lib/network";
import { REASON_TEXT, type ReasonName } from "@/lib/types";

const approveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const satisfies Abi;

interface Props {
  houseId: number;
  owner: Address;
  token: Address;
  symbol: string;
  agentAppointed: boolean;
  paused: boolean;
  limits: { maxTicket: string; dailyCap: string; toleranceBps: number };
  frozen: { id: number; reason: ReasonName | null }[];
}

/** Everything only the house owner can do. Rendered for everyone, shown only to the owner. */
export function OwnerPanel(p: Props) {
  const { address } = useWallet();
  if (!address || address.toLowerCase() !== p.owner.toLowerCase()) return null;
  return <Panel {...p} />;
}

function Panel(p: Props) {
  const router = useRouter();
  const { send, pending, error } = useTx();
  const { address, wallet } = useWallet();
  const [note, setNote] = useState<string | null>(null);
  const h = BigInt(p.houseId);
  const st = { address: scaleTicketAddress, abi: scaleTicketAbi as Abi };

  const done = (text: string) => {
    setNote(text);
    router.refresh();
  };

  async function nameWallet(addr: Address, label: string) {
    const signature = await wallet().signMessage({ account: address!, message: labelMessage(p.houseId, addr, label) });
    const res = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ houseId: p.houseId, address: addr, label, signature }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl font-bold">Owner controls</h2>
        <span className="text-xs text-ink-soft">Only your wallet sees this</span>
      </div>
      {pending && <p className="text-sm text-waiting">{pending}…</p>}
      {error && <p className="text-sm text-frozen">{error}</p>}
      {note && !pending && !error && <p className="text-sm text-paid">✓ {note}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {!p.agentAppointed && (
          <Card title="Appoint the Scalehouse agent">
            <button
              className="btn"
              onClick={async () => (await send("Appointing the agent", { ...st, functionName: "setAgent", args: [h, agentAddress] })) && done("Agent appointed")}
            >
              Appoint agent
            </button>
          </Card>
        )}

        <PriceForm
          onSubmit={async (label, price, days) => {
            const validUntil = BigInt(Math.floor(Date.now() / 1000) + days * 86400);
            const r = await send("Posting the price", { ...st, functionName: "setRate", args: [h, rateIdOf(label), toUnits(price), validUntil, true, label] });
            if (r) done(`Posted "${label}" at ${price} ${p.symbol}`);
          }}
          symbol={p.symbol}
        />

        <TeamForm
          onSubmit={async (who, label, clerk, witness) => {
            const roles = (clerk ? 1 : 0) | (witness ? 2 : 0);
            const r = await send("Updating the team", { ...st, functionName: "setRoles", args: [h, who, roles] });
            if (!r) return;
            if (label) await nameWallet(who, label).catch((e) => setNote(`Role set, but naming failed: ${(e as Error).message}`));
            done(roles ? `${label || who} can now ${[clerk && "cut tickets", witness && "witness tickets"].filter(Boolean).join(" and ")}` : "Removed from the team");
          }}
        />

        <NameForm
          onSubmit={async (who, label) => {
            try {
              await nameWallet(who, label);
              done(`Named ${label}`);
            } catch (e) {
              setNote((e as Error).message);
            }
          }}
        />

        <Card title="Budget">
          <p className="mb-3 text-sm text-ink-soft">How much Scalehouse may pay out of your wallet in total. Payments use it up; top it up when it runs low.</p>
          <AmountRow
            label={`New budget (${p.symbol})`}
            action="Approve"
            onSubmit={async (amt) => (await send("Approving the budget", { address: p.token, abi: approveAbi, functionName: "approve", args: [scaleTicketAddress, toUnits(amt)] })) && done(`Budget set to ${amt} ${p.symbol}`)}
          />
        </Card>

        <LimitsForm
          current={p.limits}
          symbol={p.symbol}
          onSubmit={async (maxT, cap, tolPct) => {
            const r = await send("Updating limits", { ...st, functionName: "setLimits", args: [h, toUnits(maxT), toUnits(cap), Math.round(Number(tolPct) * 100)] });
            if (r) done("Limits updated");
          }}
        />

        <Card title={p.paused ? "Payments are paused" : "Pause payments"}>
          <p className="mb-3 text-sm text-ink-soft">Stops all tickets in this house from paying until you resume. Nothing is lost.</p>
          <button
            className="btn btn-quiet"
            onClick={async () => (await send(p.paused ? "Resuming" : "Pausing", { ...st, functionName: "setHousePaused", args: [h, !p.paused] })) && done(p.paused ? "Resumed" : "Paused")}
          >
            {p.paused ? "Resume payments" : "Pause payments"}
          </button>
        </Card>

        {p.frozen.length > 0 && (
          <Card title="Frozen tickets to review">
            <div className="space-y-3">
              {p.frozen.map((f) => (
                <div key={f.id} className="rounded border border-rule p-3 text-sm">
                  <div className="figure mb-1">Ticket #{f.id}</div>
                  {f.reason && <p className="mb-2 text-frozen">{REASON_TEXT[f.reason]}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-quiet"
                      onClick={async () => (await send("Reopening", { ...st, functionName: "reopen", args: [BigInt(f.id), keccak256(toBytes("owner reopened for a fresh count"))] })) && done(`Ticket #${f.id} reopened for a fresh count`)}
                    >
                      Reopen for a fresh count
                    </button>
                    <button
                      className="btn btn-quiet"
                      onClick={async () => (await send("Voiding", { ...st, functionName: "voidTicket", args: [BigInt(f.id), keccak256(toBytes("owner voided"))] })) && done(`Ticket #${f.id} voided`)}
                    >
                      Void it
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sheet p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function AmountRow({ label, action, onSubmit }: { label: string; action: string; onSubmit: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <input className="field figure" placeholder={label} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn shrink-0" disabled={!(Number(v) >= 0) || v === ""} onClick={() => onSubmit(v)}>
        {action}
      </button>
    </div>
  );
}

function PriceForm({ onSubmit, symbol }: { onSubmit: (label: string, price: string, days: number) => void; symbol: string }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("30");
  return (
    <Card title="Post a price">
      <p className="mb-3 text-sm text-ink-soft">What one unit is worth: a bag, a kilo, an hour, a finished task. Tickets lock the price at the moment they&apos;re cut.</p>
      <div className="space-y-2">
        <input className="field" placeholder="What (e.g. Rice, 50kg bag)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-2">
          <input className="field figure" placeholder={`Price per unit (${symbol})`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input className="field figure w-28" placeholder="Days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
        <button className="btn w-full" disabled={!label.trim() || !(Number(price) > 0) || !(Number(days) > 0)} onClick={() => onSubmit(label.trim(), price, Number(days))}>
          Post price
        </button>
      </div>
    </Card>
  );
}

function TeamForm({ onSubmit }: { onSubmit: (who: Address, label: string, clerk: boolean, witness: boolean) => void }) {
  const [who, setWho] = useState("");
  const [label, setLabel] = useState("");
  const [clerk, setClerk] = useState(true);
  const [witness, setWitness] = useState(false);
  return (
    <Card title="Team">
      <p className="mb-3 text-sm text-ink-soft">Clerks cut tickets. Witnesses count and confirm. The same person can&apos;t witness a ticket they cut or get paid by.</p>
      <div className="space-y-2">
        <input className="field figure" placeholder="Wallet address 0x…" value={who} onChange={(e) => setWho(e.target.value)} />
        <input className="field" placeholder="Name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={clerk} onChange={(e) => setClerk(e.target.checked)} /> Clerk
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={witness} onChange={(e) => setWitness(e.target.checked)} /> Witness
          </label>
        </div>
        <button className="btn w-full" disabled={!isAddress(who)} onClick={() => onSubmit(getAddress(who), label.trim(), clerk, witness)}>
          {clerk || witness ? "Save role" : "Remove from team"}
        </button>
      </div>
    </Card>
  );
}

function NameForm({ onSubmit }: { onSubmit: (who: Address, label: string) => void }) {
  const [who, setWho] = useState("");
  const [label, setLabel] = useState("");
  return (
    <Card title="Name a wallet">
      <p className="mb-3 text-sm text-ink-soft">Give a supplier or worker a name so tickets read &ldquo;Chidi, rice&rdquo; instead of 0x7a…. Free to sign.</p>
      <div className="space-y-2">
        <input className="field figure" placeholder="Wallet address 0x…" value={who} onChange={(e) => setWho(e.target.value)} />
        <input className="field" placeholder="Name" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="btn w-full" disabled={!isAddress(who) || !label.trim()} onClick={() => onSubmit(getAddress(who), label.trim())}>
          Save name
        </button>
      </div>
    </Card>
  );
}

function LimitsForm({
  current,
  symbol,
  onSubmit,
}: {
  current: Props["limits"];
  symbol: string;
  onSubmit: (maxT: string, cap: string, tolPct: string) => void;
}) {
  const [maxT, setMaxT] = useState("");
  const [cap, setCap] = useState("");
  const [tol, setTol] = useState(String(current.toleranceBps / 100));
  return (
    <Card title="Limits">
      <p className="mb-3 text-sm text-ink-soft">
        Now: {money(BigInt(current.maxTicket), symbol)} per ticket, {money(BigInt(current.dailyCap), symbol)} per day, {current.toleranceBps / 100}% counting difference.
      </p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input className="field figure" placeholder="Per ticket" inputMode="decimal" value={maxT} onChange={(e) => setMaxT(e.target.value)} />
          <input className="field figure" placeholder="Per day" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} />
          <input className="field figure w-24" placeholder="%" inputMode="decimal" value={tol} onChange={(e) => setTol(e.target.value)} />
        </div>
        <button className="btn w-full" disabled={!(Number(maxT) > 0) || !(Number(cap) >= Number(maxT))} onClick={() => onSubmit(maxT, cap, tol)}>
          Update limits
        </button>
      </div>
    </Card>
  );
}
