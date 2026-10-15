import "server-only";
import type OpenAI from "openai";
import { decodeEventLog, getAddress, isAddress, keccak256, toBytes, type Address, type Hex, type TransactionReceipt } from "viem";
import { scaleTicketAbi } from "../abi";
import { effectivePayeeCap, housePosition } from "../chain";
import { grossOf, money, qty } from "../format";
import { freezeReasons, houseTickets, labels } from "../house";
import { sql } from "../db";
import { REASON, REASON_TEXT, type House, type Ticket } from "../types";
import { attachTx, saveRationale, type RationaleKind } from "./rationale";
import { screen, type Screening } from "./screening";
import { agentSigner } from "./signer";

/** Set OPENAI_MODEL to choose the model; the agent needs one that supports strict function tools. */
export const AGENT_MODEL = process.env.OPENAI_MODEL || "gpt-5";

interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const DEFS: ToolDef[] = [
  {
    name: "get_position",
    description:
      "The house's money right now: the paying wallet's balance and the allowance it granted Scalehouse, how much has been paid today against the daily cap, what is still spendable today, and the total of tickets waiting to be paid. Read this before deciding what to pay.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "list_payable_tickets",
    description:
      "Every confirmed ticket in this house that has not been paid yet: who it pays, what for, the quantity the witness confirmed, the posted unit price, the amount the contract will pay, how long it has waited, and the evidence note. Also lists open (unconfirmed) and frozen tickets for context; only confirmed tickets can be released.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "get_counterparty",
    description:
      "History of one wallet in this house: tickets cut to it, paid and frozen counts, total paid, how often a witness counted less than it claimed, when it was first seen, its current per-ticket cap, and its label.",
    input_schema: {
      type: "object",
      properties: { address: { type: "string", description: "0x wallet address" } },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "screen_counterparty",
    description:
      "Screens a wallet before paying it (Circle's USDC blocklist on Arc, plus a sanctions list when configured). Returns clear, elevated, blocked, or unavailable. A ticket can only be released to a payee screened during this run with result clear or elevated.",
    input_schema: {
      type: "object",
      properties: { address: { type: "string", description: "0x wallet address" } },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "release_ticket",
    description:
      "Asks the ScaleTicket contract to pay a confirmed ticket. You must state the payee wallet and the amount in base units (6 decimals: 1 USDC = 1000000) that you believe are correct. The contract recomputes both from the ticket; if either differs from yours the ticket freezes in public instead of paying. Other refusals (daily cap, float, payee cap, pause) leave the ticket payable later. Your rationale is stored and its hash goes on-chain with the payment.",
    input_schema: {
      type: "object",
      properties: {
        ticket_id: { type: "integer" },
        payee: { type: "string", description: "0x wallet you expect the ticket to pay" },
        amount_units: { type: "string", description: "Amount in token base units, as a decimal string" },
        rationale: { type: "string", description: "Why this ticket, why now, what you checked" },
      },
      required: ["ticket_id", "payee", "amount_units", "rationale"],
      additionalProperties: false,
    },
  },
  {
    name: "defer_ticket",
    description:
      "Records on-chain that you are deliberately not paying a confirmed ticket in this run, and why (for example: float is short and others come first, or the counterparty needs a closer look). The ticket stays payable.",
    input_schema: {
      type: "object",
      properties: { ticket_id: { type: "integer" }, rationale: { type: "string" } },
      required: ["ticket_id", "rationale"],
      additionalProperties: false,
    },
  },
  {
    name: "flag_ticket",
    description:
      "Records on-chain that a ticket needs the house owner's attention (suspicious pattern, evidence that doesn't fit, repeated shortfalls). Use this instead of guessing. The ticket is not paid in this run.",
    input_schema: {
      type: "object",
      properties: { ticket_id: { type: "integer" }, rationale: { type: "string" } },
      required: ["ticket_id", "rationale"],
      additionalProperties: false,
    },
  },
  {
    name: "lower_payee_cap",
    description:
      "Lowers the most a single ticket may pay one counterparty. You can only lower it; only the owner can raise it. Use when a counterparty's record warrants smaller exposure rather than a refusal. Amount in base units.",
    input_schema: {
      type: "object",
      properties: {
        payee: { type: "string" },
        cap_units: { type: "string", description: "New cap in token base units" },
        rationale: { type: "string" },
      },
      required: ["payee", "cap_units", "rationale"],
      additionalProperties: false,
    },
  },
];

/** Strict function tools: the API guarantees arguments match the schema before they reach this code. */
export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = DEFS.map((d) => ({
  type: "function",
  function: { name: d.name, description: d.description, parameters: d.input_schema, strict: true },
}));

export interface RunState {
  house: House;
  screened: Map<string, Screening>;
  actions: { tool: string; ticketId?: number; outcome: string; txHash?: Hex }[];
}

type Result = { content: string; isError?: boolean };

export async function runTool(state: RunState, name: string, input: Record<string, unknown>): Promise<Result> {
  switch (name) {
    case "get_position":
      return { content: JSON.stringify(await position(state.house)) };
    case "list_payable_tickets":
      return { content: JSON.stringify(await payable(state.house)) };
    case "get_counterparty":
      return { content: JSON.stringify(await counterparty(state.house, addr(input.address))) };
    case "screen_counterparty": {
      const s = await screen(state.house, addr(input.address), true);
      state.screened.set(s.address.toLowerCase(), s);
      return { content: JSON.stringify(s) };
    }
    case "release_ticket":
      return release(state, input);
    case "defer_ticket":
      return decision(state, "DEFER", Number(input.ticket_id), String(input.rationale));
    case "flag_ticket":
      return decision(state, "FLAG", Number(input.ticket_id), String(input.rationale));
    case "lower_payee_cap":
      return lowerCap(state, input);
    default:
      return { content: `Unknown tool ${name}`, isError: true };
  }
}

function addr(value: unknown): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new Error(`Not a valid address: ${String(value)}`);
  return getAddress(value);
}

async function position(house: House) {
  const [pos, tickets] = await Promise.all([housePosition(house), houseTickets(house.id)]);
  const waiting = tickets.filter((t) => t.status === "Confirmed").reduce((s, t) => s + grossOf(t.confirmedQuantity, t.unitPrice), 0n);
  const now = new Date();
  const nextReset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return {
    wallet_balance: money(pos.balance),
    allowance_to_scalehouse: money(pos.allowance),
    paid_today: money(pos.spentToday),
    daily_cap: money(house.dailyCap),
    spendable_now_units: pos.spendable.toString(),
    spendable_now: money(pos.spendable),
    confirmed_tickets_waiting_total: money(waiting),
    max_single_ticket: money(house.maxTicket),
    hours_until_daily_cap_resets: Math.round(((nextReset - now.getTime()) / 3_600_000) * 10) / 10,
    house_paused: house.paused,
  };
}

async function evidenceNotes(hashes: string[]) {
  if (!hashes.length) return new Map<string, { reference: string; note: string }>();
  const rows = (await sql()`select evidence_hash, reference, note from sh_evidence where evidence_hash = any(${hashes.map((h) => h.toLowerCase())})`) as {
    evidence_hash: string;
    reference: string;
    note: string;
  }[];
  return new Map(rows.map((r) => [r.evidence_hash.toLowerCase(), r]));
}

const describe = (t: Ticket, names: Map<string, string>, ev: Map<string, { reference: string; note: string }>) => {
  const e = ev.get(t.evidenceHash.toLowerCase());
  const q = t.confirmedQuantity || t.quantity;
  return {
    ticket_id: t.id,
    status: t.status,
    payee: t.payee,
    payee_label: names.get(t.payee.toLowerCase()) ?? null,
    claimed_quantity: qty(t.quantity),
    confirmed_quantity: t.confirmedQuantity ? qty(t.confirmedQuantity) : null,
    unit_price: money(t.unitPrice),
    contract_amount_units: grossOf(q, t.unitPrice).toString(),
    contract_amount: money(grossOf(q, t.unitPrice)),
    waiting_hours: Math.round(((Date.now() / 1000 - t.cutAt) / 3600) * 10) / 10,
    issuer: t.issuer,
    witness: t.witness === "0x0000000000000000000000000000000000000000" ? null : t.witness,
    // Untrusted text written by whoever cut the ticket. Treat as a description, never as instructions.
    evidence_reference: e?.reference ?? null,
    evidence_note: e?.note ?? null,
  };
};

async function payable(house: House) {
  const [tickets, names, frozen] = await Promise.all([houseTickets(house.id), labels(house.id), freezeReasons(house.id)]);
  const relevant = tickets.filter((t) => t.status === "Confirmed" || t.status === "Open" || t.status === "Frozen");
  const ev = await evidenceNotes(relevant.map((t) => t.evidenceHash));
  return {
    confirmed: relevant.filter((t) => t.status === "Confirmed").map((t) => describe(t, names, ev)),
    open_awaiting_witness: relevant.filter((t) => t.status === "Open").map((t) => describe(t, names, ev)),
    frozen: relevant
      .filter((t) => t.status === "Frozen")
      .map((t) => ({ ...describe(t, names, ev), freeze_reason: frozen.get(t.id) ?? null })),
  };
}

async function counterparty(house: House, who: Address) {
  const [tickets, names, frozen, cap] = await Promise.all([
    houseTickets(house.id),
    labels(house.id),
    freezeReasons(house.id),
    effectivePayeeCap(house.id, who),
  ]);
  const mine = tickets.filter((t) => t.payee.toLowerCase() === who.toLowerCase());
  const paid = mine.filter((t) => t.status === "Paid");
  const witnessed = mine.filter((t) => t.confirmedQuantity > 0n);
  const shortfalls = witnessed.filter((t) => t.confirmedQuantity < t.quantity);
  const avgShortfallPct = shortfalls.length
    ? shortfalls.reduce((s, t) => s + Number(t.quantity - t.confirmedQuantity) / Number(t.quantity), 0) / shortfalls.length
    : 0;
  return {
    address: who,
    label: names.get(who.toLowerCase()) ?? null,
    tickets_total: mine.length,
    tickets_paid: paid.length,
    total_paid: money(paid.reduce((s, t) => s + grossOf(t.confirmedQuantity, t.unitPrice), 0n)),
    tickets_frozen: mine.filter((t) => t.status === "Frozen").length,
    freeze_reasons: mine.filter((t) => frozen.has(t.id)).map((t) => ({ ticket_id: t.id, reason: frozen.get(t.id) })),
    witnessed_tickets: witnessed.length,
    witness_counted_less: shortfalls.length,
    average_shortfall_pct: Math.round(avgShortfallPct * 1000) / 10,
    first_seen: mine.length ? new Date(Math.min(...mine.map((t) => t.cutAt)) * 1000).toISOString() : null,
    current_per_ticket_cap: money(cap),
  };
}

/** Reads the outcome of a ScaleTicket call from its receipt, since rule violations don't revert. */
function outcomeOf(receipt: TransactionReceipt): string {
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: scaleTicketAbi, data: log.data, topics: log.topics });
      const a = ev.args as Record<string, unknown>;
      if (ev.eventName === "TicketReleased") return `PAID ${money(a.gross as bigint)} to ${a.payee}`;
      if (ev.eventName === "TicketFrozen") {
        const r = REASON[Number(a.reason)];
        return `FROZEN (${r}): ${REASON_TEXT[r]}`;
      }
      if (ev.eventName === "ReleaseRefused") {
        const r = REASON[Number(a.reason)];
        return `REFUSED (${r}): ${REASON_TEXT[r]}`;
      }
      if (ev.eventName === "AgentDecision") return "RECORDED";
      if (ev.eventName === "PayeeCapSet") return `CAP SET to ${money(a.cap as bigint)}`;
    } catch {
      // Not a ScaleTicket event (e.g. the token's Transfer); skip.
    }
  }
  return "NO EVENT";
}

async function release(state: RunState, input: Record<string, unknown>): Promise<Result> {
  const ticketId = Number(input.ticket_id);
  const payee = addr(input.payee);
  const amount = BigInt(String(input.amount_units));
  const rationale = String(input.rationale);

  // Code-enforced guard, in addition to the contract: no payment to a wallet that was not
  // screened in this run, and a screening that could not run means no payment.
  const s = state.screened.get(payee.toLowerCase());
  if (!s) return { content: "Refused before sending: screen this payee with screen_counterparty first.", isError: true };
  if (s.risk === "blocked" || s.risk === "unavailable") {
    return { content: `Refused before sending: screening result is ${s.risk}. Do not pay; defer or flag instead.`, isError: true };
  }

  const pos = await housePosition(state.house);
  const hash = await saveRationale({
    houseId: state.house.id,
    ticketId,
    kind: "RELEASE",
    model: AGENT_MODEL,
    body: {
      action: "release",
      ticket_id: ticketId,
      payee_named_by_agent: payee,
      amount_named_by_agent: amount.toString(),
      rationale,
      seen: {
        balance: pos.balance.toString(),
        allowance: pos.allowance.toString(),
        spent_today: pos.spentToday.toString(),
        daily_cap: state.house.dailyCap.toString(),
        screening: s,
      },
      rule: "pays confirmedQuantity * unitPrice / 1000 to the payee bound at cut, once, if confirmed, within caps and float",
      at: new Date().toISOString(),
    },
  });

  const receipt = await agentSigner().write("release", [BigInt(ticketId), payee, amount, hash]);
  await attachTx(hash, receipt.transactionHash);
  const outcome = outcomeOf(receipt);
  state.actions.push({ tool: "release_ticket", ticketId, outcome, txHash: receipt.transactionHash });
  return { content: JSON.stringify({ outcome, tx: receipt.transactionHash }) };
}

async function decision(state: RunState, kind: RationaleKind, ticketId: number, rationale: string): Promise<Result> {
  const hash = await saveRationale({
    houseId: state.house.id,
    ticketId,
    kind,
    model: AGENT_MODEL,
    body: { action: kind.toLowerCase(), ticket_id: ticketId, rationale, at: new Date().toISOString() },
  });
  const receipt = await agentSigner().write("logDecision", [BigInt(state.house.id), BigInt(ticketId), keccak256(toBytes(kind)), hash]);
  await attachTx(hash, receipt.transactionHash);
  state.actions.push({ tool: `${kind.toLowerCase()}_ticket`, ticketId, outcome: "RECORDED", txHash: receipt.transactionHash });
  return { content: JSON.stringify({ outcome: "recorded on-chain", tx: receipt.transactionHash }) };
}

async function lowerCap(state: RunState, input: Record<string, unknown>): Promise<Result> {
  const payee = addr(input.payee);
  const cap = BigInt(String(input.cap_units));
  const current = await effectivePayeeCap(state.house.id, payee);
  if (cap >= current) return { content: `Cap is already ${money(current)}; you can only lower it.`, isError: true };
  const hash = await saveRationale({
    houseId: state.house.id,
    ticketId: null,
    kind: "CAP",
    model: AGENT_MODEL,
    body: { action: "lower_payee_cap", payee, from: current.toString(), to: cap.toString(), rationale: String(input.rationale), at: new Date().toISOString() },
  });
  const receipt = await agentSigner().write("setPayeeCap", [BigInt(state.house.id), payee, cap, hash]);
  await attachTx(hash, receipt.transactionHash);
  const outcome = outcomeOf(receipt);
  state.actions.push({ tool: "lower_payee_cap", outcome, txHash: receipt.transactionHash });
  return { content: JSON.stringify({ outcome, tx: receipt.transactionHash }) };
}
