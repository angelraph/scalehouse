"use client";

import { useEffect, useRef, useState } from "react";

/** Runs `cb` once, the first time the element scrolls into view. */
export function useInView<T extends Element>(margin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView] as const;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const GLYPHS = "$#%&*/\\^~?!<>{}[]=+0123456789";

/**
 * Column's decoding figure ("$/*^f~kr" → "$3,923.70"): characters scramble, then lock in from
 * left to right once the element is on screen.
 */
export function Scramble({ text, className = "", duration = 900 }: { text: string; className?: string; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!inView || reduced()) {
      setOut(text);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const locked = Math.floor(p * text.length);
      setOut(
        text
          .split("")
          .map((ch, i) => (i < locked || ch === " " || ch === "." || ch === "," ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(""),
      );
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, text, duration]);
  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}

/** Code that types itself in, line by line, when it scrolls into view (Column 0:45). */
export function TypeLines({
  lines,
  className = "",
  speed = 14,
  lineDelay = 120,
}: {
  lines: { text: string; cls?: string }[];
  className?: string;
  speed?: number;
  lineDelay?: number;
}) {
  const [ref, inView] = useInView<HTMLPreElement>();
  const total = lines.reduce((s, l) => s + l.text.length, 0);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduced()) return setN(total);
    let shown = 0;
    let line = 0;
    let acc = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      shown++;
      setN(shown);
      if (shown >= total) return;
      // Small pause at each line end, like a terminal printing a response.
      acc++;
      const lineLen = lines[line]?.text.length ?? 0;
      if (acc >= lineLen) {
        acc = 0;
        line++;
        timer = setTimeout(step, lineDelay);
      } else timer = setTimeout(step, 1000 / speed / 4);
    };
    timer = setTimeout(step, 300);
    return () => clearTimeout(timer);
  }, [inView, total, lines, speed, lineDelay]);

  let remaining = n;
  return (
    <pre ref={ref} className={className}>
      {lines.map((l, i) => {
        const take = Math.max(0, Math.min(l.text.length, remaining));
        remaining -= l.text.length;
        const typing = take > 0 && take < l.text.length;
        return (
          <span key={i} className={l.cls}>
            {l.text.slice(0, take)}
            {typing && <span className="caret" />}
          </span>
        );
      })}
      {n >= total && <span className="caret text-lime" />}
    </pre>
  );
}

/**
 * Column's rising dot chart (0:28): columns of dots grow upward one after another. Purely
 * decorative, so it's hidden from assistive tech.
 */
export function DotChart({ cols = 34, className = "" }: { cols?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  // A gently rising, wobbling line: deterministic so server and client agree.
  const heights = Array.from({ length: cols }, (_, i) => {
    const base = 0.18 + (i / cols) * 0.62;
    return Math.min(0.95, base + 0.08 * Math.sin(i * 1.3) + 0.05 * Math.sin(i * 0.4));
  });
  return (
    <div ref={ref} aria-hidden className={`pointer-events-none flex items-end gap-[6px] ${className}`}>
      {heights.map((h, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-end">
          <div
            className="dot-col w-full origin-bottom"
            style={{
              height: `${h * 100}%`,
              transform: inView ? "scaleY(1)" : "scaleY(0)",
              transition: `transform 1.1s var(--ease-reveal) ${i * 45}ms`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** Pixel-dot art from a tiny bitmap ('#' = lit), like Column's green dot icons (1:20). */
export function PixelArt({ rows, size = 6, className = "", color = "var(--forest)" }: { rows: string[]; size?: number; className?: string; color?: string }) {
  const w = rows[0].length * size;
  const h = rows.length * size;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      {rows.flatMap((r, y) =>
        r.split("").map((c, x) => (
          <circle
            key={`${x}-${y}`}
            cx={x * size + size / 2}
            cy={y * size + size / 2}
            r={c === "#" ? size * 0.38 : size * 0.16}
            fill={c === "#" ? color : "var(--rule-strong)"}
            opacity={c === "#" ? 1 : 0.5}
          />
        )),
      )}
    </svg>
  );
}

/**
 * Column's stacked infrastructure layers (0:54): isometric slabs that start pressed together and
 * separate into a labelled stack when the section comes into view.
 */
export function LayerStack({ layers }: { layers: { name: string; note: string }[] }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="relative mx-auto h-[360px] w-full max-w-[460px] sm:h-[400px]" aria-label="The Scalehouse stack">
      {layers.map((l, i) => {
        const gap = inView ? 62 : 14;
        const top = 40 + i * gap;
        return (
          <div key={l.name} className="absolute inset-x-0" style={{ top, transition: "top 1.2s var(--ease-inout)", transitionDelay: `${i * 60}ms`, zIndex: layers.length - i }}>
            <div className="flex items-center gap-4">
              <div className="slab relative h-[70px] w-[58%] shrink-0" data-tone={i === 2 ? "gold" : undefined} />
              <div
                className="min-w-0 border-t border-white/15 pt-1.5 transition-opacity duration-700"
                style={{ opacity: inView ? 1 : 0, transitionDelay: `${600 + i * 120}ms` }}
              >
                <div className="text-sm font-semibold text-white">{l.name}</div>
                <div className="text-xs text-white/50">{l.note}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
