import Link from "next/link";
import { notFound } from "next/navigation";
import { OwnerPanel } from "@/components/OwnerPanel";
import { RunAgentButton } from "@/components/RunAgentButton";
import { Stamp } from "@/components/Stamp";
import { housePosition, readHouse } from "@/lib/chain";
import { db, must } from "@/lib/db";
import { grossOf, money, qty, short, timeAgo } from "@/lib/format";
import { freezeReasons, houseName, houseRates, houseTeam, houseTickets, labels } from "@/lib/house";
import { syncIfStale } from "@/lib/indexer";
import { agentAddress, explorerAddress, explorerTx, tokenSymbol } from "@/lib/network";
import { REASON_TEXT } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RunRow {
  id: number;
  trigger: string;
  summary: string | null;
  transcript: { actions?: { tool: string; ticketId?: number; outcome: string; txHash?: string }[] } | null;
  started_at: string;
}

export default async function HousePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await syncIfStale();
  const house = await readHouse(id);
  if (!house) notFound();

  const [name, position, tickets, rates, team, names, frozen, runsRes] = await Promise.all([
    houseName(id),
    housePosition(house),
    houseTickets(id),
    houseRates(id),
    houseTeam(id),
    labels(id),
    freezeReasons(id),
    db().from("sh_agent_runs").select("id,trigger,summary,transcript,started_at").eq("house_id", id).order("started_at", { ascending: false }).limit(5),
  ]);
  const runs = must(runsRes, "sh_agent_runs") as RunRow[];
  const symbol = tokenSymbol(house.token);
  const agentAppointed = house.agent.toLowerCase() === agentAddress.toLowerCase();
  const label = (a: string) => names.get(a.toLowerCase()) ?? short(a);
  const now = Date.now() / 1000;
  const activeRates = rates.filter((r) => r.active && r.validUntil > now);
  const ordered = [...tickets].reverse();

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">House #{id}</p>
          <h1 className="font-serif text-4xl font-bold">{name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Pays from{" "}
            <a className="link figure" href={explorerAddress(house.owner)} target="_blank" rel="noreferrer">
              {short(house.owner)}
            </a>{" "}
            in {symbol}
            {house.paused && <span className="stamp ml-2 text-frozen">paused</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/house/${id}/cut`} className="btn">
            Cut a ticket
          </Link>
          {agentAppointed && <RunAgentButton houseId={id} />}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Wallet balance" value={money(position.balance, symbol)} />
        <Figure label="Approved for Scalehouse" value={money(position.allowance, symbol)} />
        <Figure label="Paid today" value={`${money(position.spentToday, symbol)}`} sub={`of ${money(house.dailyCap, symbol)} daily limit`} />
        <Figure label="Can pay right now" value={money(position.spendable, symbol)} sub={`max ${money(house.maxTicket, symbol)} per ticket`} />
      </section>

      {!agentAppointed && (
        <div className="sheet border-waiting p-4 text-sm">
          This house hasn&apos;t appointed the Scalehouse agent, so nothing here is paid automatically.
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h2 className="mb-3 font-serif text-2xl font-bold">Tickets</h2>
          {ordered.length === 0 ? (
            <div className="sheet p-6 text-ink-soft">No tickets yet. A clerk cuts the first one when goods arrive or work is delivered.</div>
          ) : (
            <div className="sheet ruled">
              {ordered.map((t) => {
                const q = t.confirmedQuantity || t.quantity;
                const why = frozen.get(t.id);
                return (
                  <Link key={t.id} href={`/t/${t.id}`} className="block px-4 py-3 hover:bg-paper">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="figure">#{t.id}</span>
                      <span className="flex-1 truncate">{label(t.payee)}</span>
                      <span className="figure text-ink-soft">{qty(q)} × {money(t.unitPrice, symbol)}</span>
                      <span className="figure">{money(grossOf(q, t.unitPrice), symbol)}</span>
                      <Stamp status={t.status} />
                    </div>
                    {t.status === "Frozen" && why && <p className="mt-1 text-xs text-frozen">{REASON_TEXT[why]}</p>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-serif text-2xl font-bold">Posted prices</h2>
            <div className="sheet ruled text-sm">
              {activeRates.length === 0 && <p className="px-4 py-3 text-ink-soft">No prices posted yet.</p>}
              {activeRates.map((r) => (
                <div key={r.rateId} className="flex justify-between px-4 py-3">
                  <span>{r.label}</span>
                  <span className="figure">{money(r.unitPrice, symbol)} / unit</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-serif text-2xl font-bold">Team</h2>
            <div className="sheet ruled text-sm">
              {team.length === 0 && <p className="px-4 py-3 text-ink-soft">No clerks or witnesses yet.</p>}
              {team.map((m) => (
                <div key={m.address} className="flex justify-between gap-2 px-4 py-3">
                  <span className="truncate">{label(m.address)}</span>
                  <span className="text-ink-soft">{[m.roles & 1 ? "clerk" : null, m.roles & 2 ? "witness" : null].filter(Boolean).join(" + ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl font-bold">What the agent did</h2>
        {runs.length === 0 ? (
          <div className="sheet p-6 text-ink-soft">The agent hasn&apos;t run for this house yet. It runs when a ticket is confirmed.</div>
        ) : (
          <div className="space-y-3">
            {runs.map((r) => (
              <div key={r.id} className="sheet p-4">
                <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
                  <span>{r.trigger}</span>
                  <span>{timeAgo(new Date(r.started_at).getTime() / 1000)}</span>
                </div>
                {r.summary && <p className="whitespace-pre-wrap text-sm">{r.summary}</p>}
                {r.transcript?.actions?.length ? (
                  <ul className="mt-3 space-y-1 text-xs">
                    {r.transcript.actions.map((a, i) => (
                      <li key={i} className="figure flex flex-wrap gap-2">
                        <span>{a.tool}{a.ticketId ? ` #${a.ticketId}` : ""}</span>
                        <span className={a.outcome.startsWith("PAID") ? "text-paid" : a.outcome.startsWith("FROZEN") ? "text-frozen" : "text-ink-soft"}>{a.outcome}</span>
                        {a.txHash && (
                          <a className="link" href={explorerTx(a.txHash)} target="_blank" rel="noreferrer">
                            tx
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <OwnerPanel
        houseId={id}
        owner={house.owner}
        token={house.token}
        symbol={symbol}
        agentAppointed={agentAppointed}
        paused={house.paused}
        limits={{ maxTicket: house.maxTicket.toString(), dailyCap: house.dailyCap.toString(), toleranceBps: house.quantityToleranceBps }}
        frozen={tickets.filter((t) => t.status === "Frozen").map((t) => ({ id: t.id, reason: frozen.get(t.id) ?? null }))}
      />
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="sheet px-4 py-3">
      <div className="text-xs uppercase tracking-[0.12em] text-ink-soft">{label}</div>
      <div className="figure mt-1 text-xl">{value}</div>
      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}
