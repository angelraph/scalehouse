"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { encodeFunctionData, getAddress, isAddress, type Abi, type Address, type Hex } from "viem";
import { RequireWallet } from "@/components/Wallet";
import { FaucetButton } from "@/components/FaucetButton";
import { useWallet } from "@/components/Providers";
import { explain } from "@/components/useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { rateIdOf, short, toUnits } from "@/lib/format";
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
 * Two-person setup. The owner answers three questions (who records, who confirms, what's the
 * first price) and every on-chain step happens in one go: one approval in wallets that support
 * batched calls (EIP-5792), otherwise a short guided sequence.
 */
export default function NewHouse() {
  const router = useRouter();
  const { address, wallet, publicClient } = useWallet();
  const [name, setName] = useState("");
  const [token, setToken] = useState<"USDC" | "EURC">("USDC");
  const [recorder, setRecorder] = useState<"me" | "other">("me");
  const [recorderAddr, setRecorderAddr] = useState("");
  const [confirmer, setConfirmer] = useState<"me" | "other">("other");
  const [confirmerAddr, setConfirmerAddr] = useState("");
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [maxTicket, setMaxTicket] = useState("10");
  const [dailyCap, setDailyCap] = useState("25");
  const [tolerance, setTolerance] = useState("2");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<{ label: string; done: boolean }[]>([]);

  // /house/new?preset=testers: sensible defaults for builders paying testers.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preset") !== "testers") return;
    setItem("Tester task");
    setPrice("1");
    setMaxTicket("2");
    setDailyCap("10");
    setRecorder("me");
    setConfirmer("other");
  }, []);

  const me = address?.toLowerCase();
  const clerk = recorder === "me" ? address : isAddress(recorderAddr) ? getAddress(recorderAddr) : null;
  const witness = confirmer === "me" ? address : isAddress(confirmerAddr) ? getAddress(confirmerAddr) : null;

  const problems: string[] = [];
  if (recorder === "me" && confirmer === "me") problems.push("The person who records can't also confirm. Pick someone else for one of them.");
  if (clerk && witness && clerk.toLowerCase() === witness.toLowerCase()) problems.push("Recorder and confirmer must be two different wallets.");
  if (witness && witness.toLowerCase() === agentAddress.toLowerCase()) problems.push("That's the agent's wallet. Use a person's wallet.");
  if (recorder === "other" && recorderAddr && !isAddress(recorderAddr)) problems.push("The recorder's wallet doesn't look right.");
  if (confirmer === "other" && confirmerAddr && !isAddress(confirmerAddr)) problems.push("The confirmer's wallet doesn't look right.");
  if (Number(dailyCap) < Number(maxTicket)) problems.push("The daily limit must be at least the per-ticket limit.");

  const valid =
    name.trim().length >= 2 && !!clerk && !!witness && item.trim().length > 0 && Number(price) > 0 && Number(maxTicket) > 0 && problems.length === 0;

  async function open() {
    if (!address || !clerk || !witness) return;
    setError(null);
    const tokenAddr = network.tokens[token] as Address;
    try {
      setBusy("Preparing");
      // The next house id. Every step below refers to it, so they can all go in one batch.
      const houseId = (await publicClient.readContract({ address: scaleTicketAddress, abi: scaleTicketAbi, functionName: "houseCount" })) + 1n;
      const st = (functionName: string, args: readonly unknown[]) =>
        encodeFunctionData({ abi: scaleTicketAbi as Abi, functionName, args } as Parameters<typeof encodeFunctionData>[0]);
      const calls: Call[] = [
        { label: "Open the house", to: scaleTicketAddress, data: st("createHouse", [tokenAddr, name.trim(), toUnits(maxTicket), toUnits(dailyCap), Math.round(Number(tolerance) * 100)]) },
        { label: "Appoint the Scalehouse agent", to: scaleTicketAddress, data: st("setAgent", [houseId, agentAddress]) },
        { label: `Make ${clerk.toLowerCase() === me ? "you" : short(clerk)} the recorder`, to: scaleTicketAddress, data: st("setRoles", [houseId, clerk, 1]) },
        { label: `Make ${witness.toLowerCase() === me ? "you" : short(witness)} the confirmer`, to: scaleTicketAddress, data: st("setRoles", [houseId, witness, 2]) },
        {
          label: `Post the price: ${item.trim()} at ${price} ${token}`,
          to: scaleTicketAddress,
          data: st("setRate", [houseId, rateIdOf(item.trim()), toUnits(price), BigInt(Math.floor(Date.now() / 1000) + 90 * 86400), true, item.trim()]),
        },
        {
          label: `Allow Scalehouse to pay up to ${dailyCap} ${token} from your wallet`,
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
        <span className="tag">Two minutes</span>
        <h1 className="display mt-4 text-5xl">Open a house</h1>
        <p className="mt-2 text-muted">
          A house is your business on Scalehouse. Answer three questions and we set everything up. Your money stays in your wallet
          until a ticket clears, then goes straight to the person you owe.
        </p>
      </div>

      <FaucetButton variant="block" />

      <RequireWallet why="Connect the wallet your business pays from.">
        <div className="card space-y-7 p-6">
          <Q n={1} title="Your business">
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

          <Q n={2} title="Who records deliveries or jobs, and who confirms them?">
            <p className="mb-3 text-sm text-muted">Two different people, so nobody can both claim and approve. The person being paid needs nothing.</p>
            <Who
              label="Records"
              hint="Cuts a ticket when goods arrive or work is done"
              value={recorder}
              onChange={(v) => {
                setRecorder(v);
                if (v === "me") setConfirmer("other");
              }}
              addr={recorderAddr}
              onAddr={setRecorderAddr}
            />
            <div className="h-3" />
            <Who
              label="Confirms"
              hint="Counts again and taps confirm (free, no gas)"
              value={confirmer}
              onChange={(v) => {
                setConfirmer(v);
                if (v === "me") setRecorder("other");
              }}
              addr={confirmerAddr}
              onAddr={setConfirmerAddr}
            />
          </Q>

          <Q n={3} title="What do you pay for?">
            <div className="flex gap-2">
              <input className="field" placeholder="e.g. Bread, 1 loaf · Logo design · Rice, 50kg bag" value={item} onChange={(e) => setItem(e.target.value)} />
              <input className="field figure w-36" inputMode="decimal" placeholder={`Price (${token})`} value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <p className="mt-1 text-xs text-muted">Price per unit. You can post more prices later.</p>
          </Q>

          <details className="rounded-xl border border-rule p-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              Limits <span className="font-normal text-muted">({maxTicket} per ticket, {dailyCap} per day, {tolerance}% counting difference)</span>
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="label">Per ticket ({token})</span>
                <input className="field figure" inputMode="decimal" value={maxTicket} onChange={(e) => setMaxTicket(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Per day ({token})</span>
                <input className="field figure" inputMode="decimal" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Counting difference (%)</span>
                <input className="field figure" inputMode="decimal" value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">Your wallet approves up to one day&apos;s limit. Change any of these later.</p>
          </details>

          {problems.map((p) => (
            <p key={p} className="text-sm text-bronze">
              ! {p}
            </p>
          ))}

          <button className="btn w-full" disabled={!valid || !!busy} onClick={open}>
            {busy ?? "Open the house"}
          </button>
          <p className="-mt-3 text-center text-xs text-muted">One approval in wallets that support batching, otherwise six quick ones. About a cent each.</p>

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

function Who(props: {
  label: string;
  hint: string;
  value: "me" | "other";
  onChange: (v: "me" | "other") => void;
  addr: string;
  onAddr: (v: string) => void;
}) {
  return (
    <div className="rounded-xl bg-paper-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{props.label}</div>
          <div className="text-xs text-muted">{props.hint}</div>
        </div>
        <div className="segmented">
          <button type="button" aria-current={props.value === "me"} onClick={() => props.onChange("me")}>
            Me
          </button>
          <button type="button" aria-current={props.value === "other"} onClick={() => props.onChange("other")}>
            Someone else
          </button>
        </div>
      </div>
      {props.value === "other" && (
        <input className="field figure mt-3" placeholder="Their wallet 0x…" value={props.addr} onChange={(e) => props.onAddr(e.target.value.trim())} />
      )}
    </div>
  );
}
