"use client";

import { useWallet } from "./Providers";
import { chain } from "@/lib/network";
import { short } from "@/lib/format";

export function WalletButton() {
  const { address, onRightChain, connect, disconnect, switchChain, connecting, error } = useWallet();

  if (!address) {
    return (
      <div className="flex flex-col items-end">
        <button className="btn" disabled={connecting} onClick={connect}>
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
        {error && <span className="mt-1 max-w-xs text-right text-xs text-frozen">{error}</span>}
      </div>
    );
  }

  if (!onRightChain) {
    return (
      <button className="btn" onClick={() => switchChain()}>
        Switch to {chain.name}
      </button>
    );
  }

  return (
    <button className="btn btn-quiet figure" onClick={disconnect} title="Disconnect">
      {short(address)}
    </button>
  );
}

/** Gate a section on a connected wallet on the right chain. */
export function RequireWallet({ children, why }: { children: React.ReactNode; why: string }) {
  const { address, onRightChain } = useWallet();
  if (address && onRightChain) return <>{children}</>;
  return (
    <div className="sheet p-6 text-center">
      <p className="mb-4 text-ink-soft">{why}</p>
      <div className="flex justify-center">
        <WalletButton />
      </div>
    </div>
  );
}
