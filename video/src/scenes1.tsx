import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DotWorld, DrawnMark } from "./brand";
import { Bg, Browser, Captions, Corners, Count, Cursor, Rise, SpokenText, Stamp, Ticker, Typed, useRamp, useScene, useSpring } from "./lib";
import { brand, C, mono, sans, serif } from "./theme";

const PAYEE = "0x1F8eb41Cf3E9CAfa36586934DeE82a81590D7A49";
const PAYEE_SHORT = "0x1F8e…7A49";

/* ─────────────── 1 · INTRO ─────────────── */
export function Intro() {
  const frame = useCurrentFrame();
  const { at } = useScene();
  const zoom = interpolate(frame, [0, 200], [1.0, 1.06]);
  const worldDim = interpolate(frame, [0, 40, 80], [0, 0.85, 0.32], { extrapolateRight: "clamp" });
  const markP = useSpring(28, { damping: 14 });
  const letters = "Scalehouse".split("");
  return (
    <AbsoluteFill>
      <Bg color={C.night} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(15,74,40,0.55), transparent 65%)" }} />
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <DotWorld width={1920} height={1080} cell={25} dim={worldDim} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * markP}) translateY(${(1 - markP) * 30}px)`, filter: "drop-shadow(0 20px 60px rgba(232,174,69,0.25))" }}>
            <DrawnMark size={230} from={22} />
          </div>
          <div style={{ display: "flex", marginTop: 6 }}>
            {letters.map((l, i) => {
              const p = interpolate(frame, [62 + i * 3, 80 + i * 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <span key={i} style={{ fontFamily: brand, fontWeight: 700, fontSize: 132, color: C.paper, letterSpacing: -2, display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 50}px) rotate(${(1 - p) * 8}deg)`, filter: `blur(${(1 - p) * 10}px)` }}>
                  {l}
                </span>
              );
            })}
          </div>
          <Rise from={96} style={{ marginTop: 14, fontFamily: sans, fontSize: 52, color: "rgba(255,254,242,0.86)", fontWeight: 500 }}>
            Weighed in public. <span style={{ fontFamily: serif, fontStyle: "italic", color: C.gold, fontSize: 64 }}>Paid once.</span>
          </Rise>
          <Rise from={116} style={{ marginTop: 34, fontFamily: mono, fontSize: 19, letterSpacing: 5, color: "rgba(255,254,242,0.5)" }}>
            BUILT ON ARC · USDC · CIRCLE WALLETS
          </Rise>
        </AbsoluteFill>
      </AbsoluteFill>
      {frame > at("This") - 4 && <Captions dark />}
    </AbsoluteFill>
  );
}

/* ─────────────── 2 · HOOK ─────────────── */
type Line = { at: number; cmd: string; out?: string; outColor?: string; outAt?: number; stamp?: string };
export function Hook() {
  const frame = useCurrentFrame();
  const { at } = useScene();
  const lines: Line[] = [
    { at: at("hold"), cmd: "agent.balance()", out: "1,000.00 USDC", outColor: C.gold },
    { at: at("spending limit"), cmd: "agent.limit()", out: "500 USDC / day   ✓ OK", outColor: C.green },
    { at: at("doesn't"), cmd: 'agent.pay("0x000…dEaD", 50)', out: "✓ SENT · within limit", outColor: C.green, outAt: at("wrong person"), stamp: "WRONG WALLET" },
    { at: at("same invoice") - 6, cmd: 'agent.pay(invoice "#4471")', out: "✓ SENT · again", outColor: C.green, outAt: at("twice"), stamp: "PAID TWICE" },
    { at: at("Or"), cmd: 'agent.pay("we changed our wallet…")', out: "✓ SENT", outColor: C.green, outAt: at("fake"), stamp: "FAKE INVOICE" },
  ];
  const visible = lines.filter((l) => frame >= l.at - 2).length;
  const shift = interpolate(frame, lines.map((l) => l.at), lines.map((_, i) => Math.max(0, i - 2) * 158), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shake = frame >= at("wrong person") && frame < at("wrong person") + 10 ? Math.sin(frame * 3) * 6 : 0;
  const redFlash = interpolate(frame - at("wrong person"), [0, 3, 14], [0, 0.22, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Bg color={C.night} />
      <AbsoluteFill style={{ background: C.red, opacity: redFlash }} />
      <Corners dark />
      <div style={{ position: "absolute", left: 160, top: 120, fontFamily: mono, fontSize: 22, letterSpacing: 5, color: "rgba(255,254,242,0.5)" }}>
        AUTONOMOUS AGENT · WALLET · SPENDING LIMIT
      </div>
      <div style={{ position: "absolute", left: 160, top: 200, right: 120, height: 610, overflow: "hidden", transform: `translateX(${shake}px)` }}>
        <div style={{ transform: `translateY(${-shift}px)` }}>
          {lines.slice(0, visible).map((l, i) => {
            const outAt = l.outAt ?? l.at + 22;
            return (
              <div key={i} style={{ height: 158, fontFamily: mono, fontSize: 56 }}>
                <div style={{ color: C.paper }}>
                  <span style={{ color: C.gold }}>{"> "}</span>
                  <Typed text={l.cmd} from={l.at} cps={34} caret={i === visible - 1 && frame < outAt} />
                </div>
                {frame >= outAt && (
                  <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 6 }}>
                    <span style={{ color: l.outColor, fontSize: 44 }}>
                      <Typed text={l.out ?? ""} from={outAt} cps={60} caret={false} />
                    </span>
                    {l.stamp && <Stamp from={outAt + 8} text={l.stamp} color={C.red} size={32} rotate={-4} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {frame >= at("wrong person") && <Ticker top={850} items={["Limit OK", "Paid 0x000…dEaD", "Limit OK", "Invoice #4471 paid twice", "Limit OK", "Fake invoice paid"]} bg={C.gold} />}
      <Captions dark bottom={70} />
    </AbsoluteFill>
  );
}

/* ─────────────── 3 · QUESTION ─────────────── */
export function Question() {
  const { at, voEnd } = useScene();
  const markP = useSpring(at("moved") - 6, { damping: 12 });
  return (
    <AbsoluteFill>
      <Bg color={C.paper} dots />
      <Corners dark={false} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center" }}>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 96, color: C.ink, letterSpacing: -3, lineHeight: 1.05 }}>
          <SpokenText from={at("So")} to={at("payment", 1, "end")}>So what if every payment</SpokenText>
        </div>
        <div style={{ fontWeight: 700, fontSize: 96, color: C.ink, letterSpacing: -3, lineHeight: 1.15, fontFamily: sans }}>
          <SpokenText from={at("had")} to={at("to")}>had to</SpokenText>{" "}
          <SpokenText from={at("prove")} to={at("itself,", 1, "end")} style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 400, color: C.forest, fontSize: 132, letterSpacing: -1 }}>
            prove itself?
          </SpokenText>
        </div>
        <Rise from={at("before")} style={{ marginTop: 30, fontFamily: mono, fontSize: 24, letterSpacing: 6, color: C.muted }}>
          BEFORE A SINGLE CENT MOVED.
        </Rise>
        <div style={{ marginTop: 40, transform: `scale(${markP})`, opacity: markP }}>
          <DrawnMark size={110} from={at("moved") - 6} />
        </div>
      </AbsoluteFill>
      {voEnd > 0 && <Captions dark={false} pill />}
    </AbsoluteFill>
  );
}

/* ─────────────── 4 · PAY ─────────────── */
const BX = 820;
const BY = 150;
const IN = { x: BX + 44, y: BY + 46 + 36 }; // content origin inside the browser
export function Pay() {
  const frame = useCurrentFrame();
  const { at } = useScene();
  const tPaste = at("Paste");
  const tHow = at("how much");
  const tWhat = at("what for");
  const tTap = at("Tap");
  const tScreen = at("screens");
  const tBudget = at("checks your budget");
  const tPays = at("and pays");
  const tPaid = at("thirty") - 4;
  const card = useSpring(6);
  const btnPress = frame >= tTap && frame < tTap + 10 ? interpolate(frame - tTap, [0, 4, 10], [1, 0.94, 1]) : 1;
  const popup = useSpring(tTap + 6, { damping: 16 });
  const popupOut = useRamp(tTap + 40, tTap + 52);
  const paid = useSpring(tPaid, { damping: 14 });

  const field = (label: string, x: number, y: number, w: number, value: string, from: number, cps: number, focus: boolean) => (
    <div style={{ position: "absolute", left: x, top: y, width: w }}>
      <div style={{ fontFamily: sans, fontSize: 18, color: C.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ height: 66, borderRadius: 14, background: C.sheet, border: `2px solid ${focus ? C.forest : C.rule}`, boxShadow: focus ? "0 0 0 5px rgba(15,74,40,0.12)" : undefined, display: "flex", alignItems: "center", padding: "0 20px", fontFamily: mono, fontSize: 25, color: C.ink, overflow: "hidden", whiteSpace: "nowrap" }}>
        <Typed text={value} from={from} cps={cps} caret={focus} />
      </div>
    </div>
  );
  const check = (from: number, title: string, sub: string, i: number) => {
    const p = interpolate(frame, [from, from + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 0", borderTop: `1px solid ${C.rule}`, opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
        <span style={{ width: 36, height: 36, borderRadius: 36, background: C.forest, color: C.gold, display: "grid", placeItems: "center", fontSize: 22, transform: `scale(${interpolate(p, [0, 0.7, 1], [0, 1.3, 1])})` }}>✓</span>
        <div>
          <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 25, color: C.ink }}>{title}</div>
          <div style={{ fontFamily: mono, fontSize: 17, color: C.muted, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
    );
  };
  const focus = frame < tHow - 4 ? "w" : frame < tWhat - 4 ? "a" : frame < tTap - 6 ? "f" : "";
  return (
    <AbsoluteFill>
      <Bg color={C.paper2} dots />
      <Corners dark={false} />
      <div style={{ position: "absolute", left: 110, top: 190, width: 640 }}>
        <Rise from={0} style={{ fontFamily: mono, fontSize: 20, letterSpacing: 5, color: C.forest }}>01 · PAY ANYONE</Rise>
        <div style={{ marginTop: 26, fontFamily: sans, fontWeight: 700, fontSize: 92, letterSpacing: -3, lineHeight: 1, color: C.ink }}>
          <SpokenText from={at("pay anyone")} to={at("USDC,", 1, "end")}>Pay anyone.</SpokenText>
        </div>
        <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 108, color: C.forest, lineHeight: 1.05 }}>
          <SpokenText from={at("one wallet")} to={at("wallet.", 1, "end")}>One wallet.</SpokenText>
        </div>
        {frame >= tPaid - 6 && (
          <Rise from={tPaid - 6} style={{ marginTop: 50 }}>
            <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 150, color: C.ink, letterSpacing: -6, lineHeight: 1 }}>
              <span style={{ color: C.goldDeep }}>&lt;</span>
              <Count from={0} to={30} start={tPaid - 6} dur={26} />
              <span style={{ fontSize: 70 }}> s</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 19, letterSpacing: 3, color: C.muted, marginTop: 8 }}>FROM TAP TO PAID · ARC MAINNET</div>
          </Rise>
        )}
      </div>

      <div style={{ position: "absolute", left: BX, top: BY, transform: `translateY(${(1 - card) * 80}px) rotate(${(1 - card) * 2}deg)`, opacity: card }}>
        <Browser url="scalehouse-app.vercel.app/house/2" width={990} height={790}>
          <div style={{ position: "absolute", inset: 0, padding: "34px 44px", background: C.paper }}>
            <div style={{ fontFamily: sans, fontSize: 18, color: C.muted }}>edu provision · House #2</div>
            <div style={{ marginTop: 18, borderRadius: 26, border: `2px solid ${C.forest}`, background: C.sheet, padding: "28px 32px", height: 640, position: "relative", overflow: "hidden" }}>
              <div style={{ fontFamily: serif, fontSize: 46, color: C.ink }}>Pay someone</div>
              {field("Their wallet address", 32, 96, 560, PAYEE, tPaste, 70, focus === "w")}
              {field("Amount (USDC)", 612, 96, 230, "0.10", tHow, 14, focus === "a")}
              {field("What it's for", 32, 210, 810, "thank you chidi elect", tWhat, 40, focus === "f")}
              <div style={{ position: "absolute", left: 32, top: 320, width: 200, height: 66, borderRadius: 999, background: C.forest, color: C.paper, fontFamily: sans, fontWeight: 600, fontSize: 26, display: "grid", placeItems: "center", transform: `scale(${btnPress})` }}>
                {frame >= tTap ? (frame < tScreen ? "Checking…" : frame < tPaid ? "Paying…" : "Pay") : "Pay"}
              </div>
              <div style={{ position: "absolute", left: 32, right: 32, top: 400 }}>
                {frame >= tScreen && check(tScreen, "Wallet screened", "Circle USDC blocklist · clear", 0)}
                {frame >= tBudget && check(tBudget, "Within your limit", "0.10 of 0.50 USDC · daily budget OK", 1)}
                {frame >= tPays && check(tPays, "Paid by the agent", "signed by its Circle wallet · Arc mainnet", 2)}
              </div>
              {paid > 0.01 && (
                <div style={{ position: "absolute", inset: 0, background: C.forest, borderRadius: 24, padding: "60px 50px", transform: `translateY(${(1 - paid) * 100}%)`, color: C.paper }}>
                  <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: 5, color: C.gold }}>PAID ✓</div>
                  <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 120, letterSpacing: -4, marginTop: 10 }}>0.10 USDC</div>
                  <div style={{ fontFamily: sans, fontSize: 30, marginTop: 14, color: "rgba(255,254,242,0.85)" }}>
                    to <b style={{ fontFamily: mono }}>{PAYEE_SHORT}</b> for “thank you chidi elect”
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
                    <span style={{ padding: "16px 26px", borderRadius: 999, background: C.gold, color: C.ink, fontFamily: sans, fontWeight: 600, fontSize: 22 }}>Open receipt</span>
                    <span style={{ padding: "16px 26px", borderRadius: 999, border: "2px solid rgba(255,254,242,0.4)", fontFamily: sans, fontWeight: 600, fontSize: 22 }}>Pay someone else</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Browser>
      </div>

      {popup > 0.01 && popupOut < 1 && (
        <div style={{ position: "absolute", right: 70, top: 120, width: 360, borderRadius: 20, background: "#141414", color: "#fff", padding: 24, boxShadow: "0 30px 70px rgba(0,0,0,0.4)", opacity: popup * (1 - popupOut), transform: `translateY(${(1 - popup) * -30}px)` }}>
          <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: 2, color: "rgba(255,255,255,0.55)" }}>WALLET · ARC MAINNET</div>
          <div style={{ fontFamily: sans, fontSize: 24, fontWeight: 600, marginTop: 10 }}>Confirm 1 approval</div>
          <div style={{ fontFamily: sans, fontSize: 17, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>scalehouse-app.vercel.app</div>
          <div style={{ marginTop: 18, height: 50, borderRadius: 999, background: frame > tTap + 24 ? C.green : "#2b5cff", display: "grid", placeItems: "center", fontFamily: sans, fontWeight: 600, fontSize: 20 }}>
            {frame > tTap + 24 ? "✓ Approved" : "Confirm"}
          </div>
        </div>
      )}

      <Cursor
        path={[
          { f: 0, x: 1750, y: 1000 },
          { f: tPaste - 14, x: IN.x + 32 + 260, y: IN.y + 96 + 26 + 33 },
          { f: tPaste - 4, x: IN.x + 32 + 260, y: IN.y + 96 + 26 + 33, click: true },
          { f: tHow - 10, x: IN.x + 612 + 110, y: IN.y + 96 + 26 + 33 },
          { f: tHow - 4, x: IN.x + 612 + 110, y: IN.y + 96 + 26 + 33, click: true },
          { f: tWhat - 10, x: IN.x + 32 + 380, y: IN.y + 210 + 26 + 33 },
          { f: tWhat - 4, x: IN.x + 32 + 380, y: IN.y + 210 + 26 + 33, click: true },
          { f: tTap - 10, x: IN.x + 32 + 100, y: IN.y + 320 + 33 },
          { f: tTap, x: IN.x + 32 + 100, y: IN.y + 320 + 33, click: true },
          { f: tTap + 14, x: 1650, y: 330 },
          { f: tTap + 22, x: 1650, y: 330, click: true },
          { f: tTap + 50, x: 1560, y: 900 },
        ]}
      />
      <Captions dark={false} pill />
    </AbsoluteFill>
  );
}

/* ─────────────── 5 · RECEIPT ─────────────── */
export function Receipt() {
  const frame = useCurrentFrame();
  const { at } = useScene();
  const enter = useSpring(4, { damping: 20, stiffness: 90 });
  const rows: { cue: number; k: string; v: React.ReactNode }[] = [
    { cue: at("Who"), k: "Paid to", v: <span style={{ fontFamily: mono }}>{PAYEE_SHORT}</span> },
    { cue: at("how much"), k: "Amount", v: <span style={{ fontFamily: mono }}>0.10 USDC · 1 × 0.10</span> },
    { cue: at("what for"), k: "For", v: "“thank you chidi elect”" },
  ];
  const hl = (cue: number) => interpolate(frame, [cue, cue + 6, cue + 40, cue + 60], [0, 1, 1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Bg color={C.paper} dots />
      <Corners dark={false} />
      <div style={{ position: "absolute", left: 110, top: 150, fontFamily: mono, fontSize: 20, letterSpacing: 5, color: C.forest }}>02 · EVERY PAYMENT HAS A RECEIPT</div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1800 }}>
        <div
          style={{
            width: 1180,
            borderRadius: 34,
            background: C.sheet,
            boxShadow: "0 50px 120px rgba(15,74,40,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
            padding: "46px 56px",
            transform: `rotateX(${(1 - enter) * 18}deg) rotateY(${(1 - enter) * -14}deg) translateY(${(1 - enter) * 120}px)`,
            opacity: enter,
            position: "relative",
            marginTop: 40,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: sans, fontSize: 20, color: C.muted }}>edu provision · Ticket #5 · Fri 16 Oct 2026, 08:16 UTC</div>
              <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: 5, color: C.forest, marginTop: 18 }}>PAID ✓</div>
              <div style={{ fontFamily: mono, fontWeight: 500, fontSize: 104, letterSpacing: -4, color: C.ink, lineHeight: 1.05 }}>0.10 USDC</div>
            </div>
            <Stamp from={at("receipt")} text="Paid once" color={C.forest} rotate={-10} size={34} style={{ marginTop: 30 }} />
          </div>
          <div style={{ marginTop: 26 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "16px 18px", borderRadius: 14, background: `rgba(232,174,69,${0.28 * hl(r.cue)})`, fontFamily: sans, fontSize: 30, color: C.ink, borderTop: i ? `1px solid ${C.rule}` : undefined }}>
                <span style={{ color: C.muted }}>{r.k}</span>
                <span style={{ fontWeight: 600 }}>{r.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, borderRadius: 18, background: C.forest, color: C.paper, padding: "22px 26px", opacity: interpolate(frame, [at("why") - 2, at("why") + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: 3, color: C.gold }}>WHY THE AGENT PAID · GPT-5</div>
            <div style={{ fontFamily: sans, fontSize: 25, marginTop: 8, lineHeight: 1.35, minHeight: 68 }}>
              <Typed text="Screened the payee clear. Amount is small, within allowance and daily cap, and the house is not paused. Paying now to keep turnaround quick." from={at("why")} cps={70} caret={false} />
            </div>
            <div style={{ display: "flex", gap: 30, marginTop: 14, fontFamily: mono, fontSize: 17, color: "rgba(255,254,242,0.7)", opacity: interpolate(frame, [at("hashed") - 2, at("hashed") + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
              <span>reasoning hash ✓ verified on-chain</span>
              <span>tx 0x582f…9e1e · Arc mainnet ↗</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Captions dark={false} pill bottom={40} />
    </AbsoluteFill>
  );
}
