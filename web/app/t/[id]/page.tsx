import Link from "next/link";
import { notFound } from "next/navigation";
import { Stamp } from "@/components/Stamp";
import { WitnessPanel } from "@/components/WitnessPanel";
import { readHouse, readTicket } from "@/lib/chain";
import { db, evidencePhotoUrl, must } from "@/lib/db";
import { grossOf, money, qty, short } from "@/lib/format";
import { houseName, labels } from "@/lib/house";
import { eventsForTicket, syncIfStale, type IndexedEvent } from "@/lib/indexer";
import { explorerAddress, explorerTx, tokenSymbol } from "@/lib/network";
import { verifyRationale } from "@/lib/agent/rationale";
import { REASON, REASON_TEXT } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RationaleRow {
  rationale_hash: string;
  kind: string;
  model: string;
  rationale: Record<string, unknown>;
  tx_hash: string | null;
  created_at: string;
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await syncIfStale();
  const ticket = await readTicket(id);
  if (!ticket) notFound();

  const [house, name, events, evidence, rationales, names] = await Promise.all([
    readHouse(ticket.houseId),
    houseName(ticket.houseId),
    eventsForTicket(id),
    db().from("sh_evidence").select("*").eq("evidence_hash", ticket.evidenceHash.toLowerCase()).maybeSingle(),
    db().from("sh_rationales").select("*").eq("ticket_id", id).order("created_at"),
    labels(ticket.houseId),
  ]);
  const ev = evidence.data as { reference: string; note: string; photo_path: string | null } | null;
  const rats = must(rationales, "sh_rationales") as RationaleRow[];
  const ratByHash = new Map(rats.map((r) => [r.rationale_hash.toLowerCase(), r]));
  const symbol = house ? tokenSymbol(house.token) : "USDC";
  const q = ticket.confirmedQuantity || ticket.quantity;
  const label = (a: string) => names.get(a.toLowerCase()) ?? short(a);
  const photo = evidencePhotoUrl(ev?.photo_path);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/house/${ticket.houseId}`} className="link text-sm text-ink-soft">
            {name}
          </Link>
          <h1 className="figure mt-1 text-4xl">Ticket #{id}</h1>
        </div>
        <Stamp status={ticket.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <dl className="sheet ruled text-sm">
            <Row k="Pays" v={<a className="link figure" href={explorerAddress(ticket.payee)} target="_blank" rel="noreferrer">{label(ticket.payee)}</a>} />
            <Row k="Claimed quantity" v={<span className="figure">{qty(ticket.quantity)}</span>} />
            <Row k="Witnessed quantity" v={<span className="figure">{ticket.confirmedQuantity ? qty(ticket.confirmedQuantity) : "not yet"}</span>} />
            <Row k="Posted price" v={<span className="figure">{money(ticket.unitPrice, symbol)} / unit</span>} />
            <Row k="Amount the rule pays" v={<span className="figure font-semibold">{money(grossOf(q, ticket.unitPrice), symbol)}</span>} />
            <Row k="Cut by" v={<span className="figure">{label(ticket.issuer)}</span>} />
            <Row k="Witness" v={<span className="figure">{ticket.witness !== "0x0000000000000000000000000000000000000000" ? label(ticket.witness) : "—"}</span>} />
          </dl>

          <div className="sheet p-5">
            <h2 className="mb-3 font-serif text-xl font-bold">Evidence</h2>
            {ev ? (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-ink-soft">Reference: </span>
                  <span className="figure">{ev.reference}</span>
                </p>
                {ev.note && <p className="whitespace-pre-wrap">{ev.note}</p>}
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={`Evidence for ticket ${id}`} className="mt-2 max-h-80 rounded border border-rule" />
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No evidence record was found for this ticket&apos;s hash.</p>
            )}
            <p className="figure mt-3 break-all text-xs text-ink-soft">hash {ticket.evidenceHash}</p>
          </div>

          {ticket.status === "Open" && <WitnessPanel ticketId={id} houseId={ticket.houseId} claimed={ticket.quantity.toString()} payee={ticket.payee} evidenceHash={ticket.evidenceHash} />}
        </div>

        <div className="sheet p-5">
          <h2 className="mb-1 font-serif text-xl font-bold">Replay</h2>
          <p className="mb-5 text-sm text-ink-soft">What happened to this ticket, in order, from the chain. Agent reasoning is checked against the hash it put on-chain.</p>
          <ol className="space-y-5">
            {events.map((e) => (
              <Step key={`${e.tx_hash}-${e.log_index}`} e={e} rationale={ratByHash.get(String((e.args as Record<string, unknown>).rationaleHash ?? "").toLowerCase())} symbol={symbol} label={label} />
            ))}
            {events.length === 0 && <li className="text-sm text-ink-soft">The event index is catching up. Refresh in a moment.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-ink-soft">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Step({ e, rationale, symbol, label }: { e: IndexedEvent; rationale?: RationaleRow; symbol: string; label: (a: string) => string }) {
  const a = e.args as Record<string, string>;
  const reason = a.reason != null ? REASON[Number(a.reason)] : null;
  const content: Record<string, { title: string; body?: string; tone: string }> = {
    TicketCut: { title: "Ticket cut", body: `${qty(BigInt(a.quantity))} at ${money(BigInt(a.unitPrice), symbol)}, payee locked to ${label(a.payee)}`, tone: "text-ink" },
    TicketConfirmed: {
      title: "Witness counted",
      body: `${label(a.witness)} counted ${qty(BigInt(a.observedQuantity))}${BigInt(a.confirmedQuantity) > 0n ? `, confirmed at ${qty(BigInt(a.confirmedQuantity))}` : ""}`,
      tone: "text-ink",
    },
    TicketReleased: { title: "Paid", body: `${money(BigInt(a.gross), symbol)} to ${label(a.payee)}`, tone: "text-paid" },
    ReleaseRefused: { title: "Payment refused", body: reason ? REASON_TEXT[reason] : undefined, tone: "text-waiting" },
    TicketFrozen: { title: "Frozen", body: reason ? REASON_TEXT[reason] : undefined, tone: "text-frozen" },
    TicketReopened: { title: "Reopened by the owner for a fresh count", tone: "text-ink" },
    TicketVoided: { title: "Voided by the owner", tone: "text-void" },
    AgentDecision: { title: "Agent decision recorded", tone: "text-ink" },
  };
  const c = content[e.name] ?? { title: e.name, tone: "text-ink" };
  const r = rationale?.rationale;
  return (
    <li className="border-l-2 border-rule pl-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className={`font-semibold ${c.tone}`}>{c.title}</span>
        <a className="link figure text-xs text-ink-soft" href={explorerTx(e.tx_hash)} target="_blank" rel="noreferrer">
          {e.block_time ? new Date(e.block_time).toLocaleString() : `block ${e.block_number}`}
        </a>
      </div>
      {c.body && <p className="mt-1 text-sm">{c.body}</p>}
      {rationale && r && (
        <div className="mt-2 rounded border border-rule bg-paper p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span>Agent reasoning ({rationale.model})</span>
            {verifyRationale(rationale) ? <span className="stamp text-paid">hash verified</span> : <span className="stamp text-frozen">hash mismatch</span>}
          </div>
          <p className="whitespace-pre-wrap">{String(r.rationale ?? "")}</p>
          {r.seen != null && (
            <p className="figure mt-2 text-xs text-ink-soft">
              Saw: balance {money(BigInt(String((r.seen as Record<string, string>).balance)), symbol)} · paid today{" "}
              {money(BigInt(String((r.seen as Record<string, string>).spent_today)), symbol)} of {money(BigInt(String((r.seen as Record<string, string>).daily_cap)), symbol)}
            </p>
          )}
          {r.payee_named_by_agent != null && (
            <p className="figure mt-1 text-xs text-ink-soft">
              Agent named {short(String(r.payee_named_by_agent))} and {money(BigInt(String(r.amount_named_by_agent)), symbol)}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
