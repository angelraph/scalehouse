"use client";

import { usePathname } from "next/navigation";
import { isMainnet } from "@/lib/network";

const MAIN = process.env.NEXT_PUBLIC_MAINNET_URL || "https://scalehouse-app.vercel.app";
const TEST = process.env.NEXT_PUBLIC_TESTNET_URL || "https://scalehouse-testnet.vercel.app";

/** Wise-style segmented switch between the mainnet site and its testnet twin, keeping the page. */
export function NetworkSwitch({ compact = false }: { compact?: boolean }) {
  const path = usePathname() || "/";
  // Ticket and house numbers differ between networks, so those pages fall back to their list.
  const keep = /^\/(t|house)\/\d+/.test(path) ? "/board" : path;
  return (
    <div className={`segmented ${compact ? "text-xs" : ""}`} role="group" aria-label="Network">
      <a href={isMainnet ? "#" : `${MAIN}${keep}`} aria-current={isMainnet} className={compact ? "!px-2.5 !py-1 !text-xs" : "!px-3 !py-1 !text-xs"}>
        Mainnet
      </a>
      <a href={isMainnet ? `${TEST}${keep}` : "#"} aria-current={!isMainnet} className={compact ? "!px-2.5 !py-1 !text-xs" : "!px-3 !py-1 !text-xs"}>
        Testnet
      </a>
    </div>
  );
}
