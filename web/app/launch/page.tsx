"use client";

import { useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  numberToHex,
  parseEther,
  type Address,
} from "viem";
import { scaleTicketAbi } from "@/lib/abi";
import { scaleTicketBytecode } from "@/lib/bytecode";
import { NETWORKS } from "@/lib/network";
import { explain } from "@/components/useTx";
import { useWallet } from "@/components/Providers";

const main = NETWORKS.mainnet.chain;
const pub = createPublicClient({ chain: main, transport: http(main.rpcUrls.default.http[0]) });
const AGENT = (process.env.NEXT_PUBLIC_MAINNET_AGENT_ADDRESS ?? "") as Address;

/**
 * One-time mainnet launch, run from the owner's own browser wallet: deploy ScaleTicket, then send
 * the agent a little USDC for gas. Nothing here needs a private key outside the wallet.
 */
export default function Launch() {
  const [account, setAccount] = useState<Address | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<{ address: Address; block: bigint; tx: string } | null>(null);
  const [funded, setFunded] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const { provider, openPicker } = useWallet();
  const wallet = () => createWalletClient({ account: account!, chain: main, transport: custom(provider()!) });

  async function connect() {
    setError(null);
    const p = provider();
    if (!p) {
      openPicker();
      return;
    }
    try {
      const [a] = await p.request({ method: "eth_requestAccounts" });
      const hexId = numberToHex(main.id);
      try {
        await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
      } catch (e) {
        if ((e as { code?: number }).code !== 4902) throw e;
        await p.request({
          method: "wallet_addEthereumChain",
          params: [{ chainId: hexId, chainName: main.name, nativeCurrency: main.nativeCurrency, rpcUrls: [...main.rpcUrls.default.http], blockExplorerUrls: [main.blockExplorers.default.url] }],
        });
      }
      const addr = getAddress(a);
      setAccount(addr);
      const b = await pub.getBalance({ address: addr });
      setBalance((Number(b) / 1e18).toFixed(4));
    } catch (e) {
      setError(explain(e));
    }
  }

  async function deploy() {
    setError(null);
    setBusy("Confirm the deployment in your wallet…");
    try {
      const hash = await wallet().deployContract({ abi: scaleTicketAbi, bytecode: scaleTicketBytecode, args: [account!] });
      setBusy("Waiting for Arc to confirm…");
      const r = await pub.waitForTransactionReceipt({ hash });
      if (r.status !== "success" || !r.contractAddress) throw new Error("Deployment reverted");
      setDeployed({ address: r.contractAddress, block: r.blockNumber, tx: hash });
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(null);
    }
  }

  async function fundAgent() {
    setError(null);
    setBusy("Confirm the transfer in your wallet…");
    try {
      const hash = await wallet().sendTransaction({ to: AGENT, value: parseEther("0.25") });
      await pub.waitForTransactionReceipt({ hash });
      setFunded(hash);
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(null);
    }
  }

  const ex = main.blockExplorers.default.url;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-6">
      <div>
        <span className="tag">One-time setup</span>
        <h1 className="display mt-5 text-5xl">Launch on {main.name}</h1>
        <p className="mt-3 text-muted">
          Deploys the ScaleTicket contract from your own wallet, then sends the Scalehouse agent a little USDC for network fees.
          Your keys never leave your wallet. Deploying costs about $0.07.
        </p>
      </div>

      <ol className="space-y-4">
        <Step n={1} title="Connect the funded wallet" done={!!account}>
          {account ? (
            <p className="figure text-sm text-muted">
              {account} · {balance} USDC
            </p>
          ) : (
            <button className="btn" onClick={connect}>
              {provider() ? "Use this wallet on Arc mainnet" : "Choose a wallet"}
            </button>
          )}
        </Step>

        <Step n={2} title="Deploy ScaleTicket" done={!!deployed}>
          {deployed ? (
            <div className="space-y-1 text-sm">
              <p className="figure break-all">{deployed.address}</p>
              <p className="text-muted">
                Block {deployed.block.toString()} ·{" "}
                <a className="link" href={`${ex}/tx/${deployed.tx}`} target="_blank" rel="noreferrer">
                  view transaction
                </a>
              </p>
            </div>
          ) : (
            <button className="btn" disabled={!account || !!busy} onClick={deploy}>
              Deploy (≈ $0.07)
            </button>
          )}
        </Step>

        <Step n={3} title="Give the agent gas" done={!!funded}>
          <p className="mb-2 text-sm text-muted">
            Sends 0.25 USDC to the agent <span className="figure">{AGENT || "(not configured)"}</span>, enough for a few hundred
            decisions.
          </p>
          {funded ? (
            <a className="link text-sm" href={`${ex}/tx/${funded}`} target="_blank" rel="noreferrer">
              Sent · view transaction
            </a>
          ) : (
            <button className="btn" disabled={!account || !AGENT || !!busy} onClick={fundAgent}>
              Send 0.25 USDC
            </button>
          )}
        </Step>
      </ol>

      {busy && <p className="text-sm text-bronze">{busy}</p>}
      {error && <p className="text-sm text-red">{error}</p>}
      {deployed && funded && (
        <div className="card p-5 text-sm">
          <p className="font-semibold">Done. Send these two public values to finish the switch to mainnet:</p>
          <p className="figure mt-2 break-all">Contract: {deployed.address}</p>
          <p className="figure">Block: {deployed.block.toString()}</p>
        </div>
      )}
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className={`figure grid h-7 w-7 place-items-center rounded-full text-xs ${done ? "bg-forest text-lime" : "bg-paper-2 text-ink"}`}>
          {done ? "✓" : n}
        </span>
        <span className="font-semibold">{title}</span>
      </div>
      {children}
    </li>
  );
}
