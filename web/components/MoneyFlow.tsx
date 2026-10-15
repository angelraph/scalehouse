"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface FlowData {
  ticketId: number;
  payer: string;
  payee: string;
  amount: string;
  quantity: string;
  price: string;
  status: "Paid" | "Frozen" | "Open" | "Confirmed" | "Voided";
  when: string;
  network: string;
}

// The route money takes: payer (bottom left) → ScaleTicket check (middle) → payee (top right).
// Stepped like Column's transfer lines: horizontal, diagonal, horizontal.
const ROUTE = "M130 352 V300 H250 L292 250 H338 L392 168 H452 V132";

/**
 * Column's signature hero motion, applied to a real ticket: a dot-matrix field fades in, the
 * route draws itself, a pulse carries the payment through the contract, and the account cards
 * rise in with the real amounts. Plays once, then the pulse keeps travelling slowly.
 */
export function MoneyFlow({ f }: { f: FlowData | null }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [300, 1100, 1900, 2900].map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => t.forEach(clearTimeout);
  }, []);

  const paid = f?.status === "Paid";
  const frozen = f?.status === "Frozen";

  return (
    <div className="relative aspect-[560/470] w-full">
      {/* dot-matrix field */}
      <svg viewBox="0 0 560 470" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="dotgrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1.4" fill="var(--forest)" />
          </pattern>
          <radialGradient id="fieldfade" cx="55%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="fieldmask">
            <rect width="560" height="470" fill="url(#fieldfade)" />
          </mask>
          <linearGradient id="routegrad" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--forest)" />
            <stop offset="100%" stopColor="var(--forest)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <rect
          width="560"
          height="420"
          fill="url(#dotgrid)"
          mask="url(#fieldmask)"
          style={{ opacity: phase >= 1 ? 0.5 : 0, transition: "opacity 1.5s var(--ease-reveal)" }}
        />
        {/* lit cells drifting across the field, like Column's slow background shimmer */}
        <g className="flow-shimmer" mask="url(#fieldmask)">
          {Array.from({ length: 26 }, (_, i) => (
            <circle key={i} cx={20 + ((i * 97) % 520)} cy={15 + ((i * 53) % 440)} r="1.8" fill="var(--lime)" style={{ animationDelay: `${(i % 9) * 0.7}s` }} />
          ))}
        </g>

        {/* the route, drawn as a dotted line */}
        <path d={ROUTE} fill="none" stroke="var(--rule-strong)" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
        <path
          d={ROUTE}
          fill="none"
          stroke={frozen ? "var(--red)" : "url(#routegrad)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ strokeDashoffset: phase >= 2 ? (frozen ? 0.5 : 0) : 1, transition: "stroke-dashoffset 1.6s var(--ease-inout)" }}
        />
        {/* the payment pulse */}
        {phase >= 3 && !frozen && (
          <circle r="5" fill="var(--lime)" stroke="var(--forest)" strokeWidth="2">
            <animateMotion dur="3.2s" repeatCount="indefinite" path={ROUTE} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.76 0 0.24 1" />
          </circle>
        )}
        {/* the contract checkpoint */}
        <g transform="translate(315 250)" style={{ opacity: phase >= 2 ? 1 : 0, transition: "opacity .8s ease-out .6s" }}>
          <circle r="16" fill="var(--forest)" />
          <path d="M-7 -2h14M0 -2l-4 9h8z" stroke="var(--lime)" strokeWidth="2" fill="var(--lime)" strokeLinejoin="round" />
        </g>
      </svg>

      {/* payer card */}
      <FlowCard
        show={phase >= 1}
        delay={0}
        className="absolute bottom-[1%] left-0 w-[46%]"
        label="Paying wallet"
        title={f ? f.payer : "Business wallet"}
        value={f ? `−${f.amount}` : "—"}
        tone="ink"
      />

      {/* contract chip */}
      <div
        className="absolute top-[40%] left-[56%] -translate-x-1/2 rounded-full bg-sheet px-3 py-1.5 text-xs whitespace-nowrap shadow-[var(--ring)] transition-all duration-700"
        style={{ opacity: phase >= 3 ? 1 : 0, transform: `translate(-50%, ${phase >= 3 ? 0 : 8}px)` }}
      >
        <span className="figure">
          <span className="hidden sm:inline">ScaleTicket checks </span>
          {f ? `${f.quantity} × ${f.price}` : "quantity × price"}
        </span>
      </div>

      {/* payee card */}
      <FlowCard
        show={phase >= 2}
        delay={300}
        className="absolute top-[3%] right-0 w-[48%]"
        label="Payee wallet"
        title={f ? f.payee : "Supplier wallet"}
        value={f ? (frozen ? "Held" : `+${f.amount}`) : "—"}
        tone={frozen ? "red" : "forest"}
      />

      {/* outcome */}
      {f && (
        <Link
          href={`/t/${f.ticketId}`}
          className="absolute top-[6%] left-0 flex items-center gap-2 rounded-lg bg-sheet px-3 py-2 text-xs shadow-[var(--lift)] transition-all duration-700 hover:-translate-y-0.5"
          style={{ opacity: phase >= 4 ? 1 : 0, filter: phase >= 4 ? "none" : "blur(6px)" }}
        >
          <span className={`h-2 w-2 rounded-full ${paid ? "bg-forest" : frozen ? "bg-red" : "bg-bronze"}`} />
          <span className="font-semibold">{paid ? "Completed" : frozen ? "Frozen in public" : "Waiting"}</span>
          <span className="figure text-muted">#{f.ticketId}</span>
        </Link>
      )}

      <style>{`
        .flow-shimmer circle { opacity: 0; animation: shimmer 6.3s linear infinite; }
        @keyframes shimmer { 0%,100% { opacity: 0 } 40% { opacity: .9 } 70% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .flow-shimmer circle { animation: none } }
      `}</style>
    </div>
  );
}

function FlowCard(props: { show: boolean; delay: number; className: string; label: string; title: string; value: string; tone: "ink" | "forest" | "red" }) {
  const color = props.tone === "forest" ? "text-forest" : props.tone === "red" ? "text-red" : "text-ink";
  return (
    <div
      className={`card p-4 ${props.className}`}
      style={{
        opacity: props.show ? 1 : 0,
        transform: props.show ? "none" : "translateY(14px)",
        filter: props.show ? "none" : "blur(6px)",
        transition: `opacity 1.2s var(--ease-reveal) ${props.delay}ms, transform 1.2s var(--ease-reveal) ${props.delay}ms, filter 1.2s var(--ease-reveal) ${props.delay}ms`,
      }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-paper-2">
          <span className="h-3 w-3 rounded-sm bg-forest/80" />
        </span>
        <div className="min-w-0">
          <div className="text-[0.7rem] text-muted">{props.label}</div>
          <div className="figure truncate text-xs">{props.title}</div>
        </div>
      </div>
      <div className={`figure mt-3 text-lg tracking-tight ${color}`}>{props.value}</div>
    </div>
  );
}
