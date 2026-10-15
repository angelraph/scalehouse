import "server-only";
import type { Address } from "viem";
import { isUsdcBlocklisted } from "../chain";
import { sql } from "../db";
import { CHAIN_ID } from "../network";
import type { House } from "../types";

export type Risk = "clear" | "elevated" | "blocked" | "unavailable";

export interface Screening {
  address: Address;
  risk: Risk;
  checks: { source: string; result: string }[];
  screenedAt: string;
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Screens a counterparty before money moves to it.
 *
 * Always: Circle's own USDC blocklist, read live from the token contract on Arc. A blocklisted
 * address can't receive USDC at all, so paying it would revert or strand funds.
 * When OPENSANCTIONS_API_KEY is set: the OpenSanctions match API for the wallet address.
 *
 * Any check that cannot run makes the result "unavailable", and the agent treats unavailable
 * as do-not-pay. A screening outage never turns into a payment.
 */
export async function screen(house: House, address: Address, force = false): Promise<Screening> {
  const key = address.toLowerCase();
  if (!force) {
    const [cached] = (await sql()`select risk, screened_at, result from sh_screenings where chain_id = ${CHAIN_ID} and house_id = ${house.id} and address = ${key}`) as {
      risk: Risk;
      screened_at: string;
      result: Screening;
    }[];
    if (cached && cached.risk !== "unavailable" && Date.now() - new Date(cached.screened_at).getTime() < MAX_AGE_MS) {
      return cached.result as Screening;
    }
  }

  const checks: Screening["checks"] = [];
  let risk: Risk = "clear";

  try {
    const blocked = await isUsdcBlocklisted(house.token, address);
    checks.push({ source: "Circle USDC blocklist (on-chain)", result: blocked ? "BLOCKLISTED" : "not listed" });
    if (blocked) risk = "blocked";
  } catch (err) {
    checks.push({ source: "Circle USDC blocklist (on-chain)", result: `check failed: ${(err as Error).message}` });
    risk = "unavailable";
  }

  const osKey = process.env.OPENSANCTIONS_API_KEY;
  if (osKey && risk !== "blocked") {
    try {
      const res = await fetch("https://api.opensanctions.org/match/default?algorithm=best", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `ApiKey ${osKey}` },
        body: JSON.stringify({ queries: { q: { schema: "CryptoWallet", properties: { publicKey: [address] } } } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { responses: { q: { results: { score: number; caption: string; match: boolean }[] } } };
      const hits = body.responses.q.results.filter((r) => r.match || r.score >= 0.7);
      checks.push({
        source: "OpenSanctions (wallet match)",
        result: hits.length ? `possible match: ${hits.map((h) => h.caption).join("; ")}` : "no match",
      });
      if (hits.length) risk = "elevated";
    } catch (err) {
      checks.push({ source: "OpenSanctions (wallet match)", result: `check failed: ${(err as Error).message}` });
      if (risk === "clear") risk = "unavailable";
    }
  }

  const result: Screening = { address, risk, checks, screenedAt: new Date().toISOString() };
  await sql()`
    insert into sh_screenings (chain_id, house_id, address, result, risk, screened_at)
    values (${CHAIN_ID}, ${house.id}, ${key}, ${JSON.stringify(result)}::jsonb, ${risk}, ${result.screenedAt})
    on conflict (chain_id, house_id, address) do update set result = excluded.result, risk = excluded.risk, screened_at = excluded.screened_at`;
  return result;
}
