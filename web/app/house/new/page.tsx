"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseEventLogs, type Abi } from "viem";
import { RequireWallet } from "@/components/Wallet";
import { useTx } from "@/components/useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { toUnits } from "@/lib/format";
import { agentAddress, network, scaleTicketAddress } from "@/lib/network";

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

export default function NewHouse() {
  const router = useRouter();
  const { send, pending, error } = useTx();
  const [name, setName] = useState("");
  const [token, setToken] = useState<"USDC" | "EURC">("USDC");
  const [maxTicket, setMaxTicket] = useState("10");
  const [dailyCap, setDailyCap] = useState("25");
  const [budget, setBudget] = useState("25");
  const [tolerance, setTolerance] = useState("2");
  const [done, setDone] = useState<string[]>([]);

  async function open() {
    const tokenAddr = network.tokens[token];
    const created = await send("Opening the house", {
      address: scaleTicketAddress,
      abi: scaleTicketAbi,
      functionName: "createHouse",
      args: [tokenAddr, name.trim(), toUnits(maxTicket), toUnits(dailyCap), Math.round(Number(tolerance) * 100)],
    });
    if (!created) return;
    const [ev] = parseEventLogs({ abi: scaleTicketAbi, logs: created.logs, eventName: "HouseCreated" });
    const houseId = ev.args.houseId;
    setDone((d) => [...d, `House #${houseId} opened`]);

    const appointed = await send("Appointing the Scalehouse agent", {
      address: scaleTicketAddress,
      abi: scaleTicketAbi,
      functionName: "setAgent",
      args: [houseId, agentAddress],
    });
    if (!appointed) return;
    setDone((d) => [...d, "Agent appointed"]);

    const approved = await send(`Allowing Scalehouse to pay up to ${budget} ${token} from your wallet`, {
      address: tokenAddr,
      abi: approveAbi,
      functionName: "approve",
      args: [scaleTicketAddress, toUnits(budget)],
    });
    if (!approved) return;
    router.push(`/house/${houseId}`);
  }

  const valid = name.trim().length >= 2 && Number(maxTicket) > 0 && Number(dailyCap) >= Number(maxTicket) && Number(tolerance) >= 0 && Number(tolerance) <= 20;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="display text-5xl">Open a house</h1>
        <p className="mt-2 text-muted">
          A house is your business on Scalehouse. Your wallet pays. Your money never leaves your wallet until a ticket clears,
          and then it goes straight to the person you owe. You can pause or change limits at any time.
        </p>
      </div>

      <RequireWallet why="Connect the wallet your business pays from.">
        <div className="card space-y-5 p-6">
          <div>
            <label className="label" htmlFor="name">Business name</label>
            <input id="name" className="field" placeholder="e.g. Mama Ada Provisions" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <span className="label">Pay in</span>
            <div className="flex gap-2">
              {(["USDC", "EURC"] as const).map((t) => (
                <button key={t} type="button" className={`btn ${token === t ? "" : "btn-quiet"}`} onClick={() => setToken(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="max">Most one ticket can pay ({token})</label>
              <input id="max" className="field figure" inputMode="decimal" value={maxTicket} onChange={(e) => setMaxTicket(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cap">Most paid out per day ({token})</label>
              <input id="cap" className="field figure" inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="tol">Allowed counting difference (%)</label>
              <input id="tol" className="field figure" inputMode="decimal" value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
              <p className="mt-1 text-xs text-muted">If the witness counts more than this away from the ticket, it freezes.</p>
            </div>
            <div>
              <label className="label" htmlFor="budget">Total you allow Scalehouse to pay ({token})</label>
              <input id="budget" className="field figure" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Your wallet approval. Raise or revoke it any time.</p>
            </div>
          </div>

          <div className="rounded border border-rule bg-paper p-4 text-sm text-muted">
            Three wallet confirmations: open the house, appoint the Scalehouse agent, and approve the budget. Each costs about a
            cent in fees.
          </div>

          <button className="btn w-full" disabled={!valid || !!pending} onClick={open}>
            {pending ?? "Open the house"}
          </button>
          {done.map((d) => (
            <p key={d} className="text-sm text-forest">✓ {d}</p>
          ))}
          {error && <p className="text-sm text-red">{error}</p>}
        </div>
      </RequireWallet>
    </div>
  );
}
