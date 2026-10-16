"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "./Providers";
import { chain, explorerAddress } from "@/lib/network";
import { short } from "@/lib/format";

export function WalletButton() {
  const { address, onRightChain, connect, disconnect, switchChain, connecting, error, activeName } = useWallet();

  if (!address) {
    return (
      <div className="flex flex-col items-end">
        <button className="btn h-10 px-4 whitespace-nowrap sm:h-11 sm:px-5" disabled={connecting} onClick={() => connect()}>
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

  return <WalletMenu address={address} name={activeName ?? "Wallet"} onDisconnect={disconnect} />;
}

/** The connected wallet: click to see the address, copy it, view it on the explorer, or disconnect. */
function WalletMenu({ address, name, onDisconnect }: { address: string; name: string; onDisconnect: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button className="btn btn-quiet figure h-10 gap-2 px-4 sm:h-11" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="h-2 w-2 rounded-full bg-forest" aria-hidden />
        {short(address)}
        <span aria-hidden className="text-xs opacity-60">▾</span>
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] !bg-paper p-4 shadow-xl">
          <div className="text-xs text-muted">Connected with {name} · {chain.name}</div>
          <div className="figure mt-2 break-all rounded-xl bg-paper-2 p-3 text-sm">{address}</div>
          <div className="mt-3 grid gap-2">
            <button
              role="menuitem"
              className="btn btn-quiet w-full justify-center"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // clipboard blocked
                }
              }}
            >
              {copied ? "Copied ✓" : "Copy address"}
            </button>
            <a role="menuitem" className="btn btn-quiet w-full justify-center" href={explorerAddress(address)} target="_blank" rel="noreferrer">
              View on explorer ↗
            </a>
            <button
              role="menuitem"
              className="btn btn-quiet w-full justify-center text-red"
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
            >
              Disconnect
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">To use another account, switch it inside your wallet app. This page follows automatically.</p>
        </div>
      )}
    </div>
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
