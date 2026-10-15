"use client";

import { useWallet } from "./Providers";
import { chain } from "@/lib/network";
import { short } from "@/lib/format";

export function WalletButton() {
  const { address, onRightChain, connect, disconnect, switchChain, connecting, error } = useWallet();

  if (!address) {
    return (
      <div className="flex flex-col items-end">
        <button className="btn h-10 px-4 whitespace-nowrap sm:h-11 sm:px-5" disabled={connecting} onClick={connect}>
          {connecting ? "Connecting…" : (
            <>
              Connect<span className="hidden sm:inline">wallet</span>
            </>
          )}
        </button>
        {error && <span className="mt-1 max-w-xs text-right text-xs text-red">{error}</span>}
      </div>
    );
  }

  if (!onRightChain) {
    return (
      <button className="btn whitespace-nowrap" onClick={() => switchChain()}>
        Switch<span className="hidden sm:inline">to {chain.name}</span>
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
    <div className="card p-6 text-center">
      <p className="mb-4 text-muted">{why}</p>
      <div className="flex justify-center">
        <WalletButton />
      </div>
    </div>
  );
}
