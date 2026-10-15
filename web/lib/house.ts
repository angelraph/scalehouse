import "server-only";
import type { Address } from "viem";
import { readTickets } from "./chain";
import { db, must } from "./db";
import { eventsForHouse } from "./indexer";
import type { ReasonName, Ticket } from "./types";
import { REASON } from "./types";

/** All tickets cut in a house, oldest first, read live from the contract. */
export async function houseTickets(houseId: number): Promise<Ticket[]> {
  const cuts = await eventsForHouse(houseId, ["TicketCut"]);
  return readTickets(cuts.map((e) => Number(e.ticket_id)));
}

export interface RateInfo {
  rateId: `0x${string}`;
  label: string;
  unitPrice: bigint;
  validUntil: number;
  active: boolean;
}

/** Current rate card, rebuilt from RateSet events (the contract can't enumerate a mapping). */
export async function houseRates(houseId: number): Promise<RateInfo[]> {
  const events = await eventsForHouse(houseId, ["RateSet"]);
  const latest = new Map<string, RateInfo>();
  for (const e of events) {
    const a = e.args as Record<string, string | boolean>;
    latest.set(String(a.rateId), {
      rateId: a.rateId as `0x${string}`,
      label: String(a.label),
      unitPrice: BigInt(a.unitPrice as string),
      validUntil: Number(a.validUntil),
      active: Boolean(a.active),
    });
  }
  return [...latest.values()];
}

/** Current team (issuers and witnesses), rebuilt from RolesSet events. */
export async function houseTeam(houseId: number): Promise<{ address: Address; roles: number }[]> {
  const events = await eventsForHouse(houseId, ["RolesSet"]);
  const latest = new Map<string, number>();
  for (const e of events) {
    const a = e.args as Record<string, string | number>;
    latest.set(String(a.who).toLowerCase(), Number(a.roles));
  }
  return [...latest.entries()].filter(([, r]) => r > 0).map(([address, roles]) => ({ address: address as Address, roles }));
}

export async function houseName(houseId: number): Promise<string> {
  const [created] = await eventsForHouse(houseId, ["HouseCreated"]);
  return created ? String((created.args as Record<string, unknown>).name) : `House ${houseId}`;
}

export async function labels(houseId: number): Promise<Map<string, string>> {
  const rows = must(await db().from("sh_labels").select("address,label").eq("house_id", houseId), "sh_labels") as {
    address: string;
    label: string;
  }[];
  return new Map(rows.map((r) => [r.address.toLowerCase(), r.label]));
}

/** Why each frozen ticket froze, keyed by ticket id. */
export async function freezeReasons(houseId: number): Promise<Map<number, ReasonName>> {
  const events = await eventsForHouse(houseId, ["TicketFrozen"]);
  const out = new Map<number, ReasonName>();
  for (const e of events) out.set(Number(e.ticket_id), REASON[Number((e.args as Record<string, unknown>).reason)]);
  return out;
}
