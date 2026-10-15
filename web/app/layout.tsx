import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import { WalletButton } from "@/components/Wallet";
import { chain, isMainnet, scaleTicketAddress, explorerAddress } from "@/lib/network";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });
const body = IBM_Plex_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });
const figures = IBM_Plex_Mono({ variable: "--font-figures", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Scalehouse",
  description: "Weighed in public. Paid once. Evidence-locked payments on Arc, run by an agent that can't pay the wrong person.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${figures.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="border-b border-rule">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="font-serif text-2xl font-bold tracking-tight">Scalehouse</span>
                {!isMainnet && <span className="stamp text-waiting">testnet</span>}
              </Link>
              <nav className="flex items-center gap-4 text-sm sm:gap-6">
                <Link href="/board" className="link">
                  Board
                </Link>
                <Link href="/house/new" className="link hidden sm:inline">
                  Open a house
                </Link>
                <WalletButton />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="border-t border-rule">
            <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-ink-soft">
              <span>Settled in USDC on {chain.name}. Every number on this site is read from the chain.</span>
              {scaleTicketAddress && (
                <a className="link figure" href={explorerAddress(scaleTicketAddress)} target="_blank" rel="noreferrer">
                  ScaleTicket {scaleTicketAddress.slice(0, 10)}…
                </a>
              )}
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
