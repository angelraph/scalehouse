import type { Address, Hex } from "viem";

export const STATUS = ["None", "Open", "Confirmed", "Paid", "Frozen", "Voided"] as const;
export type StatusName = (typeof STATUS)[number];

export const REASON = [
  "None",
  "NotConfirmed",
  "AlreadyPaid",
  "TicketFrozen",
  "TicketVoided",
  "Paused",
  "OverTicketCap",
  "OverPayeeCap",
  "OverDailyCap",
  "InsufficientFloat",
  "QuantityMismatch",
  "AmountMismatch",
  "PayeeMismatch",
] as const;
export type ReasonName = (typeof REASON)[number];

/** Plain-language explanation of every refusal and freeze, shown on the public board. */
export const REASON_TEXT: Record<ReasonName, string> = {
  None: "",
  NotConfirmed: "Nobody has confirmed this yet, so it can't be paid.",
  AlreadyPaid: "This ticket was already paid. It pays once.",
  TicketFrozen: "This ticket is frozen and waiting for the owner's review.",
  TicketVoided: "The owner cancelled this ticket.",
  Paused: "Payments are paused for this house.",
  OverTicketCap: "Above this house's limit for a single ticket.",
  OverPayeeCap: "Above the limit set for this counterparty.",
  OverDailyCap: "Today's spending limit is used up. It can pay tomorrow.",
  InsufficientFloat: "The paying wallet doesn't have enough approved funds right now.",
  QuantityMismatch: "The witness counted a different quantity than the ticket claims.",
  AmountMismatch: "The agent asked to pay a different amount than the rule allows.",
  PayeeMismatch: "The agent named a different wallet than the one locked on the ticket.",
};

export const FREEZE_REASONS: ReasonName[] = ["QuantityMismatch", "AmountMismatch", "PayeeMismatch"];

export interface House {
  id: number;
  owner: Address;
  pendingOwner: Address;
  agent: Address;
  token: Address;
  maxTicket: bigint;
  dailyCap: bigint;
  quantityToleranceBps: number;
  levyBps: number;
  levyRecipient: Address;
  paused: boolean;
}

export interface Ticket {
  id: number;
  houseId: number;
  issuer: Address;
  payee: Address;
  witness: Address;
  rateId: Hex;
  evidenceHash: Hex;
  unitPrice: bigint;
  quantity: bigint;
  confirmedQuantity: bigint;
  cutAt: number;
  settledAt: number;
  status: StatusName;
}

export interface Rate {
  unitPrice: bigint;
  validUntil: number;
  active: boolean;
}
