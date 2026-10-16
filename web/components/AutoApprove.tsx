"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Abi, Address } from "viem";
import { useWallet } from "./Providers";
import { useTx } from "./useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { money } from "@/lib/format";
import { confirmersMessage } from "@/lib/messages";
import { CHAIN_ID, scaleTicketAddress } from "@/lib/network";

const ROLE_WITNESS = 2;

/** Owner setting: payments up to this amount are confirmed automatically after the checks pass. */
export function AutoApprove({ houseId, owner, symbol }: { houseId: number; owner: Address; symbol: string }) {
  const router = useRouter();
  const { address, wallet, publicClient } = useWallet();
  const { send, pending, error, setError } = useTx();
  const [current, setCurrent] = useState<bigint | null>(null);
  const [limit, setLimit] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auto-approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ houseId, action: "get" }) })
      .then((r) => r.json())
      .then((b) => setCurrent(BigInt(b.limit ?? "0")))
      .catch(() => setCurrent(0n));
  }, [houseId]);

  if (!address || address.toLowerCase() !== owner.toLowerCase()) return null;

  async function save() {
    setError(null);
    setSaved(null);
    try {
      setStage("Sign to confirm it's you");
      const at = Math.floor(Date.now() / 1000);
      const signature = await wallet().signMessage({ account: address!, message: confirmersMessage(houseId, CHAIN_ID, "auto-approve", at) });
      setStage("Saving");
      const res = await fetch("/api/auto-approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId, action: "set", limit: limit.trim() || "0", at, signature }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setStage(null);
      if (body.checker) {
        const roles = Number(await publicClient.readContract({ address: scaleTicketAddress, abi: scaleTicketAbi, functionName: "roles", args: [BigInt(houseId), body.checker] }));
        if ((roles & ROLE_WITNESS) === 0) {
          const ok = await send("Switching on the checker (once)", {
            address: scaleTicketAddress,
            abi: scaleTicketAbi as Abi,
            functionName: "setRoles",
            args: [BigInt(houseId), body.checker, ROLE_WITNESS],
          });
          if (!ok) return;
        }
      }
      setCurrent(BigInt(body.limit));
      setSaved(BigInt(body.limit) > 0n ? `Payments up to ${money(BigInt(body.limit), symbol)} now go out right away.` : "Auto-approve is off. Every payment waits for your confirmer.");
      setLimit("");
      router.refresh();
    } catch (e) {
      setStage(null);
      setError((e as Error).message.split("\n")[0]);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="display text-2xl">Auto-approve</h2>
      <p className="mt-1 text-sm text-muted">
        Small, normal payments go out right away: the agent screens the wallet and checks your budget, and the contract still locks the payee and pays
        once. Anything above this amount waits for your confirmer.
      </p>
      <p className="mt-3 text-sm">
        Now:{" "}
        <strong>{current == null ? "…" : current > 0n ? `up to ${money(current, symbol)} per payment` : "off (every payment needs your confirmer)"}</strong>
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input className="field figure flex-1" inputMode="decimal" placeholder={`New limit in ${symbol}, e.g. 1 (0 turns it off)`} value={limit} onChange={(e) => setLimit(e.target.value)} aria-label="Auto-approve limit" />
        <button className="btn shrink-0" disabled={!limit.trim() || !!stage || !!pending} onClick={save}>
          {stage ? `${stage}…` : pending ? `${pending}…` : "Save"}
        </button>
      </div>
      {saved && <p className="mt-2 text-sm text-forest">✓ {saved}</p>}
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </section>
  );
}
