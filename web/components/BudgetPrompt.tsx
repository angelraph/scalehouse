"use client";

import { useRouter } from "next/navigation";
import type { Abi, Address } from "viem";
import { useWallet } from "./Providers";
import { useTx } from "./useTx";
import { money } from "@/lib/format";
import { scaleTicketAddress } from "@/lib/network";

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

/** Shown to the owner when Scalehouse can't pay anything yet (no budget approved), with a one-tap fix. */
export function BudgetPrompt({ owner, token, symbol, allowance, dailyCap }: { owner: Address; token: Address; symbol: string; allowance: string; dailyCap: string }) {
  const router = useRouter();
  const { address } = useWallet();
  const { send, pending, error } = useTx();
  if (!address || address.toLowerCase() !== owner.toLowerCase()) return null;
  if (BigInt(allowance) > 0n) return null;

  return (
    <div className="card border-bronze p-5">
      <div className="font-semibold">One last step: set your daily budget</div>
      <p className="mt-1 text-sm text-muted">
        Scalehouse can&apos;t pay anyone until you allow it to spend up to {money(BigInt(dailyCap), symbol)} from your wallet. Your money stays in
        your wallet until each payment.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="btn"
          disabled={!!pending}
          onClick={async () => {
            const r = await send("Setting your budget", { address: token, abi: approveAbi, functionName: "approve", args: [scaleTicketAddress, BigInt(dailyCap)] });
            if (r) router.refresh();
          }}
        >
          {pending ? `${pending}…` : `Allow ${money(BigInt(dailyCap), symbol)} a day`}
        </button>
        {error && <span className="text-sm text-red">{error}</span>}
      </div>
    </div>
  );
}
