"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Mark";
import { FaucetButton } from "./FaucetButton";
import { NetworkSwitch } from "./NetworkSwitch";
import { WalletButton } from "./Wallet";

const LINKS = [
  { href: "/board", label: "Board" },
  { href: "/traction", label: "Traction" },
  { href: "/docs", label: "Docs" },
  { href: "/faq", label: "FAQ" },
  { href: "/attack", label: "Trick the agent" },
  { href: "/builders", label: "For builders" },
  { href: "/house/new", label: "Open a house" },
];

/** Column-style sticky bar that turns to frosted glass once the page scrolls. */
export function Nav({ testnet }: { testnet: boolean }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => setOpen(false), [path]);

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,box-shadow] duration-300 ${
        scrolled || open ? "bg-paper/85 shadow-[0_1px_0_var(--rule)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={34} />
        </Link>

        <nav className="hidden items-center gap-5 text-sm md:flex lg:gap-7">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors duration-200 hover:text-ink ${path === l.href ? "text-ink" : "text-muted"} ${l.href === "/house/new" ? "hidden lg:inline" : l.href === "/builders" || l.href === "/attack" ? "hidden xl:inline" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <span className="hidden lg:inline-flex">
              <FaucetButton />
            </span>
            <NetworkSwitch compact />
          </div>
          <WalletButton />
          <button
            type="button"
            className="-mr-2 grid h-10 w-10 place-items-center rounded-full md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
          >
            <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
              <path d={open ? "M2 1l14 10M2 11L16 1" : "M0 1h18M0 6h18M0 11h18"} stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-rule px-4 pb-4 md:hidden">
          <div className="flex items-center justify-between border-b border-rule py-3">
            <span className="text-sm text-muted">Network</span>
            <NetworkSwitch compact />
          </div>
          {testnet && (
            <div className="flex items-center justify-between border-b border-rule py-3">
              <span className="text-sm text-muted">Free test USDC</span>
              <FaucetButton />
            </div>
          )}
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block border-b border-rule py-3 text-lg">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
