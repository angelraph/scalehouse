import Link from "next/link";
import { notFound } from "next/navigation";
import { OwnerPanel } from "@/components/OwnerPanel";
import { AppointAgent } from "@/components/AppointAgent";
import { ConfirmAll } from "@/components/ConfirmAll";
import { QuickPay } from "@/components/QuickPay";
import { Confirmers } from "@/components/Confirmers";
import { AutoApprove } from "@/components/AutoApprove";
import { BudgetPrompt } from "@/components/BudgetPrompt";
import { RunAgentButton } from "@/components/RunAgentButton";
import { AgentBrief } from "@/components/AgentBrief";
import { Stamp } from "@/components/Stamp";
import { housePosition, readHouse } from "@/lib/chain";
import { sql } from "@/lib/db";
import { grossOf, money, qty, short, timeAgo } from "@/lib/format";
import { freezeReasons, houseName, houseRates, houseTeam, houseTickets, labels } from "@/lib/house";
import { CHECKER_NAME } from "@/lib/autoapprove";
import { confirmersOf } from "@/lib/confirmers";
import { syncIfStale } from "@/lib/indexer";
import { CHAIN_ID, agentAddress, explorerAddress, explorerTx, tokenSymbol } from "@/lib/network";
import { REASON_TEXT } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RunRow {
  id: number;
  trigger: string;
  summary: string | null;
  transcript: { actions?: { tool: string; ticketId?: number; outcome: string; txHash?: string }[] } | null;
  started_at: string;
}

export default async function HousePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const fresh = (await searchParams).new === "1";
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await syncIfStale();
  const house = await readHouse(id);
  if (!house) notFound();

  const [name, position, tickets, rates, team, names, frozen, runsRes, briefRes, linkConfirmers] = await Promise.all([
    houseName(id),
    housePosition(house),
    houseTickets(id),
    houseRates(id),
    houseTeam(id),
    labels(id),
    freezeReasons(id),
    sql()`select id, trigger, summary, transcript, started_at from sh_agent_runs where chain_id = ${CHAIN_ID} and house_id = ${id} and trigger <> 'brief' order by started_at desc limit 5`.catch(() => []),
    sql()`select summary, finished_at from sh_agent_runs where chain_id = ${CHAIN_ID} and house_id = ${id} and trigger = 'brief' order by started_at desc limit 1`.catch(() => []),
    confirmersOf(id).catch(() => []),
  ]);
  // Plain-language names for the wallets Scalehouse created for this house.
  const known = new Map(linkConfirmers.map((c) => [c.address.toLowerCase(), c.name === CHECKER_NAME ? "Auto-approve checker" : `${c.name} (confirms by link)`]));
  const runs = runsRes as RunRow[];
  const brief = (briefRes as { summary: string; finished_at: string }[])[0] ?? null;
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
          <p className="text-sm text-muted">House #{id}</p>
          <h1 className="display text-5xl">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            Pays from{" "}
            <a className="link figure" href={explorerAddress(house.owner)} target="_blank" rel="noreferrer">
              {short(house.owner)}
            </a>{" "}
            in {symbol}
            {house.paused && <span className="tag ml-2 !bg-red-wash !text-red">paused</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/house/${id}/cut`} className="btn">
            Pay from an invoice photo
          </Link>
          {agentAppointed && <RunAgentButton houseId={id} />}
        </div>
      </div>

      {fresh && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-forest p-5">
          <div>
            <div className="font-semibold">Your house is ready.</div>
            <p className="text-sm text-muted">Next: the recorder cuts the first ticket, then sends it to the confirmer. The agent pays the moment it&apos;s confirmed.</p>
          </div>
          <Link href={`/house/${id}/cut`} className="btn">
            Cut the first ticket →
          </Link>
        </div>
      )}

      {agentAppointed && <AgentBrief houseId={id} initial={brief?.summary ?? null} at={brief?.finished_at ?? null} />}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Wallet balance" value={money(position.balance, symbol)} />
        <Figure label="Approved for Scalehouse" value={money(position.allowance, symbol)} />
        <Figure label="Paid today" value={`${money(position.spentToday, symbol)}`} sub={`of ${money(house.dailyCap, symbol)} daily limit`} />
        <Figure label="Can pay right now" value={money(position.spendable, symbol)} sub={`max ${money(house.maxTicket, symbol)} per ticket`} />
      </section>

      {!agentAppointed && (
        <div className="card border-bronze p-4 text-sm">
          {/^0x0{40}$/i.test(house.agent)
            ? <>This house hasn&apos;t appointed the Scalehouse agent, so nothing here is paid automatically.</>
            : <>Scalehouse moved its agent to a Circle-secured wallet. Until the owner switches to it, nothing here is paid automatically.</>}
          <AppointAgent houseId={id} owner={house.owner} />
        </div>
      )}

      <BudgetPrompt owner={house.owner} token={house.token} symbol={symbol} allowance={position.allowance.toString()} dailyCap={house.dailyCap.toString()} />
      {agentAppointed && <QuickPay houseId={id} owner={house.owner} symbol={symbol} maxTicket={house.maxTicket.toString()} houseName={name} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <AutoApprove houseId={id} owner={house.owner} symbol={symbol} />
        <Confirmers houseId={id} owner={house.owner} houseName={name} />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <ConfirmAll
              houseId={id}
              open={tickets.filter((t) => t.status === "Open").map((t) => ({ id: t.id, quantity: t.quantity.toString(), payee: t.payee, payeeLabel: label(t.payee), evidenceHash: t.evidenceHash }))}
          />
          <h2 className="mb-3 display text-3xl">Tickets</h2>
          {ordered.length === 0 ? (
            <div className="card p-6 text-muted">No tickets yet. A clerk cuts the first one when goods arrive or work is delivered.</div>
          ) : (
            <div className="card ruled">
              {ordered.map((t) => {
                const q = t.confirmedQuantity || t.quantity;
                const why = frozen.get(t.id);
                return (
                  <Link key={t.id} href={`/t/${t.id}`} className="block px-4 py-3 hover:bg-paper-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="figure">#{t.id}</span>
                      <span className="flex-1 truncate">{label(t.payee)}</span>
                      <span className="figure text-muted">{qty(q)} × {money(t.unitPrice, symbol)}</span>
                      <span className="figure">{money(grossOf(q, t.unitPrice), symbol)}</span>
                      <Stamp status={t.status} />
                    </div>
                    {t.status === "Frozen" && why && <p className="mt-1 text-xs text-red">{REASON_TEXT[why]}</p>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 display text-3xl">Posted prices</h2>
            <div className="card ruled text-sm">
              {activeRates.length === 0 && <p className="px-4 py-3 text-muted">No prices posted yet.</p>}
              {activeRates.map((r) => (
                <div key={r.rateId} className="flex justify-between px-4 py-3">
                  <span>{r.label}</span>
                  <span className="figure">{money(r.unitPrice, symbol)} / unit</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 display text-3xl">Team</h2>
            <div className="card ruled text-sm">
              {team.length === 0 && <p className="px-4 py-3 text-muted">No clerks or witnesses yet.</p>}
              {team.map((m) => (
                <div key={m.address} className="flex justify-between gap-2 px-4 py-3">
                  <span className="truncate">
                    {m.address.toLowerCase() === house.owner.toLowerCase() ? "You (owner)" : known.get(m.address.toLowerCase()) ?? label(m.address)}
                    <span className="ml-2 figure text-xs text-faint">{short(m.address)}</span>
                  </span>
                  <span className="shrink-0 text-muted">
                    {[m.roles & 1 ? "records payments" : null, m.roles & 2 ? (known.get(m.address.toLowerCase()) === "Auto-approve checker" ? "approves small payments" : "confirms") : null].filter(Boolean).join(" + ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 display text-3xl">What the agent did</h2>
        {runs.length === 0 ? (
          <div className="card p-6 text-muted">The agent hasn&apos;t run for this house yet. It runs when a ticket is confirmed.</div>
        ) : (
          <div className="space-y-3">
            {runs.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
                  <span>{r.trigger}</span>
                  <span>{timeAgo(new Date(r.started_at).getTime() / 1000)}</span>
                </div>
                {r.summary && <p className="whitespace-pre-wrap text-sm">{r.summary}</p>}
                {r.transcript?.actions?.length ? (
                  <ul className="mt-3 space-y-1 text-xs">
                    {r.transcript.actions.map((a, i) => (
                      <li key={i} className="figure flex flex-wrap gap-2">
                        <span>{a.tool}{a.ticketId ? ` #${a.ticketId}` : ""}</span>
                        <span className={a.outcome.startsWith("PAID") ? "text-forest" : a.outcome.startsWith("FROZEN") ? "text-red" : "text-muted"}>{a.outcome}</span>
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
    <div className="card px-4 py-3">
      <div className="text-xs uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="figure mt-1 text-xl">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
