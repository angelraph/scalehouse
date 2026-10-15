import Link from "next/link";

/** Shared layout for reading pages (docs, FAQ, legal): a quiet sidebar and a measured column. */
export function DocShell({
  eyebrow,
  title,
  intro,
  nav,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  nav?: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="pt-6 sm:pt-10">
      <span className="tag">{eyebrow}</span>
      <h1 className="display mt-5 text-5xl sm:text-6xl">{title}</h1>
      {intro && <p className="two-tone mt-4 max-w-2xl text-lg sm:text-xl">{intro}</p>}
      <div className={`mt-10 grid gap-10 ${nav ? "lg:grid-cols-[13rem_1fr]" : ""}`}>
        {nav && (
          <nav className="hidden lg:block">
            <ul className="sticky top-24 space-y-1 border-l border-rule text-sm">
              {nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-muted transition-colors hover:border-ink hover:text-ink">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <article className="prose-sh min-w-0 max-w-3xl">{children}</article>
      </div>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-rule pt-8 pb-10 first:border-0 first:pt-0">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function Steps({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <ol className="space-y-3">
      {items.map(([t, d], i) => (
        <li key={t} className="grid grid-cols-[2rem_1fr] gap-3">
          <span className="figure grid h-7 w-7 place-items-center rounded-full bg-forest text-xs text-lime">{i + 1}</span>
          <div>
            <div className="font-semibold text-ink">{t}</div>
            <div className="text-muted">{d}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Code({ children }: { children: string }) {
  return <pre className="figure overflow-x-auto rounded-xl bg-night p-4 text-[0.8rem] leading-6 text-[#e9e7d8]">{children}</pre>;
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs tracking-[0.08em] text-muted uppercase">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-rule align-top last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-3 ${j === 0 ? "figure whitespace-nowrap text-ink" : "text-muted"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NextLinks({ links }: { links: [string, string][] }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="btn btn-quiet">
          {label} <span aria-hidden>→</span>
        </Link>
      ))}
    </div>
  );
}
