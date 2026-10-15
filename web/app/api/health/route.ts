import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain";
import { sql } from "@/lib/db";
import { agentSigner } from "@/lib/agent/signer";
import { chain, scaleTicketAddress } from "@/lib/network";

export const dynamic = "force-dynamic";

const TABLES = ["sh_evidence", "sh_rationales", "sh_events", "sh_sync", "sh_screenings", "sh_agent_runs", "sh_labels"];

/** What's wired up, without revealing any secret: chain, contract, database tables, agent, AI key. */
export async function GET() {
  const out: Record<string, unknown> = { network: chain.name, chainId: chain.id, contract: scaleTicketAddress || null };
  try {
    out.block = Number(await publicClient.getBlockNumber());
    out.contractDeployed = scaleTicketAddress ? (await publicClient.getCode({ address: scaleTicketAddress }))?.length ? true : false : false;
  } catch (e) {
    out.chainError = (e as Error).message.split("\n")[0];
  }
  try {
    const rows = (await sql()`select table_name from information_schema.tables where table_schema = 'public'`) as { table_name: string }[];
    const have = new Set(rows.map((r) => r.table_name));
    out.database = { ok: TABLES.every((t) => have.has(t)), missing: TABLES.filter((t) => !have.has(t)) };
  } catch (e) {
    out.database = { ok: false, error: (e as Error).message.split("\n")[0] };
  }
  try {
    const signer = agentSigner();
    out.agent = { address: signer.address, backend: signer.backend, gas: Number(await publicClient.getBalance({ address: signer.address })) / 1e18 };
  } catch (e) {
    out.agent = { error: (e as Error).message.split("\n")[0] };
  }
  out.openai = Boolean(process.env.OPENAI_API_KEY);
  return NextResponse.json(out);
}
