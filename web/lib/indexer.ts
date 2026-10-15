import "server-only";
import { parseEventLogs } from "viem";
import { scaleTicketAbi } from "./abi";
import { publicClient } from "./chain";
import { db, must } from "./db";
import { deployBlock, scaleTicketAddress } from "./network";

// Arc's public RPC caps eth_getLogs at 5,000 blocks (~40 minutes at ~0.5s blocks).
const CHUNK = BigInt(process.env.LOG_CHUNK_BLOCKS ?? "5000");
const MAX_CHUNKS_PER_SYNC = Number(process.env.MAX_CHUNKS_PER_SYNC ?? "60");
const SYNC_ID = `scaleticket:${scaleTicketAddress.toLowerCase()}`;

export interface IndexedEvent {
  tx_hash: string;
  log_index: number;
  block_number: number;
  block_time: string | null;
  name: string;
  house_id: number | null;
  ticket_id: number | null;
  args: Record<string, unknown>;
}

const jsonable = (args: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]));

/**
 * Pulls new ScaleTicket events into sh_events, resuming from the stored cursor. Idempotent:
 * rows are keyed by (tx_hash, log_index), so overlapping or concurrent syncs are harmless.
 * Returns how far behind the chain head the index still is.
 */
export async function sync(): Promise<{ indexedTo: bigint; head: bigint; added: number }> {
  const head = await publicClient.getBlockNumber();
  const cursorRow = must<{ last_block: number } | null>(await db().from("sh_sync").select("last_block").eq("id", SYNC_ID).maybeSingle(), "sh_sync");
  let from = cursorRow ? BigInt(cursorRow.last_block) + 1n : deployBlock;
  let added = 0;

  for (let i = 0; i < MAX_CHUNKS_PER_SYNC && from <= head; i++) {
    const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
    const logs = await publicClient.getLogs({ address: scaleTicketAddress, fromBlock: from, toBlock: to });

    if (logs.length) {
      const parsed = parseEventLogs({ abi: scaleTicketAbi, logs });
      const blockTimes = new Map<bigint, string>();
      for (const bn of new Set(parsed.map((l) => l.blockNumber))) {
        const b = await publicClient.getBlock({ blockNumber: bn });
        blockTimes.set(bn, new Date(Number(b.timestamp) * 1000).toISOString());
      }
      const rows: IndexedEvent[] = parsed.map((l) => {
        const args = jsonable(l.args as Record<string, unknown>);
        return {
          tx_hash: l.transactionHash,
          log_index: l.logIndex,
          block_number: Number(l.blockNumber),
          block_time: blockTimes.get(l.blockNumber) ?? null,
          name: l.eventName,
          house_id: args.houseId != null ? Number(args.houseId) : null,
          ticket_id: args.ticketId != null ? Number(args.ticketId) : null,
          args,
        };
      });
      must(await db().from("sh_events").upsert(rows, { onConflict: "tx_hash,log_index" }), "sh_events upsert");
      added += rows.length;
    }

    must(
      await db().from("sh_sync").upsert({ id: SYNC_ID, last_block: Number(to), updated_at: new Date().toISOString() }),
      "sh_sync upsert",
    );
    from = to + 1n;
  }

  return { indexedTo: from - 1n, head, added };
}

/** Syncs only if the index is more than `maxAgeMs` old, so page loads stay fast. */
export async function syncIfStale(maxAgeMs = 15_000) {
  try {
    const row = must<{ updated_at: string } | null>(await db().from("sh_sync").select("updated_at").eq("id", SYNC_ID).maybeSingle(), "sh_sync");
    if (row && Date.now() - new Date(row.updated_at).getTime() < maxAgeMs) return;
    await sync();
  } catch (err) {
    // A failed sync leaves pages showing slightly older history; chain state is still read live.
    console.error("index sync failed", err);
  }
}

export async function eventsForTicket(ticketId: number): Promise<IndexedEvent[]> {
  return must(
    await db().from("sh_events").select("*").eq("ticket_id", ticketId).order("block_number").order("log_index"),
    "sh_events",
  );
}

export async function eventsForHouse(houseId: number, names?: string[]): Promise<IndexedEvent[]> {
  let q = db().from("sh_events").select("*").eq("house_id", houseId);
  if (names) q = q.in("name", names);
  return must(await q.order("block_number").order("log_index"), "sh_events");
}

export async function eventsByName(names: string[], limit = 500): Promise<IndexedEvent[]> {
  return must(
    await db().from("sh_events").select("*").in("name", names).order("block_number", { ascending: false }).limit(limit),
    "sh_events",
  );
}
