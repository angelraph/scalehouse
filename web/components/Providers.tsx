"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  numberToHex,
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
} from "viem";
import { chain } from "@/lib/network";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

interface WalletState {
  address: Address | null;
  chainId: number | null;
  onRightChain: boolean;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  wallet: () => WalletClient;
  publicClient: PublicClient;
}

const Ctx = createContext<WalletState | null>(null);

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || chain.rpcUrls.default.http[0]),
}) as PublicClient;

/**
 * Talks to whatever wallet the browser injects (MetaMask, OKX, Rabby, a mobile wallet's
 * in-app browser) through EIP-1193 directly. No wallet SDKs: fewer moving parts, and the
 * page works the same in every wallet browser.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const eth = window.ethereum;
    setHasWallet(!!eth);
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((a) => setAddress(a[0] ? getAddress(a[0]) : null)).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => setChainId(Number(c))).catch(() => {});
    const onAccounts = (a: string[]) => setAddress(a[0] ? getAddress(a[0]) : null);
    const onChain = (c: string) => setChainId(Number(c));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const switchChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    const hexId = numberToHex(chain.id);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexId,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [...chain.rpcUrls.default.http],
            blockExplorerUrls: [chain.blockExplorers.default.url],
          },
        ],
      });
    }
    setChainId(chain.id);
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setError("No wallet found. Open this page in MetaMask, OKX Wallet or Rabby.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0] ? getAddress(accounts[0]) : null);
      if (Number(await eth.request({ method: "eth_chainId" })) !== chain.id) await switchChain();
    } catch (e) {
      setError((e as Error).message?.split("\n")[0] ?? "Could not connect");
    } finally {
      setConnecting(false);
    }
  }, [switchChain]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      onRightChain: chainId === chain.id,
      connecting,
      error,
      hasWallet,
      connect,
      disconnect: () => setAddress(null),
      switchChain,
      wallet: () => {
        if (!window.ethereum || !address) throw new Error("Connect a wallet first");
        return createWalletClient({ account: address, chain, transport: custom(window.ethereum) });
      },
      publicClient,
    }),
    [address, chainId, connecting, error, hasWallet, connect, switchChain],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <Providers>");
  return v;
}
