import { NextResponse } from "next/server";
import { counts, readHouses } from "@/lib/chain";
import { sync } from "@/lib/indexer";
import { houseTickets } from "@/lib/house";
import { runAgent } from "@/lib/agent/run";
import { agentSigner } from "@/lib/agent/signer";

export const maxDuration = 300;

/**
 * Scheduled sweep: index new events, then run the agent for every house that appointed it and
 * has confirmed tickets waiting (e.g. ones held yesterday because the daily cap was reached).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const synced = await sync();
  const { houseCount } = await counts();
  const houses = await readHouses(Array.from({ length: houseCount }, (_, i) => i + 1));
  const ours = houses.filter((h) => h.agent.toLowerCase() === agentSigner().address.toLowerCase() && !h.paused);

  const runs: { houseId: number; summary?: string; error?: string }[] = [];
  for (const h of ours) {
    const waiting = (await houseTickets(h.id)).some((t) => t.status === "Confirmed");
    if (!waiting) continue;
    try {
      const r = await runAgent(h.id, "scheduled sweep");
      runs.push({ houseId: h.id, summary: r.summary });
    } catch (err) {
      runs.push({ houseId: h.id, error: (err as Error).message });
    }
  }

  return NextResponse.json({ synced: { ...synced, indexedTo: synced.indexedTo.toString(), head: synced.head.toString() }, runs });
}
