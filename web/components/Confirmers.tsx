"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Abi, Address } from "viem";
import { useWallet } from "./Providers";
import { useTx } from "./useTx";
import { loadConfirmers, saveConfirmers, whatsapp, type LinkConfirmer } from "./confirmerStore";
import { scaleTicketAbi } from "@/lib/abi";
import { confirmersMessage } from "@/lib/messages";
import { CHAIN_ID, scaleTicketAddress } from "@/lib/network";

const ROLE_WITNESS = 2;

/**
 * Owner card: people who confirm payments with a private link instead of a wallet app. Adding
 * one creates a Circle wallet for them (server) and gives it the confirmer role (owner's wallet).
 */
export function Confirmers({ houseId, owner, houseName }: { houseId: number; owner: Address; houseName: string }) {
  const router = useRouter();
  const { address, wallet } = useWallet();
  const { send, pending, error, setError } = useTx();
  const [list, setList] = useState<LinkConfirmer[]>([]);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setList(loadConfirmers(houseId));
    sync();
    window.addEventListener("scalehouse:confirmers", sync);
    return () => window.removeEventListener("scalehouse:confirmers", sync);
  }, [houseId]);

  if (!address || address.toLowerCase() !== owner.toLowerCase()) return null;

  async function call(action: "add" | "list", extra: Record<string, unknown> = {}) {
    const at = Math.floor(Date.now() / 1000);
    const signature = await wallet().signMessage({ account: address!, message: confirmersMessage(houseId, CHAIN_ID, action, at) });
    const res = await fetch("/api/confirmers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ houseId, action, at, signature, ...extra }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Failed");
    return body;
  }

  async function add() {
    setError(null);
    try {
      setStage("Sign to confirm it's you");
      const c = (await call("add", { name: name.trim() })) as LinkConfirmer;
      setStage(null);
      const ok = await send(`Giving ${c.name} the confirmer role`, {
        address: scaleTicketAddress,
        abi: scaleTicketAbi as Abi,
        functionName: "setRoles",
        args: [BigInt(houseId), c.address, ROLE_WITNESS],
      });
      if (!ok) return;
      saveConfirmers(houseId, [...loadConfirmers(houseId), c]);
      setName("");
      router.refresh();
    } catch (e) {
      setStage(null);
      setError((e as Error).message.split("\n")[0]);
    }
  }

  async function reload() {
    setError(null);
    try {
      setStage("Sign to show your links");
      const body = (await call("list")) as { confirmers: LinkConfirmer[] };
      saveConfirmers(houseId, body.confirmers);
    } catch (e) {
      setError((e as Error).message.split("\n")[0]);
    } finally {
      setStage(null);
    }
  }

  const invite = (c: LinkConfirmer) =>
    `Hi ${c.name}! You're my payment confirmer for ${houseName} on Scalehouse.\n\nWhenever I pay someone, open this link, check it's real, and tap Confirm. No app or wallet needed, and it's free:\n${c.link}\n\nKeep this link private. Thank you!`;

  return (
    <section className="card p-6">
      <h2 className="display text-2xl">Confirmers</h2>
      <p className="mt-1 text-sm text-muted">
        The person who checks each payment before it goes out. They get a private link and tap Confirm. No wallet app needed: Scalehouse gives them a
        Circle wallet behind the scenes.
      </p>

      {list.length > 0 && (
        <ul className="mt-4 space-y-2">
          {list.map((c) => (
            <li key={c.address} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-2 px-4 py-3">
              <span className="font-semibold">{c.name}</span>
              <span className="flex flex-wrap gap-2">
                <a className="btn btn-quiet h-9 px-3 text-sm" href={whatsapp(invite(c))} target="_blank" rel="noreferrer">
                  Send link on WhatsApp
                </a>
                <button className="btn btn-quiet h-9 px-3 text-sm" onClick={() => navigator.clipboard.writeText(c.link).catch(() => undefined)}>
                  Copy link
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input className="field flex-1" placeholder="Their name, e.g. Ada (storekeeper)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Confirmer name" />
        <button className="btn shrink-0" disabled={!name.trim() || !!stage || !!pending} onClick={add}>
          {stage ? `${stage}…` : pending ? `${pending}…` : "Add confirmer"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <button className="underline opacity-70" disabled={!!stage} onClick={reload}>
          Show my confirmers&apos; links
        </button>
        {error && <span className="text-red">{error}</span>}
      </div>
    </section>
  );
}
