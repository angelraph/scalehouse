import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkConfirm } from "@/components/LinkConfirm";
import { Stamp } from "@/components/Stamp";
import { readHouse } from "@/lib/chain";
import { confirmerByToken } from "@/lib/confirmers";
import { sql } from "@/lib/db";
import { grossOf, money, qty, timeAgo } from "@/lib/format";
import { houseName, houseTickets, labels } from "@/lib/house";
import { syncIfStale } from "@/lib/indexer";
import { CHAIN_ID, tokenSymbol } from "@/lib/network";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm payments · Scalehouse", robots: { index: false } };

/**
 * A link confirmer's page: everything waiting for them in one house, one Confirm button each.
 * No wallet app, no switching. Their Circle wallet signs when they tap.
 */
export default async function ConfirmerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await confirmerByToken(token);
  if (!me) notFound();
  await syncIfStale();
  const house = await readHouse(me.houseId);
  if (!house) notFound();
  const [name, tickets, names] = await Promise.all([houseName(me.houseId), houseTickets(me.houseId), labels(me.houseId)]);
  const symbol = tokenSymbol(house.token);
  const label = (a: string) => names.get(a.toLowerCase()) ?? `${a.slice(0, 6)}…${a.slice(-4)}`;

  const open = tickets.filter((t) => t.status === "Open").sort((a, b) => a.id - b.id);
  const recent = tickets.filter((t) => t.status !== "Open").sort((a, b) => b.id - a.id).slice(0, 5);
  const notes = new Map<string, string>();
  if (open.length) {
    const rows = (await sql()`select evidence_hash, reference, note from sh_evidence where chain_id = ${CHAIN_ID} and evidence_hash = any(${open.map((t) => t.evidenceHash.toLowerCase())})`.catch(() => [])) as {
      evidence_hash: string;
      reference: string;
      note: string;
    }[];
    for (const r of rows) notes.set(r.evidence_hash.toLowerCase(), r.note || r.reference);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="eyebrow">Hi {me.name} 👋</div>
        <h1 className="display mt-2 text-4xl">Confirm payments for {name}</h1>
        <p className="mt-3 text-ink-2">
          Check each one is real (the goods arrived, or the work was done), then tap <strong>Confirm</strong>. Nothing is paid until you
          do. It&apos;s free, and you don&apos;t need a wallet app. Keep this link private: it&apos;s your key.
        </p>
      </div>

      {open.length === 0 ? (
        <div className="card p-6 text-muted">Nothing is waiting for you right now. Come back to this same link when the owner tells you.</div>
      ) : (
        <div className="space-y-4">
          {open.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="figure text-2xl">{money(grossOf(t.quantity, t.unitPrice), symbol)}</div>
                <div className="text-sm text-muted">#{t.id} · {timeAgo(t.cutAt)}</div>
              </div>
              <div className="mt-2 text-ink-2">
                To <strong>{label(t.payee)}</strong>
                {notes.get(t.evidenceHash.toLowerCase()) ? <> · {notes.get(t.evidenceHash.toLowerCase())}</> : null}
              </div>
              <div className="text-sm text-muted">Quantity recorded: {qty(t.quantity)}</div>
              <LinkConfirm token={token} ticketId={t.id} quantity={t.quantity.toString()} />
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-wide text-muted">Recent</h2>
          <div className="card ruled text-sm">
            {recent.map((t) => (
              <Link key={t.id} href={`/t/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-2">
                <span>
                  #{t.id} · {label(t.payee)}
                </span>
                <span className="flex items-center gap-3">
                  <span className="figure">{money(grossOf(t.confirmedQuantity || t.quantity, t.unitPrice), symbol)}</span>
                  <Stamp status={t.status} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
