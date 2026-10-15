import { encodePacked, formatUnits, keccak256, parseUnits, type Address, type Hex } from "viem";
import { QTY_SCALE, TOKEN_DECIMALS } from "./network";

export const money = (units: bigint, symbol = "USDC") => {
  const n = Number(formatUnits(units, TOKEN_DECIMALS));
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${symbol}`;
};

export const toUnits = (amount: string) => parseUnits(amount.trim() || "0", TOKEN_DECIMALS);

/** Quantities are stored with three decimals on-chain (1500 = 1.5). */
export const qty = (q: bigint | number) => {
  const n = Number(q) / QTY_SCALE;
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
};

export const toQty = (value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Quantity must be a positive number");
  return BigInt(Math.round(n * QTY_SCALE));
};

export const short = (addr: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "");

/** Mirrors ScaleTicket's gross computation exactly: quantity * unitPrice / 1000, rounded down. */
export const grossOf = (quantity: bigint, unitPrice: bigint) => (quantity * unitPrice) / BigInt(QTY_SCALE);

export const normalizeReference = (reference: string) => reference.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The evidence identity a ticket is cut against: the payee plus their document reference
 * (invoice number, delivery note, job id). The contract lets one evidence hash back only one
 * live ticket per house, so the same invoice from the same payee can't be presented twice.
 */
export const evidenceHash = (payee: Address, reference: string): Hex =>
  keccak256(encodePacked(["address", "string"], [payee, normalizeReference(reference)]));

export const rateIdOf = (label: string): Hex => keccak256(encodePacked(["string"], [label.trim().toLowerCase()]));

export const timeAgo = (unixSeconds: number) => {
  if (!unixSeconds) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** Stable JSON (sorted keys) so a rationale hashes the same wherever it is recomputed. */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
    }
    return v;
  });
