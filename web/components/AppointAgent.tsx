"use client";

import { useRouter } from "next/navigation";
import type { Abi, Address } from "viem";
import { useWallet } from "./Providers";
import { useTx } from "./useTx";
import { scaleTicketAbi } from "@/lib/abi";
import { short } from "@/lib/format";
import { agentAddress, scaleTicketAddress } from "@/lib/network";

/** Inline "appoint the agent" action for the house banner, so the owner never has to hunt for it. */
export function AppointAgent({ houseId, owner }: { houseId: number; owner: Address }) {
  const router = useRouter();
  const { address } = useWallet();
  const { send, pending, error } = useTx();
  const isOwner = !!address && address.toLowerCase() === owner.toLowerCase();

  if (!isOwner) {
    return (
      <p className="mt-2 text-muted">
        {address ? `You're connected as ${short(address)}. ` : ""}Connect the owner wallet ({short(owner)}) to switch.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        className="btn"
        disabled={!!pending}
        onClick={async () => {
          const r = await send("Appointing the agent", {
            address: scaleTicketAddress,
            abi: scaleTicketAbi as Abi,
            functionName: "setAgent",
            args: [BigInt(houseId), agentAddress],
          });
          if (r) router.refresh();
        }}
      >
        {pending ? `${pending}…` : "Appoint agent"}
      </button>
      {error && <span className="text-red">{error}</span>}
    </div>
  );
}
