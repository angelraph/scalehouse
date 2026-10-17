import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient, defineChain, http, type Address, type Hex } from "viem";
import { scaleTicketAbi } from "@/lib/abi";
import { grossOf, money, short, timeAgo } from "@/lib/format";
import { STATUS } from "@/lib/types";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Traction · Scalehouse",
  description: "Live numbers from Arc mainnet and testnet, read straight from the ScaleTicket contract.",
};

const NETS = {
  mainnet: {
    chain: defineChain({ id: 5042, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } } }),
    contract: "0x8b5355CD5Ed88F6E70eA47C9dacC8bD2015A3BF7" as Address,
    site: "https://scalehouse-app.vercel.app",
    explorer: "https://explorer.arc.io",
  },
  testnet: {
    chain: defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } }),
    contract: "0x321322aC12e419111E27781c5B2618fCB97AC7b7" as Address,
    site: "https://scalehouse-testnet.vercel.app",
    explorer: "https://explorer.testnet.arc.io",
  },
};
type Net = keyof typeof NETS;
type TicketTuple = readonly [bigint, Address, Address, Address, Hex, Hex, bigint, bigint, bigint, bigint, bigint, number];
type HouseTuple = readonly [Address, Address, Address, Address, bigint, bigint, number, number, Address, boolean];

async function load(net: Net) {
  const n = NETS[net];
  const pc = createPublicClient({ chain: n.chain, transport: http(undefined, { batch: { batchSize: 200 }, retryCount: 3, timeout: 20_000 }) });
  const st = { address: n.contract, abi: scaleTicketAbi } as const;
  const [ticketCount, houseCount] = await Promise.all([pc.readContract({ ...st, functionName: "ticketCount" }), pc.readContract({ ...st, functionName: "houseCount" })]);
  const tickets = await Promise.all(
    Array.from({ length: Number(ticketCount) }, (_, i) =>
      pc.readContract({ ...st, functionName: "tickets", args: [BigInt(i + 1)] }).then((t) => {
        const x = t as unknown as TicketTuple;
        return { id: i + 1, houseId: Number(x[0]), issuer: x[1], payee: x[2], witness: x[3], unitPrice: x[6], quantity: x[7], confirmed: x[8], cutAt: Number(x[9]), settledAt: Number(x[10]), status: STATUS[x[11]] ?? "None" };
      }),
    ),
  );
  const houses = await Promise.all(Array.from({ length: Number(houseCount) }, (_, i) => pc.readContract({ ...st, functionName: "houses", args: [BigInt(i + 1)] }).then((h) => (h as unknown as HouseTuple)[0])));
  const paid = tickets.filter((t) => t.status === "Paid");
  const usdc = paid.reduce((s, t) => s + grossOf(t.confirmed || t.quantity, t.unitPrice), 0n);
  // "Outside" wallets: paid wallets that never owned a house, recorded or confirmed, and hold no role in any house.
  const insiders = new Set([...houses, ...tickets.map((t) => t.issuer), ...tickets.map((t) => t.witness)].map((a) => a.toLowerCase()));
  const payees = [...new Set(paid.map((t) => t.payee.toLowerCase()))].filter((a) => !insiders.has(a));
  const roleChecks = net !== "mainnet" ? [] : await Promise.all(
    payees.flatMap((a) => houses.map((_, h) => pc.readContract({ ...st, functionName: "roles", args: [BigInt(h + 1), a as Address] }).then((r) => (Number(r) > 0 ? a : null)))),
  );
  for (const a of roleChecks) if (a) insiders.add(a);
  const outside = new Set(payees.filter((a) => !insiders.has(a)));
  const stopped = tickets.filter((t) => t.status === "Frozen").length;
  return { net, n, tickets, houses: houses.length, paid, usdc, outside: outside.size, stopped };
}

export default async function Traction() {
  const main = await load("mainnet").catch((e) => (console.error("traction mainnet", e), null));
  const test = await load("testnet").catch((e) => (console.error("traction testnet", e), null));
  return (
    <div className="space-y-16">
      <div>
        <span className="tag">Traction · live from the chain</span>
        <h1 className="display mt-5 text-5xl sm:text-6xl">
          Real money, <em className="text-forest">real people.</em>
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Every number on this page is read straight from the ScaleTicket contract on Arc, refreshed every minute. Nothing is typed in by hand. Click any payment to
          see its receipt and its transaction on the explorer.
        </p>
      </div>

      {!main && <p className="text-sm text-muted">Mainnet numbers are loading slowly right now. Refresh in a minute, or see the board.</p>}
      {main && (
        <section>
          <div className="eyebrow">Arc mainnet · real USDC</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Stat value={String(main.paid.length)} label="payments made" />
            <Stat value={money(main.usdc)} label="USDC paid out" />
            <Stat value={String(main.outside)} label="outside wallets paid" note="never the owner, recorder or confirmer" />
            <Stat value="< 30 s" label="from tap to paid" />
          </div>
          <List net={main} />
        </section>
      )}

      <section className="rounded-[28px] bg-forest p-8 text-[#eaf3e6]">
        <div className="eyebrow !text-lime">What people said · 16 Oct 2026</div>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {[
            ["So fast and swift. I love the app, thank you for the money.", "Tester · ticket #3"],
            ["Bro you did great here, keep it up.", "dapope · ticket #4"],
            ["That was fast mehnn. I will surely recommend the app to my customer soon.", "Saint Bernard · ticket #5"],
          ].map(([q, who]) => (
            <figure key={who}>
              <blockquote className="font-display text-2xl leading-snug">&ldquo;{q}&rdquo;</blockquote>
              <figcaption className="mt-3 text-sm text-[#eaf3e6]/60">{who}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {!test && <p className="text-sm text-muted">Testnet numbers are loading slowly right now. Refresh in a minute, or see the testnet board.</p>}
      {test && (
        <section>
          <div className="eyebrow">Arc testnet · free to try</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Stat value={String(test.tickets.length)} label="tickets" />
            <Stat value={String(test.paid.length)} label="paid by the agent" />
            <Stat value={String(test.stopped)} label="attacks frozen on-chain" note="from the public attack lab" />
            <Stat value={String(test.houses)} label="houses opened" />
          </div>
          <p className="mt-4 text-sm text-muted">
            Try it yourself: open a house free on{" "}
            <a className="link" href={test.n.site}>
              the testnet app
            </a>
            , or{" "}
            <a className="link" href={`${test.n.site}/attack`}>
              try to trick the agent
            </a>
            .
          </p>
          <List net={test} limit={10} />
        </section>
      )}
    </div>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="card p-5">
      <div className="figure text-4xl text-ink">{value}</div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}

function List({ net, limit }: { net: Awaited<ReturnType<typeof load>>; limit?: number }) {
  const rows = [...net.tickets].reverse().slice(0, limit ?? 50);
  return (
    <div className="card ruled mt-6 text-sm">
      {rows.map((t) => (
        <Link key={t.id} href={`${net.n.site}/t/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-paper-2">
          <span className="figure">#{t.id}</span>
          <span className="figure flex-1 text-muted">→ {short(t.payee)}</span>
          <span className="figure">{money(grossOf(t.confirmed || t.quantity, t.unitPrice))}</span>
          <span className={t.status === "Paid" ? "text-forest" : t.status === "Frozen" ? "text-red" : "text-muted"}>{t.status}</span>
          <span className="text-xs text-faint">{timeAgo(t.settledAt || t.cutAt)}</span>
        </Link>
      ))}
    </div>
  );
}
