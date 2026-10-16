"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { encodeFunctionData, type Abi, type Address, type Hex } from "viem";
import { RequireWallet } from "@/components/Wallet";
import { FaucetButton } from "@/components/FaucetButton";
import { useWallet } from "@/components/Providers";
import { explain } from "@/components/useTx";
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

type Call = { label: string; to: Address; data: Hex };

/**
 * One wallet, two questions. The owner names the business and sets how much can go out without
 * anyone else checking; everything else is set up in one approval (in wallets that batch calls,
 * EIP-5792), otherwise a short guided sequence. Confirmers for bigger payments are added later by
 * name, and they need no wallet.
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
  const [steps, setSteps] = useState<{ label: string; done: boolean }[]>([]);
  const [openedId, setOpenedId] = useState<bigint | null>(null);

  // /house/new?preset=testers: sensible defaults for builders paying testers.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preset") !== "testers") return;
    setAutoMax("2");
    setDailyCap("10");
  }, []);

  const problems: string[] = [];
  if (Number(autoMax) <= 0) problems.push("Set how much one payment can be.");
  if (Number(dailyCap) < Number(autoMax)) problems.push("The daily budget must be at least one payment.");
  const valid = name.trim().length >= 2 && problems.length === 0;

  async function open() {
    if (!address) return;
    setError(null);
    const tokenAddr = network.tokens[token] as Address;
    try {
      setBusy("Preparing");
      // The next house id: every step below refers to it, so they can all go in one batch.
      const houseId = (await publicClient.readContract({ address: scaleTicketAddress, abi: scaleTicketAbi, functionName: "houseCount" })) + 1n;
      const prep = await fetch("/api/auto-approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "prepare", houseId: houseId.toString() }),
      }).then((r) => r.json());
      if (!prep.checker) throw new Error(prep.error ?? "Couldn't prepare the checker. Try again.");

      const st = (functionName: string, args: readonly unknown[]) =>
        encodeFunctionData({ abi: scaleTicketAbi as Abi, functionName, args } as Parameters<typeof encodeFunctionData>[0]);
      const calls: Call[] = [
        { label: "Open your house", to: scaleTicketAddress, data: st("createHouse", [tokenAddr, name.trim(), toUnits(autoMax), toUnits(dailyCap), 200]) },
        { label: "Appoint the Scalehouse agent", to: scaleTicketAddress, data: st("setAgent", [houseId, agentAddress]) },
        { label: "Let you record payments", to: scaleTicketAddress, data: st("setRoles", [houseId, address, 1]) },
        { label: `Switch on auto-approve up to ${autoMax} ${token}`, to: scaleTicketAddress, data: st("setRoles", [houseId, prep.checker, 2]) },
        {
          label: `Set your daily budget: ${dailyCap} ${token}`,
          to: tokenAddr,
          data: encodeFunctionData({ abi: approveAbi, functionName: "approve", args: [scaleTicketAddress, toUnits(dailyCap)] }),
        },
      ];
      setSteps(calls.map((c) => ({ label: c.label, done: false })));
      const client = wallet();

      // One approval, when the wallet supports batched calls.
      let batched = false;
      try {
        setBusy("Approve once in your wallet");
        const { id } = await client.sendCalls({ account: address, calls: calls.map(({ to, data }) => ({ to, data })), forceAtomic: true });
        setBusy("Waiting for Arc");
        const status = await client.waitForCallsStatus({ id, timeout: 120_000 });
        if (status.status !== "success") throw new Error("The batch didn't go through");
        batched = true;
        setSteps((s) => s.map((x) => ({ ...x, done: true })));
      } catch (e) {
        const msg = (e as Error).message ?? "";
        if (/reject|denied/i.test(msg)) throw e;
        // Wallet can't batch: fall back to one confirmation per step.
      }

      if (!batched) {
        for (let i = 0; i < calls.length; i++) {
          setBusy(`Step ${i + 1} of ${calls.length}: ${calls[i].label}`);
          const hash = await client.sendTransaction({ account: address, chain: client.chain, to: calls[i].to, data: calls[i].data });
          const r = await publicClient.waitForTransactionReceipt({ hash });
          if (r.status !== "success") throw new Error(`"${calls[i].label}" didn't go through`);
          setSteps((s) => s.map((x, j) => (j === i ? { ...x, done: true } : x)));
          if (i === 0) setOpenedId(houseId);
        }
      }
      router.push(`/house/${houseId}?new=1`);
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <span className="tag">One minute</span>
        <h1 className="display mt-4 text-5xl">Open a house</h1>
        <p className="mt-2 text-muted">
          A house is your business on Scalehouse. Two questions, one approval. Your money stays in your wallet until the moment it pays someone.
        </p>
      </div>

      <FaucetButton variant="block" />

      <RequireWallet why="Connect the wallet your business pays from.">
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
            <p className="mt-2 text-xs text-muted">
              Payments within this go out in about 30 seconds after the agent screens the wallet. Want a person to check bigger payments? Add a
              confirmer later: they get a link, no wallet needed.
            </p>
          </Q>

          {problems.map((p) => (
            <p key={p} className="text-sm text-bronze">
              ! {p}
            </p>
          ))}

          <button className="btn w-full" disabled={!valid || !!busy} onClick={open}>
            {busy ?? "Open the house"}
          </button>
          <p className="-mt-3 text-center text-xs text-muted">One approval in wallets that support batching, otherwise five quick ones. About a cent each.</p>
          {busy && busy !== "Preparing" && (
            <p className="rounded-xl bg-paper-2 p-3 text-center text-sm">
              Nothing popped up? Click your wallet&apos;s icon in the browser toolbar. The request is waiting there.
            </p>
          )}

          {steps.length > 0 && (
            <ol className="space-y-1.5 text-sm">
              {steps.map((s) => (
                <li key={s.label} className={s.done ? "text-forest" : "text-muted"}>
                  {s.done ? "✓" : "○"} {s.label}
                </li>
              ))}
            </ol>
          )}
          {error && <p className="text-sm text-red">{error}</p>}
          {openedId != null && (
            <p className="text-sm">
              Your house is already open. If your wallet stopped asking,{" "}
              <a className="link font-semibold" href={`/house/${openedId}?new=1`}>
                finish on your house page →
              </a>
            </p>
          )}
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
