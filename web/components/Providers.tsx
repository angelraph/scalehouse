"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

/** A wallet the browser announced through EIP-6963 (or the legacy window.ethereum fallback). */
export interface WalletOption {
  id: string;
  name: string;
  icon: string;
  provider: EIP1193Provider;
}

interface WalletState {
  address: Address | null;
  chainId: number | null;
  onRightChain: boolean;
  connecting: boolean;
  error: string | null;
  options: WalletOption[];
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  connect: (opt?: WalletOption) => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  wallet: () => WalletClient;
  provider: () => EIP1193Provider | null;
  publicClient: PublicClient;
  activeName: string | null;
}

const Ctx = createContext<WalletState | null>(null);
const LAST = "sh:last-wallet";

const publicClient = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL || chain.rpcUrls.default.http[0]),
}) as PublicClient;

const store = {
  get: () => {
    try {
      return localStorage.getItem(LAST);
    } catch {
      return null;
    }
  },
  set: (v: string | null) => {
    try {
      if (v) localStorage.setItem(LAST, v);
      else localStorage.removeItem(LAST);
    } catch {
      // storage unavailable (private mode): reconnect just won't be remembered
    }
  },
};

/**
 * Finds every wallet the browser has installed (EIP-6963) and lets the person choose one,
 * instead of whichever extension won the race for window.ethereum.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [active, setActive] = useState<WalletOption | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeRef = useRef<WalletOption | null>(null);

  // Discover wallets.
  useEffect(() => {
    const seen = new Map<string, WalletOption>();
    const onAnnounce = (e: Event) => {
      const { info, provider } = (e as CustomEvent<{ info: { uuid: string; name: string; icon: string; rdns: string }; provider: EIP1193Provider }>).detail;
      if (seen.has(info.rdns)) return;
      seen.set(info.rdns, { id: info.rdns, name: info.name, icon: info.icon, provider });
      setOptions([...seen.values()]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    // Older wallets that don't announce themselves.
    const t = setTimeout(() => {
      if (!seen.size && window.ethereum) {
        seen.set("injected", { id: "injected", name: "Browser wallet", icon: "", provider: window.ethereum });
        setOptions([...seen.values()]);
      }
    }, 400);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(t);
    };
  }, []);

  // Listen to the active wallet.
  useEffect(() => {
    const p = active?.provider;
    if (!p) return;
    const onAccounts = (a: string[]) => setAddress(a[0] ? getAddress(a[0]) : null);
    const onChain = (c: string) => setChainId(Number(c));
    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, [active]);

  // Quietly reconnect the wallet used last time, if it's still authorised.
  useEffect(() => {
    const last = store.get();
    const opt = options.find((o) => o.id === last);
    if (!opt || activeRef.current) return;
    opt.provider
      .request({ method: "eth_accounts" })
      .then(async (a) => {
        if (!a[0]) return;
        activeRef.current = opt;
        setActive(opt);
        setAddress(getAddress(a[0]));
        setChainId(Number(await opt.provider.request({ method: "eth_chainId" })));
      })
      .catch(() => {});
  }, [options]);

  const switchOn = useCallback(async (p: EIP1193Provider) => {
    const hexId = numberToHex(chain.id);
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await p.request({
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

  const connect = useCallback(
    async (opt?: WalletOption) => {
      setError(null);
      if (!opt) {
        if (options.length === 1) opt = options[0];
        else if (options.length > 1) return setPickerOpen(true);
        else return setError("No wallet found. Install MetaMask, OKX Wallet, Rabby or another browser wallet.");
      }
      setPickerOpen(false);
      setConnecting(true);
      try {
        const accounts = await opt.provider.request({ method: "eth_requestAccounts" });
        activeRef.current = opt;
        setActive(opt);
        setAddress(accounts[0] ? getAddress(accounts[0]) : null);
        store.set(opt.id);
        if (Number(await opt.provider.request({ method: "eth_chainId" })) !== chain.id) await switchOn(opt.provider);
        else setChainId(chain.id);
      } catch (e) {
        setError((e as Error).message?.split("\n")[0] ?? "Could not connect");
      } finally {
        setConnecting(false);
      }
    },
    [options, switchOn],
  );

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      onRightChain: chainId === chain.id,
      connecting,
      error,
      options,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
      connect,
      disconnect: () => {
        setAddress(null);
        setActive(null);
        activeRef.current = null;
        store.set(null);
      },
      switchChain: async () => {
        if (active) await switchOn(active.provider);
      },
      wallet: () => {
        if (!active || !address) throw new Error("Connect a wallet first");
        return createWalletClient({ account: address, chain, transport: custom(active.provider) });
      },
      provider: () => active?.provider ?? null,
      publicClient,
      activeName: active?.name ?? null,
    }),
    [address, chainId, connecting, error, options, pickerOpen, connect, active, switchOn],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {pickerOpen && <WalletPicker />}
    </Ctx.Provider>
  );
}

function WalletPicker() {
  const { options, connect, closePicker } = useWallet();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePicker();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePicker]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" onClick={closePicker}>
      <div role="dialog" aria-modal="true" aria-label="Choose a wallet" className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Choose a wallet</h2>
          <button className="grid h-8 w-8 place-items-center rounded-full bg-paper-2" onClick={closePicker} aria-label="Close">
            ×
          </button>
        </div>
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.id}>
              <button
                className="flex w-full items-center gap-3 rounded-xl border border-rule px-4 py-3 text-left transition-colors hover:border-forest hover:bg-paper-2"
                onClick={() => connect(o)}
              >
                {o.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.icon} alt="" className="h-8 w-8 rounded-lg" />
                ) : (
                  <span className="h-8 w-8 rounded-lg bg-paper-2" />
                )}
                <span className="font-medium">{o.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Scalehouse never sees your keys. Your wallet asks you to approve every action.</p>
      </div>
    </div>
  );
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <Providers>");
  return v;
}
