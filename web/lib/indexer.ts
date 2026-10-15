import "server-only";
import { parseEventLogs } from "viem";
import { scaleTicketAbi } from "./abi";
import { publicClient } from "./chain";
import { sql } from "./db";
import { CHAIN_ID, deployBlock, scaleTicketAddress } from "./network";

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
  const [cursorRow] = (await sql()`select last_block from sh_sync where id = ${SYNC_ID}`) as { last_block: string }[];
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
      for (const r of rows) {
        await sql()`
          insert into sh_events (chain_id, tx_hash, log_index, block_number, block_time, name, house_id, ticket_id, args)
          values (${CHAIN_ID}, ${r.tx_hash}, ${r.log_index}, ${r.block_number}, ${r.block_time}, ${r.name}, ${r.house_id}, ${r.ticket_id}, ${JSON.stringify(r.args)}::jsonb)
          on conflict (chain_id, tx_hash, log_index) do nothing`;
      }
      added += rows.length;
    }

    await sql()`
      insert into sh_sync (id, last_block, updated_at) values (${SYNC_ID}, ${Number(to)}, now())
      on conflict (id) do update set last_block = excluded.last_block, updated_at = now()`;
    from = to + 1n;
  }

  return { indexedTo: from - 1n, head, added };
}

/** Syncs only if the index is more than `maxAgeMs` old, so page loads stay fast. */
export async function syncIfStale(maxAgeMs = 15_000) {
  try {
    const [row] = (await sql()`select updated_at from sh_sync where id = ${SYNC_ID}`) as { updated_at: string }[];
    if (row && Date.now() - new Date(row.updated_at).getTime() < maxAgeMs) return;
    await sync();
  } catch (err) {
    // A failed sync leaves pages showing slightly older history; chain state is still read live.
    console.error("index sync failed", err);
  }
}

const asEvents = (rows: unknown) =>
  (rows as IndexedEvent[]).map((r) => ({ ...r, block_number: Number(r.block_number), block_time: r.block_time ? new Date(r.block_time).toISOString() : null }));

export async function eventsForTicket(ticketId: number): Promise<IndexedEvent[]> {
  return asEvents(await sql()`select * from sh_events where chain_id = ${CHAIN_ID} and ticket_id = ${ticketId} order by block_number, log_index`);
}

export async function eventsForHouse(houseId: number, names?: string[]): Promise<IndexedEvent[]> {
  return asEvents(
    names
      ? await sql()`select * from sh_events where chain_id = ${CHAIN_ID} and house_id = ${houseId} and name = any(${names}) order by block_number, log_index`
      : await sql()`select * from sh_events where chain_id = ${CHAIN_ID} and house_id = ${houseId} order by block_number, log_index`,
  );
}

export async function eventsByName(names: string[], limit = 500): Promise<IndexedEvent[]> {
  return asEvents(await sql()`select * from sh_events where chain_id = ${CHAIN_ID} and name = any(${names}) order by block_number desc limit ${limit}`);
}
