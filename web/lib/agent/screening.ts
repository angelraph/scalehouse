import "server-only";
import type { Address } from "viem";
import { isUsdcBlocklisted } from "../chain";
import { db, must } from "../db";
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
    const cached = must(
      await db().from("sh_screenings").select("*").eq("house_id", house.id).eq("address", key).maybeSingle(),
      "sh_screenings",
    );
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
  must(
    await db().from("sh_screenings").upsert({ house_id: house.id, address: key, result, risk, screened_at: result.screenedAt }),
    "sh_screenings upsert",
  );
  return result;
}
