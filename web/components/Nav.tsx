"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Mark } from "./Mark";
import { WalletButton } from "./Wallet";

const LINKS = [
  { href: "/board", label: "Board" },
  { href: "/#how", label: "How it works" },
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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark size={28} />
          <span className="text-[1.05rem] font-semibold tracking-tight">Scalehouse</span>
          {testnet && <span className="tag hidden sm:inline-flex">testnet</span>}
        </Link>

        <nav className="hidden items-center gap-7 text-sm md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`transition-colors duration-200 hover:text-ink ${path === l.href ? "text-ink" : "text-muted"}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <WalletButton />
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full md:hidden"
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
