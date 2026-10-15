import type { Address, Hex } from "viem";
import { chain, scaleTicketAddress } from "./network";

/** EIP-712 domain and type for a witness confirmation. Must match ScaleTicket's CONFIRM_TYPEHASH. */
export const confirmTypedData = (msg: {
  ticketId: bigint;
  observedQuantity: bigint;
  payee: Address;
  evidenceHash: Hex;
  deadline: bigint;
}) =>
  ({
    domain: { name: "ScaleTicket", version: "1", chainId: chain.id, verifyingContract: scaleTicketAddress },
    types: {
      Confirm: [
        { name: "ticketId", type: "uint256" },
        { name: "observedQuantity", type: "uint64" },
        { name: "payee", type: "address" },
        { name: "evidenceHash", type: "bytes32" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Confirm",
    message: msg,
  }) as const;
