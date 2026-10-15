import "server-only";
import { createWalletClient, encodeFunctionData, http, type Address, type Hex, type TransactionReceipt } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { scaleTicketAbi } from "../abi";
import { publicClient, rpcUrl } from "../chain";
import { chain, networkName, scaleTicketAddress } from "../network";

type ScaleTicketWrite = "release" | "logDecision" | "setPayeeCap" | "confirmBySig";

export interface AgentSigner {
  address: Address;
  backend: "circle" | "local";
  write(functionName: ScaleTicketWrite, args: readonly unknown[]): Promise<TransactionReceipt>;
}

let cached: AgentSigner | null = null;

/**
 * The agent's own wallet. It holds only gas money and has exactly one kind of power: calling
 * ScaleTicket as a house's agent. It never holds or can move a house's funds directly.
 *
 * AGENT_SIGNER=circle (production): a Circle Developer-Controlled Wallet signs; no private key
 * ever sits in this process. AGENT_SIGNER=local: a raw key, for testnet and local runs.
 */
export function agentSigner(): AgentSigner {
  if (cached) return cached;
  cached = process.env.AGENT_SIGNER === "local" ? localSigner() : circleSigner();
  return cached;
}

function localSigner(): AgentSigner {
  const key = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
  if (!key) throw new Error("AGENT_PRIVATE_KEY is required when AGENT_SIGNER=local");
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  return {
    address: account.address,
    backend: "local",
    async write(functionName, args) {
      const hash = await wallet.writeContract({
        address: scaleTicketAddress,
        abi: scaleTicketAbi,
        functionName,
        args,
      } as Parameters<typeof wallet.writeContract>[0]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted`);
      return receipt;
    },
  };
}

function circleSigner(): AgentSigner {
  const walletId = process.env.AGENT_CIRCLE_WALLET_ID;
  const address = process.env.AGENT_ADDRESS as Address | undefined;
  if (!walletId || !address) throw new Error("AGENT_CIRCLE_WALLET_ID and AGENT_ADDRESS are required when AGENT_SIGNER=circle");
  const circle = initiateDeveloperControlledWalletsClient({
    // The live key is used on mainnet; the TEST key on testnet.
    apiKey: (networkName === "mainnet" ? process.env.CIRCLEMAINNET_API_KEY : undefined) || process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  return {
    address,
    backend: "circle",
    async write(functionName, args) {
      // Encode locally and send raw calldata, so the exact bytes the agent asked for are what
      // Circle signs. No ABI-string round trip through the API.
      const callData = encodeFunctionData({ abi: scaleTicketAbi, functionName, args } as Parameters<typeof encodeFunctionData>[0]);
      const created = await circle.createContractExecutionTransaction({
        walletId,
        contractAddress: scaleTicketAddress,
        callData,
        fee: { type: "level", config: { feeLevel: "MEDIUM" } },
      });
      const id = created.data?.id;
      if (!id) throw new Error("Circle returned no transaction id");

      for (let attempt = 0; attempt < 60; attempt++) {
        const res = await circle.getTransaction({ id });
        const tx = res.data?.transaction;
        if (tx?.txHash && (tx.state === "COMPLETE" || tx.state === "CONFIRMED")) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: tx.txHash as Hex });
          if (receipt.status !== "success") throw new Error(`Transaction ${tx.txHash} reverted`);
          return receipt;
        }
        if (tx?.state === "FAILED" || tx?.state === "CANCELLED" || tx?.state === "DENIED") {
          throw new Error(`Circle transaction ${id} ${tx.state}: ${tx.errorReason ?? "no reason given"}`);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw new Error(`Timed out waiting for Circle transaction ${id}`);
    },
  };
}
