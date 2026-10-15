"use client";

import { useState } from "react";
import { useWallet } from "./Providers";
import { isMainnet } from "@/lib/network";

const FAUCET = "https://faucet.circle.com";

/**
 * Testnet only: sends testers to Circle's faucet for free test USDC/EURC on Arc Testnet. If a
 * wallet is connected, its address is copied first so it can be pasted straight in.
 */
export function FaucetButton({ variant = "chip" }: { variant?: "chip" | "block" }) {
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);
  if (isMainnet) return null;

  async function go() {
    if (address) {
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
      } catch {
        // Clipboard blocked: the faucet still opens, the address just isn't pre-copied.
      }
    }
    window.open(FAUCET, "_blank", "noopener,noreferrer");
  }

  if (variant === "block") {
    return (
      <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">Need test money?</div>
          <p className="text-sm text-muted">
            Circle&apos;s faucet gives free test USDC on Arc Testnet. Choose <span className="figure">Arc Testnet</span>, paste
            your wallet, and request.
            {address && " We'll copy your address for you."}
          </p>
        </div>
        <button type="button" className="btn btn-lime shrink-0" onClick={go}>
          {copied ? "Address copied ✓" : "Get test USDC"} <span aria-hidden>↗</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={go}
      title="Free test USDC from Circle's faucet"
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lime px-3.5 text-xs font-semibold whitespace-nowrap text-forest transition-transform hover:-translate-y-px"
    >
      <span aria-hidden>💧</span>
      {copied ? "Copied ✓" : "Faucet"}
    </button>
  );
}
