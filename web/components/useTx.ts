"use client";

import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Abi, type TransactionReceipt } from "viem";
import { useWallet } from "./Providers";

/** Sends one contract write from the connected wallet and waits for it to land. */
export function useTx() {
  const { wallet, publicClient } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(
    label: string,
    call: { address: `0x${string}`; abi: Abi; functionName: string; args: readonly unknown[] },
  ): Promise<TransactionReceipt | null> {
    setError(null);
    setPending(label);
    try {
      const client = wallet();
      // Simulate first so a contract refusal shows its reason before the wallet pops up.
      const { request } = await publicClient.simulateContract({ ...call, account: client.account! } as Parameters<typeof publicClient.simulateContract>[0]);
      const hash = await client.writeContract(request as Parameters<typeof client.writeContract>[0]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted");
      return receipt;
    } catch (e) {
      setError(explain(e));
      return null;
    } finally {
      setPending(null);
    }
  }

  return { send, pending, error, setError };
}

/** Turns contract custom errors into sentences a shop owner can act on. */
export function explain(e: unknown): string {
  const MAP: Record<string, string> = {
    DuplicateEvidence: "This reference from this payee is already on a ticket. The same document can't be paid twice.",
    NotIssuer: "This wallet isn't a clerk in this house. The owner can add it.",
    NotWitness: "This wallet isn't a witness in this house.",
    WitnessConflict: "The person who cut the ticket or gets paid can't also witness it.",
    RoleConflict: "The agent can't also be a clerk or witness, and a clerk or witness can't be the agent.",
    BadPayee: "That payee isn't allowed. It can't be the house owner or the agent.",
    RateUnavailable: "That price isn't active (or has expired). The owner can post it again.",
    OverTicketCap: "That's above this house's limit for one ticket.",
    BadLimits: "The daily limit must be at least the single-ticket limit, and tolerance at most 20%.",
    BadQuantity: "The quantity is zero or too small to pay anything.",
    NotHouseOwner: "Only the house owner can do this.",
    HouseIsPaused: "This house is paused.",
    BadStatus: "This ticket isn't in a state where that can happen.",
  };
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "";
      return MAP[name] ?? `The contract refused: ${name || revert.shortMessage}`;
    }
    if (/User rejected|denied/i.test(e.message)) return "You cancelled it in your wallet.";
    if (/insufficient funds/i.test(e.message)) return "This wallet doesn't have enough USDC for the network fee.";
    return e.shortMessage;
  }
  return (e as Error)?.message?.split("\n")[0] ?? "Something went wrong";
}
