import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { runAgent } from "@/lib/agent/run";

export const maxDuration = 300;

const MIN_GAP_MS = 60_000;

/**
 * Runs the agent for one house on demand. Anyone may ask: the agent can only do what the
 * contract allows, so the only thing to protect is model spend, hence the per-house cooldown.
 */
export async function POST(req: Request) {
  const { houseId } = (await req.json().catch(() => ({}))) as { houseId?: number };
  if (!houseId || !Number.isInteger(houseId)) return NextResponse.json({ error: "houseId required" }, { status: 400 });

  const last = (await sql()`select started_at from sh_agent_runs where house_id = ${houseId} order by started_at desc limit 1`) as { started_at: string }[];
  if (last[0] && Date.now() - new Date(last[0].started_at).getTime() < MIN_GAP_MS) {
    return NextResponse.json({ error: "The agent just ran for this house. Try again in a minute." }, { status: 429 });
  }

  try {
    const result = await runAgent(houseId, "requested from the house page");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
