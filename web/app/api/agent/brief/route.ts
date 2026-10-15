import { NextResponse } from "next/server";
import OpenAI from "openai";
import { housePosition, readHouse } from "@/lib/chain";
import { sql } from "@/lib/db";
import { grossOf, money, qty, short } from "@/lib/format";
import { freezeReasons, houseName, houseTickets, labels } from "@/lib/house";
import { syncIfStale } from "@/lib/indexer";
import { CHAIN_ID, tokenSymbol } from "@/lib/network";
import { AGENT_MODEL } from "@/lib/agent/tools";

export const maxDuration = 120;
const COOLDOWN_MS = 60_000;

/**
 * The owner's daily brief: a read-only look at the house written in three plain sentences.
 * It moves no money and calls no contract. Stored as an agent run with trigger "brief".
 */
export async function POST(req: Request) {
  const { houseId } = (await req.json().catch(() => ({}))) as { houseId?: number };
  if (!houseId || !Number.isInteger(houseId)) return NextResponse.json({ error: "houseId required" }, { status: 400 });

  const [last] = (await sql()`
    select started_at from sh_agent_runs where chain_id = ${CHAIN_ID} and house_id = ${houseId} and trigger = 'brief'
    order by started_at desc limit 1`) as { started_at: string }[];
  if (last && Date.now() - new Date(last.started_at).getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: "A brief was just written. Try again in a minute." }, { status: 429 });
  }

  const house = await readHouse(houseId);
  if (!house) return NextResponse.json({ error: "Unknown house" }, { status: 404 });
  await syncIfStale();
  const symbol = tokenSymbol(house.token);
  const [name, pos, tickets, names, frozen] = await Promise.all([houseName(houseId), housePosition(house), houseTickets(houseId), labels(houseId), freezeReasons(houseId)]);
  const who = (a: string) => names.get(a.toLowerCase()) ?? short(a);
  const amt = (t: (typeof tickets)[number]) => money(grossOf(t.confirmedQuantity || t.quantity, t.unitPrice), symbol);
  const day = Math.floor(Date.now() / 86_400_000);
  const paidToday = tickets.filter((t) => t.status === "Paid" && Math.floor(t.settledAt / 86400) === day);

  const facts = {
    house: name,
    now: new Date().toISOString(),
    wallet_balance: money(pos.balance, symbol),
    approved_budget_left: money(pos.allowance, symbol),
    paid_today: `${money(pos.spentToday, symbol)} of ${money(house.dailyCap, symbol)} daily limit`,
    can_pay_now: money(pos.spendable, symbol),
    paid_today_tickets: paidToday.map((t) => `#${t.id} ${amt(t)} to ${who(t.payee)}`),
    waiting_for_witness: tickets.filter((t) => t.status === "Open").map((t) => `#${t.id} ${qty(t.quantity)} units, ${amt(t)} to ${who(t.payee)}`),
    confirmed_not_paid: tickets.filter((t) => t.status === "Confirmed").map((t) => `#${t.id} ${amt(t)} to ${who(t.payee)}`),
    frozen: tickets.filter((t) => t.status === "Frozen").map((t) => `#${t.id} ${amt(t)} (${frozen.get(t.id) ?? "unknown reason"})`),
    total_paid_ever: money(tickets.filter((t) => t.status === "Paid").reduce((s, t) => s + grossOf(t.confirmedQuantity, t.unitPrice), 0n), symbol),
  };

  const client = new OpenAI();
  const res = await client.chat.completions.create({
    model: AGENT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are the Scalehouse agent writing a morning brief for a small business owner. Write exactly three short, plain sentences: 1) money: what they can pay today and whether the budget will run low, 2) what's waiting and on whom, 3) anything risky or worth their attention, or say all is in order. Everyday words. No dashes, no semicolons, no lists, no greetings. Use only the facts given.",
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
  });
  const brief = (res.choices[0].message.content ?? "").trim();

  await sql()`
    insert into sh_agent_runs (chain_id, house_id, trigger, model, summary, transcript, finished_at)
    values (${CHAIN_ID}, ${houseId}, 'brief', ${AGENT_MODEL}, ${brief}, ${JSON.stringify({ facts })}::jsonb, now())`;
  return NextResponse.json({ brief, at: new Date().toISOString() });
}
