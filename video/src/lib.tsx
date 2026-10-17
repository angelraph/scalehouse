import React, { createContext, useContext } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FPS, mono, sans } from "./theme";
import vo from "./vo.json";

export type Word = { word: string; start: number; end: number };
export type Clip = { id: string; text: string; file: string; duration: number; words: Word[] };
export const CLIPS = vo as Clip[];
export const clip = (id: string) => CLIPS.find((c) => c.id === id)!;

/** Per-scene timing: where the voiceover starts inside the scene, and word lookups in frames. */
type SceneCtx = { clip: Clip; lead: number; dur: number };
const Ctx = createContext<SceneCtx | null>(null);
export const SceneProvider = Ctx.Provider;
export function useScene() {
  const s = useContext(Ctx)!;
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  /** Frame (scene-relative) when the n-th occurrence of `phrase`'s first word is spoken. */
  const at = (phrase: string, n = 1, edge: "start" | "end" = "start") => {
    const parts = phrase.split(/\s+/).map(norm);
    let seen = 0;
    for (let i = 0; i < s.clip.words.length; i++) {
      if (parts.every((p, k) => norm(s.clip.words[i + k]?.word ?? "") === p)) {
        seen++;
        if (seen === n) {
          const w = s.clip.words[i + (edge === "end" ? parts.length - 1 : 0)];
          return s.lead + Math.round((edge === "end" ? w.end : w.start) * FPS);
        }
      }
    }
    throw new Error(`"${phrase}" (#${n}) not in ${s.clip.id}`);
  };
  const tryAt = (phrase: string, fallback: number, n = 1) => {
    try {
      return at(phrase, n);
    } catch {
      return fallback;
    }
  };
  return { ...s, at, tryAt, voEnd: s.lead + Math.round(s.clip.duration * FPS) };
}

/** 0→1 spring starting at frame `from`. */
export function useSpring(from: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 120, mass: 0.9, ...cfg } });
}

/** Eased 0→1 between frames a and b. */
export function useRamp(a: number, b: number, ease = Easing.bezier(0.22, 1, 0.36, 1)) {
  const frame = useCurrentFrame();
  return interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

/** Text revealed character by character from frame `from` at `cps` characters per second. */
export function Typed({ text, from, cps = 38, caret = true, style }: { text: string; from: number; cps?: number; caret?: boolean; style?: React.CSSProperties }) {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor(((frame - from) / FPS) * cps)));
  const typing = frame >= from && n < text.length;
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {caret && frame >= from && (typing || blink) && (
        <span style={{ display: "inline-block", width: "0.55em", height: "1.05em", background: C.gold, verticalAlign: "-0.15em", marginLeft: 2 }} />
      )}
    </span>
  );
}

/** Rises and fades in with a spring. */
export function Rise({ from, children, y = 40, style, blur = true }: { from: number; children: React.ReactNode; y?: number; style?: React.CSSProperties; blur?: boolean }) {
  const p = useSpring(from);
  return (
    <div style={{ opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * y}px)`, filter: blur ? `blur(${(1 - Math.min(1, p)) * 8}px)` : undefined, ...style }}>
      {children}
    </div>
  );
}

/** Words revealed one by one as they are spoken (scene-relative frames from the clip). */
export function SpokenText({ from, to, children, style }: { from: number; to: number; children: string; style?: React.CSSProperties }) {
  const frame = useCurrentFrame();
  const words = children.split(" ");
  return (
    <span style={style}>
      {words.map((w, i) => {
        const t = from + ((to - from) * i) / words.length;
        const p = interpolate(frame, [t, t + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 18}px)`, filter: `blur(${(1 - p) * 6}px)`, marginRight: "0.26em" }}>
            {w}
          </span>
        );
      })}
    </span>
  );
}

/** Small mono labels in the four corners, like a broadcast frame. */
export function Corners({ dark, right = "ARC MAINNET · LIVE" }: { dark: boolean; right?: string }) {
  const col = dark ? "rgba(255,254,242,0.42)" : "rgba(27,27,24,0.42)";
  const s: React.CSSProperties = { position: "absolute", fontFamily: mono, fontSize: 15, letterSpacing: 2, color: col, textTransform: "uppercase" };
  return (
    <>
      <div style={{ ...s, top: 34, left: 48 }}>Scalehouse · Tameion agents hackathon</div>
      <div style={{ ...s, top: 34, right: 48, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
        {right}
      </div>
      <div style={{ ...s, bottom: 30, left: 48 }}>USDC · Circle Wallets · Arc</div>
      <div style={{ ...s, bottom: 30, right: 48 }}>scalehouse-app.vercel.app</div>
    </>
  );
}

/** Karaoke captions: the current phrase, spoken words bright, upcoming words dim. */
export function Captions({ dark, pill = false, bottom = 92 }: { dark: boolean; pill?: boolean; bottom?: number }) {
  const frame = useCurrentFrame();
  const { clip: c, lead } = useScene();
  const t = (frame - lead) / FPS;
  if (t < -0.2 || t > c.duration + 0.6) return null;

  // Phrases: break at sentence/clause punctuation, max ~9 words.
  const phrases: Word[][] = [];
  let cur: Word[] = [];
  c.words.forEach((w, i) => {
    cur.push(w);
    const endPunct = /[.?!:]$/.test(w.word) || (/[,]$/.test(w.word) && cur.length >= 5);
    if (endPunct || cur.length >= 9 || i === c.words.length - 1) {
      phrases.push(cur);
      cur = [];
    }
  });
  let idx = phrases.findIndex((p) => t < p[p.length - 1].end + 0.15);
  if (idx < 0) idx = phrases.length - 1;
  const phrase = phrases[idx];
  const enter = interpolate(t, [phrase[0].start - 0.12, phrase[0].start + 0.05], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const on = dark ? "#fffef2" : C.ink;
  const off = dark ? "rgba(255,254,242,0.32)" : "rgba(27,27,24,0.3)";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: sans,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: -0.3,
          padding: pill ? "14px 28px" : 0,
          borderRadius: 999,
          background: pill ? "rgba(255,255,255,0.92)" : undefined,
          boxShadow: pill ? "0 10px 30px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)" : undefined,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 10}px)`,
          maxWidth: 1400,
          textAlign: "center",
        }}
      >
        {phrase.map((w, i) => (
          <span key={i} style={{ color: t >= w.start - 0.03 ? on : off, transition: "none" }}>
            {w.word}
            {i < phrase.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A tilted rubber stamp that slams in. */
export function Stamp({ from, text, color, rotate = -8, size = 34, style }: { from: number; text: string; color: string; rotate?: number; size?: number; style?: React.CSSProperties }) {
  const p = useSpring(from, { damping: 11, stiffness: 220, mass: 0.6 });
  if (p <= 0.001) return null;
  return (
    <div
      style={{
        fontFamily: mono,
        fontWeight: 500,
        fontSize: size,
        letterSpacing: 3,
        color,
        border: `4px solid ${color}`,
        borderRadius: 10,
        padding: "8px 18px",
        transform: `rotate(${rotate}deg) scale(${interpolate(p, [0, 1], [2.4, 1])})`,
        opacity: Math.min(1, p * 2),
        background: "rgba(255,255,255,0.04)",
        whiteSpace: "nowrap",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/** A scrolling ticker band. */
export function Ticker({ items, bg = C.gold, color = C.ink, top, speed = 3, rotate = 0 }: { items: string[]; bg?: string; color?: string; top: number; speed?: number; rotate?: number }) {
  const frame = useCurrentFrame();
  const text = items.join("   ·   ") + "   ·   ";
  const reps = 8;
  return (
    <div style={{ position: "absolute", left: -100, right: -100, top, height: 54, background: bg, overflow: "hidden", transform: `rotate(${rotate}deg)`, display: "flex", alignItems: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}>
      <div style={{ whiteSpace: "nowrap", fontFamily: mono, fontSize: 19, letterSpacing: 2.5, color, transform: `translateX(${-((frame * speed) % 1600)}px)`, textTransform: "uppercase" }}>
        {Array.from({ length: reps }).map(() => text).join("")}
      </div>
    </div>
  );
}

/** Animated cursor that glides between points and presses on click frames. */
export function Cursor({ path }: { path: { f: number; x: number; y: number; click?: boolean }[] }) {
  const frame = useCurrentFrame();
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (frame >= a.f) {
      const p = interpolate(frame, [a.f, b.f], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) });
      x = a.x + (b.x - a.x) * p;
      y = a.y + (b.y - a.y) * p;
    }
  }
  const click = path.find((p) => p.click && frame >= p.f && frame < p.f + 10);
  const press = click ? interpolate(frame - click.f, [0, 4, 10], [1, 0.82, 1]) : 1;
  const ring = click ? interpolate(frame - click.f, [0, 10], [0, 1]) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 50 }}>
      {click && <div style={{ position: "absolute", left: -26, top: -26, width: 52, height: 52, borderRadius: 52, border: `3px solid ${C.gold}`, opacity: 1 - ring, transform: `scale(${0.4 + ring})` }} />}
      <svg width="34" height="40" viewBox="0 0 24 28" style={{ transform: `scale(${press})`, transformOrigin: "0 0", filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))" }}>
        <path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.5 L11 15.8 L18.5 15.8 Z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Full-bleed background with an optional dotted grid. */
export function Bg({ color, dots, dotColor }: { color: string; dots?: boolean; dotColor?: string }) {
  return (
    <AbsoluteFill style={{ background: color }}>
      {dots && (
        <AbsoluteFill style={{ backgroundImage: `radial-gradient(${dotColor ?? "rgba(0,0,0,0.07)"} 1.6px, transparent 1.6px)`, backgroundSize: "28px 28px" }} />
      )}
    </AbsoluteFill>
  );
}

/** Browser window frame for app mockups. */
export function Browser({ url, children, width, height, style }: { url: string; children: React.ReactNode; width: number; height: number; style?: React.CSSProperties }) {
  return (
    <div style={{ width, height, borderRadius: 18, overflow: "hidden", background: C.paper, boxShadow: "0 40px 90px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)", ...style }}>
      <div style={{ height: 46, background: "#1b1b18", display: "flex", alignItems: "center", gap: 9, padding: "0 18px" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 12, background: c }} />
        ))}
        <div style={{ marginLeft: 16, flex: 1, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontFamily: mono, fontSize: 14, display: "flex", alignItems: "center", padding: "0 14px" }}>
          🔒 {url}
        </div>
      </div>
      <div style={{ position: "relative", height: height - 46 }}>{children}</div>
    </div>
  );
}

/** Count-up number. */
export function Count({ from, to, start, dur = 30, decimals = 0, suffix = "" }: { from: number; to: number; start: number; dur?: number; decimals?: number; suffix?: string }) {
  const p = useRamp(start, start + dur, Easing.out(Easing.cubic));
  return (
    <>
      {(from + (to - from) * p).toFixed(decimals)}
      {suffix}
    </>
  );
}
