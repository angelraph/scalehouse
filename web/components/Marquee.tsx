"use client";

import { useState } from "react";

/** Wise-style endless strip with a pause control. Content is rendered twice for a seamless loop. */
export function Marquee({ children, label }: { children: React.ReactNode; label: string }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="marquee relative overflow-hidden" data-paused={paused} aria-label={label}>
      <div className="marquee-track gap-3 py-1">
        <div className="flex gap-3">{children}</div>
        <div className="flex gap-3" aria-hidden>
          {children}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-paper to-transparent" />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="absolute top-1/2 right-3 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-sheet text-ink shadow-[var(--ring)]"
        aria-label={paused ? "Play" : "Pause"}
      >
        {paused ? (
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
            <path d="M0 0l10 6-10 6z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
            <path d="M0 0h3v12H0zM7 0h3v12H7z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
