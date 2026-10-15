import Link from "next/link";
import { notFound } from "next/navigation";
import { CutForm } from "@/components/CutForm";
import { readHouse } from "@/lib/chain";
import { houseName, houseRates } from "@/lib/house";
import { syncIfStale } from "@/lib/indexer";
import { tokenSymbol } from "@/lib/network";

export const dynamic = "force-dynamic";

export default async function CutPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  await syncIfStale();
  const house = await readHouse(id);
  if (!house) notFound();
  const [name, rates] = await Promise.all([houseName(id), houseRates(id)]);
  const now = Date.now() / 1000;
  const active = rates.filter((r) => r.active && r.validUntil > now);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/house/${id}`} className="link text-sm text-muted">
          {name}
        </Link>
        <h1 className="display text-5xl">Cut a ticket</h1>
        <p className="mt-2 text-muted">
          Record what arrived or what was done, and who gets paid. Once you cut it, the payee and the price are locked. A
          witness confirms the count before anything is paid.
        </p>
      </div>
      {active.length === 0 ? (
        <div className="card p-6 text-muted">The owner hasn&apos;t posted any prices yet. Tickets are always cut against a posted price.</div>
      ) : (
        <CutForm
          houseId={id}
          symbol={tokenSymbol(house.token)}
          maxTicket={house.maxTicket.toString()}
          rates={active.map((r) => ({ rateId: r.rateId, label: r.label, unitPrice: r.unitPrice.toString() }))}
        />
      )}
    </div>
  );
}
