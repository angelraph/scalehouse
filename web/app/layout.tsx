import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Logo } from "@/components/Mark";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import { chain, explorerAddress, isMainnet, scaleTicketAddress } from "@/lib/network";
import "./globals.css";

const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const body = Inter_Tight({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const brand = Fraunces({ variable: "--font-brand", subsets: ["latin"], weight: ["700"] });
const figures = JetBrains_Mono({ variable: "--font-figures", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Scalehouse",
  description: "Weighed in public. Paid once. Evidence-locked payments on Arc, run by an agent that can't pay the wrong person.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${figures.variable} ${brand.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <div className="bg-forest px-4 py-2 text-center text-xs text-lime">
            <span className="inline-flex items-center gap-2">
              <span className="live-dot" />
              {isMainnet ? "Live on Arc mainnet" : "You are on Arc testnet: test money only"}. Every number here is read from the chain.
            </span>
          </div>
          <Nav testnet={!isMainnet} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="bg-night text-[#e9e7d8]">
      <div className="mx-auto grid max-w-6xl gap-px border-b border-white/10 px-4 sm:grid-cols-3">
        {[
          ["Never holds your money", "Funds go straight from payer to payee"],
          ["Pays once, or refuses in public", "Every refusal is on the board"],
          ["Settled in under a second", `USDC on ${chain.name}`],
        ].map(([t, s]) => (
          <div key={t} className="py-6 text-center sm:text-left">
            <div className="text-sm font-medium">{t}</div>
            <div className="text-xs text-white/50">{s}</div>
          </div>
        ))}
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size={34} light />
          <p className="mt-4 max-w-xs text-sm text-white/55">
            Evidence-locked payments for the people who weigh, deliver and build. Weighed in public. Paid once.
          </p>
        </div>
        <FooterCol title="Product" links={[["The board", "/board"], ["Open a house", "/house/new"], ["How it works", "/#how"], ["Docs", "/docs"], ["FAQ", "/faq"], ["Pay your testers", "/builders"], ["Get started guide", "/guide"], ["Try to trick the agent", "/attack"]]} />
        <FooterCol
          title="Contract"
          links={[
            ["ScaleTicket on the explorer", scaleTicketAddress ? explorerAddress(scaleTicketAddress) : "#"],
            ["Specification", "https://github.com/angelraph/scalehouse/blob/main/docs/SPEC.md"],
          ]}
        />
        <FooterCol title="More" links={[["GitHub", "https://github.com/angelraph/scalehouse"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Arc", "https://arc.io"]]} />
      </div>
      <div className="mx-auto max-w-6xl overflow-hidden px-4">
        <div className="display -mb-[0.18em] text-[19vw] leading-none text-white/[0.06] select-none md:text-[11rem]">Scalehouse</div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-3 border-b border-white/15 pb-2 text-sm font-semibold">{title}</div>
      <ul className="space-y-2 text-sm text-white/60">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("/") ? (
              <Link href={href} className="transition-colors hover:text-white">
                {label}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
