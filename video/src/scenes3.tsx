import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Footage, type Anchor, type Cam, type Callout } from "./footage";
import { Bg, Captions, Corners, Stamp, useScene, useSpring } from "./lib";
import { C, FPS, mono, sans, serif } from "./theme";
import marksJson from "./marks.json";

type Marks = Record<string, { marks: { label: string; t: number }[] }>;
const MARKS = marksJson as unknown as Marks;
/** Seconds into a recorded clip at a recorded mark (+ offset). */
const m = (clip: string, label: string, off = 0) => {
  const x = MARKS[clip]?.marks.find((k) => k.label === label);
  if (!x) throw new Error(`mark ${clip}.${label} missing`);
  return x.t + off;
};
const end = (clip: string) => m(clip, "end");

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill>
      <Bg color={C.paper2} dots />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 70% 40%, rgba(15,74,40,0.10), transparent 60%)" }} />
      <Corners dark={false} />
      {children}
      <Captions dark={false} pill bottom={34} />
    </AbsoluteFill>
  );
}

/** Seconds → scene frames helper for anchors. */
const sf = (s: number) => Math.round(s * FPS);

/* ─────────── HOME (mainnet) ─────────── */
export function Home() {
  const { at, dur } = useScene();
  const total = dur;
  const anchors: Anchor[] = [
    [0, 1.2],
    [at("real payments"), m("home", "hero", -0.5)],
    [at("walks"), m("home", "scroll")],
    [total, end("home") - 1],
  ];
  const cams: Cam[] = [
    { f: 0, s: 1.25, x: 820, y: 360 },
    { f: at("real payments"), s: 1.25, x: 820, y: 360 },
    { f: at("walks") - 10, s: 1.0, x: 960, y: 540 },
    { f: total, s: 1.0, x: 960, y: 540 },
  ];
  const callouts: Callout[] = [
    { from: at("live") - 4, to: at("walks") - 6, x: 1300, y: 300, text: "Live payments, read from Arc", dir: "up" },
  ];
  return (
    <Stage>
      <Footage
        src="clips/home.mp4"
        url="scalehouse-app.vercel.app"
        network="mainnet"
        anchors={anchors}
        total={total}
        cams={cams}
        callouts={callouts}
        section="TOUR · 01"
        title={
          <>
            The home <i style={{ color: C.forest }}>page</i>
          </>
        }
        steps={[
          { at: at("live"), text: "Live on Arc mainnet" },
          { at: at("real payments"), text: "Real payments, straight from the chain" },
          { at: at("walks"), text: "What every payment goes through" },
        ]}
      />
    </Stage>
  );
}

/* ─────────── OPEN A HOUSE (testnet) ─────────── */
export function Open() {
  const { at, dur } = useScene();
  const total = dur;
  const anchors: Anchor[] = [
    [0, m("newhouse", "connect", -1.0)],
    [at("Connect"), m("newhouse", "connect", 0.6)],
    [at("give"), m("newhouse", "name", 0.3)],
    [at("set how much"), m("newhouse", "limits", 0.2)],
    [at("Approve"), m("newhouse", "open", 0.6)],
    [at("your house is open") - 4, m("newhouse", "opened", 0.2)],
    [total, end("newhouse")],
  ];
  const cams: Cam[] = [
    { f: 0, s: 1.0, x: 960, y: 540 },
    { f: at("Connect") - 8, s: 1.3, x: 960, y: 360 },
    { f: at("give") - 6, s: 1.5, x: 760, y: 520 },
    { f: at("Approve") - 8, s: 1.35, x: 760, y: 640 },
    { f: at("your house is open") - 10, s: 1.0, x: 960, y: 540 },
    { f: total, s: 1.08, x: 960, y: 420 },
  ];
  return (
    <Stage>
      <Footage
        src="clips/newhouse.mp4"
        url="scalehouse-testnet.vercel.app/house/new"
        network="testnet"
        anchors={anchors}
        total={total}
        cams={cams}
        section="TOUR · 02 · ONE MINUTE"
        title={
          <>
            Open a <i style={{ color: C.forest }}>house</i>
          </>
        }
        steps={[
          { at: at("Connect"), text: "Connect your wallet" },
          { at: at("give"), text: "Name your business" },
          { at: at("set how much"), text: "Set how much goes out on its own" },
          { at: at("Approve"), text: "Approve once" },
          { at: at("your house is open"), text: "Your house is open" },
        ]}
      />
    </Stage>
  );
}

/* ─────────── PAY SOMEONE (testnet) ─────────── */
export function Pay2() {
  const { at, dur } = useScene();
  const total = dur;
  const anchors: Anchor[] = [
    [0, m("pay", "box", -0.3)],
    [at("paste"), m("pay", "wallet", 0.6)],
    [at("the amount"), m("pay", "amount", 0.6)],
    [at("what it's"), m("pay", "what", 0.6)],
    [at("Tap"), m("pay", "pay", 0.75)],
    [at("screens"), m("pay", "checking", 0)],
    [at("About") , m("pay", "paid", -3)],
    [at("Paid.") , m("pay", "paid", 0.2)],
    [total, m("pay", "paid", 1.6)],
  ];
  const cams: Cam[] = [
    { f: 0, s: 1.0, x: 960, y: 540 },
    { f: at("paste") - 10, s: 1.4, x: 960, y: 700 },
    { f: at("Tap") + 4, s: 1.4, x: 960, y: 720 },
    { f: at("screens"), s: 1.4, x: 960, y: 640 },
    { f: total, s: 1.4, x: 960, y: 640 },
  ];
  const paid = useSpring(at("Paid."), { damping: 12 });
  return (
    <Stage>
      <Footage
        src="clips/pay.mp4"
        url="scalehouse-testnet.vercel.app/house · Mama Ada Provisions"
        network="testnet"
        anchors={anchors}
        total={total}
        cams={cams}
        section="TOUR · 03 · ~30 SECONDS"
        title={
          <>
            Pay <i style={{ color: C.forest }}>someone</i>
          </>
        }
        steps={[
          { at: at("paste"), text: "Paste their wallet" },
          { at: at("the amount"), text: "Type the amount" },
          { at: at("what it's"), text: "Say what it's for" },
          { at: at("Tap"), text: "Tap Pay, approve once" },
          { at: at("screens"), text: "Agent screens wallet + budget" },
          { at: at("Paid."), text: "Paid ✓" },
        ]}
      />
      {paid > 0.01 && (
        <div style={{ position: "absolute", right: 110, top: 300, transform: `scale(${paid})`, opacity: paid }}>
          <Stamp from={at("Paid.")} text="Paid ✓" color={C.forest} rotate={-8} size={44} style={{ background: "rgba(255,254,242,0.92)" }} />
        </div>
      )}
    </Stage>
  );
}

/* ─────────── RECEIPT ─────────── */
export function Receipt2() {
  const { at, dur } = useScene();
  const total = dur;
  const anchors: Anchor[] = [
    [0, m("pay", "receipt", -0.4)],
    [at("Tap"), m("pay", "receipt", 0.8)],
    [at("Who"), m("pay", "share", -1.5)],
    [at("reasoning"), m("pay", "scroll", 1.6)],
    [at("replayed"), m("pay", "scroll", 3.2)],
    [total, m("pay", "replay", -0.2)],
  ];
  const cams: Cam[] = [
    { f: 0, s: 1.4, x: 960, y: 640 },
    { f: at("Tap") + 14, s: 1.0, x: 960, y: 540 },
    { f: at("Who") - 4, s: 1.45, x: 900, y: 360 },
    { f: at("reasoning") - 6, s: 1.3, x: 960, y: 520 },
    { f: total, s: 1.25, x: 960, y: 520 },
  ];
  return (
    <Stage>
      <Footage
        src="clips/pay.mp4"
        url="scalehouse-testnet.vercel.app/t · receipt"
        network="testnet"
        anchors={anchors}
        total={total}
        cams={cams}
        section="TOUR · 04"
        title={
          <>
            The <i style={{ color: C.forest }}>receipt</i>
          </>
        }
        steps={[
          { at: at("Tap"), text: "Tap Open receipt" },
          { at: at("Who"), text: "Who, how much, what for" },
          { at: at("reasoning"), text: "Agent's reasoning, hashed on-chain" },
          { at: at("replayed"), text: "Every step, replayed from the contract" },
        ]}
      />
    </Stage>
  );
}

/* ─────────── CONFIRMERS ─────────── */
export function Confirm() {
  const { at, dur } = useScene();
  const total = dur;
  const anchors: Anchor[] = [
    [0, m("confirm", "card", -0.5)],
    [at("Add"), m("confirm", "add", 0.4)],
    [at("private link"), m("confirm", "added", 0.4)],
    [at("over your limit"), m("confirm", "waiting", -0.5)],
    [at("opens the link"), m("confirm", "link", 0.8)],
    [at("taps confirm"), m("confirm", "tap", 0.75)],
    [total, end("confirm")],
  ];
  const cams: Cam[] = [
    { f: 0, s: 1.0, x: 960, y: 540 },
    { f: at("Add") - 8, s: 1.55, x: 1240, y: 520 },
    { f: at("over your limit") - 10, s: 1.45, x: 760, y: 470 },
    { f: at("opens the link") - 6, s: 1.0, x: 960, y: 540 },
    { f: at("taps confirm") - 10, s: 1.4, x: 960, y: 520 },
    { f: total, s: 1.4, x: 960, y: 520 },
  ];
  return (
    <Stage>
      <Footage
        src="clips/confirm.mp4"
        url={"scalehouse-testnet.vercel.app/house · confirmers"}
        network="testnet"
        anchors={anchors}
        total={total}
        cams={cams}
        section="TOUR · 05 · OPTIONAL"
        title={
          <>
            Add a <i style={{ color: C.forest }}>confirmer</i>
          </>
        }
        steps={[
          { at: at("Add"), text: "Add a confirmer by name" },
          { at: at("private link"), text: "They get a private link, no wallet" },
          { at: at("over your limit"), text: "Big payment waits" },
          { at: at("opens the link"), text: "They open the link" },
          { at: at("taps confirm"), text: "Tap Confirm → agent pays" },
        ]}
      />
    </Stage>
  );
}

/* ─────────── ATTACK LAB (testnet) ─────────── */
export function Attacks2() {
  const { at, dur } = useScene();
  const total = dur;
  const anchors: Anchor[] = [
    [0, m("attack", "payme", -1.2)],
    [at("Paste"), m("attack", "payme", 0.6)],
    [at("pays you"), m("attack", "inject", -1.0)],
    [at("Hide"), m("attack", "inject", 0.7)],
    [at("ignores"), m("attack", "injected", 0.3)],
    [at("Hijack"), m("attack", "hijack", 0.7)],
    [at("freezes"), m("attack", "hijacked", 0.3)],
    [total, end("attack") - 0.5],
  ];
  const cams: Cam[] = [
    { f: 0, s: 1.0, x: 960, y: 540 },
    { f: at("Paste") - 8, s: 1.4, x: 820, y: 300 },
    { f: at("pays you") - 4, s: 1.5, x: 800, y: 380 },
    { f: at("Hide") - 6, s: 1.2, x: 960, y: 420 },
    { f: at("ignores") - 4, s: 1.5, x: 790, y: 340 },
    { f: at("Hijack") - 6, s: 1.2, x: 960, y: 420 },
    { f: at("freezes") - 4, s: 1.5, x: 800, y: 390 },
    { f: total, s: 1.35, x: 800, y: 400 },
  ];
  const frame = useCurrentFrame();
  const six = useSpring(at("Six"), { damping: 12 });
  return (
    <Stage>
      <Footage
        src="clips/attack.mp4"
        url="scalehouse-testnet.vercel.app/attack"
        network="testnet"
        anchors={anchors}
        total={total}
        cams={cams}
        section="TOUR · 06 · ANYONE CAN TRY"
        title={
          <>
            Try to <i style={{ color: C.red }}>trick it</i>
          </>
        }
        steps={[
          { at: at("Paste"), text: "Paste your wallet → get paid" },
          { at: at("Hide"), text: "Poisoned invoice → ignored" },
          { at: at("Hijack"), text: "Hijacked agent → frozen" },
          { at: at("Six"), text: "6 of 6 attacks stopped" },
        ]}
      />
      {six > 0.01 && (
        <div style={{ position: "absolute", left: 70, top: 690, transform: `scale(${0.7 + 0.3 * six})`, transformOrigin: "left center", opacity: six }}>
          <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 120, color: C.forest, letterSpacing: -5, lineHeight: 1 }}>6/6</div>
          <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 28, color: C.ink }}>attacks stopped, live</div>
        </div>
      )}
      {frame < 0 && <span />}
    </Stage>
  );
}

/* ─────────── WHY SCALEHOUSE (motion) ─────────── */
export function Different2() {
  const frame = useCurrentFrame();
  const { at } = useScene();
  const items = [
    { cue: at("as fast"), t: "As fast as a wallet send.", s: "ONE WALLET · ~30 S FROM TAP TO PAID · PUBLIC RECEIPT" },
    { cue: at("can't pay"), t: "It can’t pay the wrong person, or twice.", s: "PAYEE LOCKED · CONTRACT DOES THE SUM · PAYS ONCE · 6/6 ATTACKS STOPPED" },
    { cue: at("built on"), t: "Built on Circle and Arc, end to end.", s: "" },
  ];
  const pills = ["USDC", "Circle Wallets · agent + checkers", "USDC blocklist screening", "Arc mainnet"];
  return (
    <AbsoluteFill>
      <Bg color={C.paper} dots />
      <Corners dark={false} />
      <div style={{ position: "absolute", left: 140, top: 150, fontFamily: sans, fontWeight: 700, fontSize: 104, color: C.ink, letterSpacing: -3 }}>
        <span style={{ opacity: interpolate(frame, [at("Why") - 4, at("Why") + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>Why </span>
        <span style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 400, color: C.forest, fontSize: 124, opacity: interpolate(frame, [at("Scalehouse?") - 2, at("Scalehouse?") + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>Scalehouse?</span>
      </div>
      <div style={{ position: "absolute", left: 140, right: 140, top: 350 }}>
        {items.map((it, i) => {
          const line = interpolate(frame, [it.cue - 6, it.cue + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const p = interpolate(frame, [it.cue, it.cue + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ position: "relative", padding: "34px 0 30px 90px", minHeight: 170 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: 2, width: `${line * 100}%`, background: C.ink }} />
              <div style={{ position: "absolute", left: 0, top: 42, fontFamily: mono, fontSize: 22, color: C.muted, opacity: p }}>0{i + 1}</div>
              <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 62, color: C.ink, letterSpacing: -1.5, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>{it.t}</div>
              {it.s && <div style={{ fontFamily: mono, fontSize: 19, letterSpacing: 3, color: C.muted, marginTop: 10, opacity: p }}>{it.s}</div>}
              {i === 2 && (
                <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
                  {pills.map((pl, k) => {
                    const c0 = it.cue + 10 + k * 7;
                    const q = interpolate(frame, [c0, c0 + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                    return (
                      <span key={pl} style={{ fontFamily: mono, fontSize: 22, padding: "12px 22px", borderRadius: 999, background: C.forest, color: C.paper, opacity: q, transform: `scale(${interpolate(q, [0, 0.7, 1], [0.5, 1.12, 1])})` }}>
                        {pl}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Captions dark={false} pill bottom={50} />
    </AbsoluteFill>
  );
}
