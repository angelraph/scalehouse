"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseEventLogs, type Abi, type Address } from "viem";
import { RequireWallet } from "@/components/Wallet";
import { FaucetButton } from "@/components/FaucetButton";
import { useWallet } from "@/components/Providers";
import { explain } from "@/components/useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { toUnits } from "@/lib/format";
import { agentAddress, CHAIN_ID, network, scaleTicketAddress } from "@/lib/network";

const erc20 = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
] as const satisfies Abi;
const st = { address: scaleTicketAddress, abi: scaleTicketAbi as Abi };
const ROLE_ISSUER = 1;
const ROLE_WITNESS = 2;
type HouseTuple = readonly [Address, Address, Address, Address, bigint, bigint, number, number, Address, boolean];

/** Where an unfinished setup is remembered, so a refresh or a failed step never strands anyone. */
const pendingKey = (owner: string) => `scalehouse:setup:${CHAIN_ID}:${owner.toLowerCase()}`;

/**
 * One wallet, two questions. Setup is a short list of ordinary transactions (no batching or
 * smart-account upgrade, which wallets flag with scary warnings). Each step is checked against the
 * chain first, so "Continue setup" only does what's still missing.
 */
export default function NewHouse() {
  const router = useRouter();
  const { address, wallet, publicClient } = useWallet();
  const [name, setName] = useState("");
  const [token, setToken] = useState<"USDC" | "EURC">("USDC");
  const [autoMax, setAutoMax] = useState("5");
  const [dailyCap, setDailyCap] = useState("25");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<{ label: string; state: "todo" | "doing" | "done" }[]>([]);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preset") !== "testers") return;
    setAutoMax("2");
    setDailyCap("10");
  }, []);

  // An unfinished setup from earlier (a failed step, a closed tab)?
  useEffect(() => {
    if (!address) return setPending(null);
    try {
      const v = localStorage.getItem(pendingKey(address));
      setPending(v ? Number(v) : null);
    } catch {
      setPending(null);
    }
  }, [address]);

  const problems: string[] = [];
  if (!(Number(autoMax) > 0)) problems.push("Set how much one payment can be.");
  if (Number(dailyCap) < Number(autoMax)) problems.push("The daily budget must be at least one payment.");
  const valid = name.trim().length >= 2 && problems.length === 0;

  const mark = (label: string, state: "todo" | "doing" | "done") =>
    setSteps((s) => (s.some((x) => x.label === label) ? s.map((x) => (x.label === label ? { ...x, state } : x)) : [...s, { label, state }]));

  /** One ordinary transaction: simulate (clear errors), sign, wait with a timeout. */
  async function tx(label: string, call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] }) {
    mark(label, "doing");
    setBusy(`${label}: confirm in your wallet`);
    const client = wallet();
    const { request } = await publicClient.simulateContract({ ...call, account: client.account! } as Parameters<typeof publicClient.simulateContract>[0]);
    const hash = await client.writeContract(request as Parameters<typeof client.writeContract>[0]);
    setBusy(`${label}: waiting for Arc`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
    if (receipt.status !== "success") throw new Error(`"${label}" didn't go through.`);
    mark(label, "done");
    return receipt;
  }

  /** Brings house `houseId` to fully set up, doing only the steps the chain says are missing. */
  async function finish(houseId: number) {
    const h = (await publicClient.readContract({ ...st, functionName: "houses", args: [BigInt(houseId)] })) as unknown as HouseTuple;
    const me = address!;
    if (h[0].toLowerCase() !== me.toLowerCase()) throw new Error(`House #${houseId} belongs to another wallet.`);

    setBusy("Preparing auto-approve");
    const prep = await fetch("/api/auto-approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare", houseId: String(houseId) }) }).then((r) => r.json());
    if (!prep.checker) throw new Error(prep.error ?? "Couldn't prepare auto-approve. Tap Continue setup to try again.");

    if (h[2].toLowerCase() !== agentAddress.toLowerCase()) await tx("Appoint the Scalehouse agent", { ...st, functionName: "setAgent", args: [BigInt(houseId), agentAddress] });
    else mark("Appoint the Scalehouse agent", "done");

    const myRoles = Number(await publicClient.readContract({ ...st, functionName: "roles", args: [BigInt(houseId), me] }));
    if ((myRoles & ROLE_ISSUER) === 0) await tx("Let you record payments", { ...st, functionName: "setRoles", args: [BigInt(houseId), me, myRoles | ROLE_ISSUER] });
    else mark("Let you record payments", "done");

    const checkerRoles = Number(await publicClient.readContract({ ...st, functionName: "roles", args: [BigInt(houseId), prep.checker] }));
    if ((checkerRoles & ROLE_WITNESS) === 0) await tx("Switch on auto-approve", { ...st, functionName: "setRoles", args: [BigInt(houseId), prep.checker, ROLE_WITNESS] });
    else mark("Switch on auto-approve", "done");

    const allowance = (await publicClient.readContract({ address: h[3], abi: erc20, functionName: "allowance", args: [me, scaleTicketAddress] })) as bigint;
    if (allowance < h[5]) await tx("Set your daily budget", { address: h[3], abi: erc20, functionName: "approve", args: [scaleTicketAddress, h[5]] });
    else mark("Set your daily budget", "done");

    try {
      localStorage.removeItem(pendingKey(me));
    } catch {}
    router.push(`/house/${houseId}?new=1`);
  }

  function fail(e: unknown) {
    const msg = (e as Error)?.name === "WaitForTransactionReceiptTimeoutError" ? "Arc is taking longer than usual. Your step may still go through: wait a moment, then tap Continue setup." : explain(e);
    setError(msg);
    setSteps((s) => s.map((x) => (x.state === "doing" ? { ...x, state: "todo" } : x)));
  }

  async function open() {
    if (!address || busy) return;
    setError(null);
    setSteps([]);
    try {
      ["Open your house", "Appoint the Scalehouse agent", "Let you record payments", "Switch on auto-approve", "Set your daily budget"].forEach((l) => mark(l, "todo"));
      const r = await tx("Open your house", { ...st, functionName: "createHouse", args: [network.tokens[token] as Address, name.trim(), toUnits(autoMax), toUnits(dailyCap), 200] });
      const houseId = Number(parseEventLogs({ abi: scaleTicketAbi, logs: r.logs, eventName: "HouseCreated" })[0].args.houseId);
      try {
        localStorage.setItem(pendingKey(address), String(houseId));
      } catch {}
      setPending(houseId);
      await finish(houseId);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function resume() {
    if (!address || !pending || busy) return;
    setError(null);
    try {
      ["Appoint the Scalehouse agent", "Let you record payments", "Switch on auto-approve", "Set your daily budget"].forEach((l) => mark(l, "todo"));
      await finish(pending);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <span className="tag">One minute</span>
        <h1 className="display mt-4 text-5xl">Open a house</h1>
        <p className="mt-2 text-muted">A house is your business on Scalehouse. Two questions, then a few quick approvals in your wallet (about a cent each). Your money stays in your wallet until the moment it pays someone.</p>
      </div>

      <FaucetButton variant="block" />

      <RequireWallet why="Connect the wallet your business pays from.">
        {pending && !busy && steps.length === 0 && (
          <div className="card border-bronze p-5">
            <div className="font-semibold">You started setting up house #{pending}</div>
            <p className="mt-1 text-sm text-muted">A step didn&apos;t finish last time. Continue and Scalehouse will only do what&apos;s still missing.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button className="btn" onClick={resume}>
                Continue setup
              </button>
              <button
                className="btn btn-quiet"
                onClick={() => {
                  try {
                    localStorage.removeItem(pendingKey(address!));
                  } catch {}
                  setPending(null);
                }}
              >
                Start a new house instead
              </button>
            </div>
          </div>
        )}

        <div className="card space-y-7 p-6">
          <Q n={1} title="Your business name">
            <input className="field" placeholder="e.g. Mama Ada Provisions" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-muted">Pay in</span>
              <div className="segmented">
                {(["USDC", "EURC"] as const).map((t) => (
                  <button key={t} type="button" aria-current={token === t} onClick={() => setToken(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </Q>

          <Q n={2} title="How much can go out without anyone else checking?">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">Each payment, up to ({token})</span>
                <input className="field figure" inputMode="decimal" value={autoMax} onChange={(e) => setAutoMax(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">All payments per day, up to ({token})</span>
                <input className="field figure" inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">Payments within this go out in about 30 seconds after the agent screens the wallet. Want a person to check bigger payments? Add a confirmer later: they get a link, no wallet needed.</p>
          </Q>

          {problems.map((p) => (
            <p key={p} className="text-sm text-bronze">
              ! {p}
            </p>
          ))}

          {error && steps.some((s) => s.state === "done") ? (
            <button className="btn w-full" disabled={!!busy} onClick={resume}>
              {busy ?? "Continue setup"}
            </button>
          ) : (
            <button className="btn w-full" disabled={!valid || !!busy} onClick={open}>
              {busy ?? "Open the house"}
            </button>
          )}
          <p className="-mt-3 text-center text-xs text-muted">Five quick approvals in your wallet, about a cent each. No account upgrades, nothing to install.</p>

          {busy && (
            <p className="rounded-xl bg-paper-2 p-3 text-center text-sm">Nothing popped up? Click your wallet&apos;s icon in the browser toolbar. The request is waiting there.</p>
          )}

          {steps.length > 0 && (
            <ol className="space-y-1.5 text-sm">
              {steps.map((s) => (
                <li key={s.label} className={s.state === "done" ? "text-forest" : s.state === "doing" ? "font-semibold text-ink" : "text-muted"}>
                  {s.state === "done" ? "✓" : s.state === "doing" ? "●" : "○"} {s.label}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="text-sm text-red">{error}</p>}
        </div>
      </RequireWallet>
    </div>
  );
}

function Q({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="figure grid h-7 w-7 place-items-center rounded-full bg-forest text-xs text-lime">{n}</span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
