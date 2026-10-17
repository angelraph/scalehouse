import React from "react";
import { AbsoluteFill, Easing, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, FPS, mono, sans, serif } from "./theme";

/** [scene frame, clip seconds]: the clip is time-remapped so these moments line up. */
export type Anchor = [number, number];
/** Camera keyframe: at scene frame f, zoom s, centred on clip pixel (x, y). */
export type Cam = { f: number; s: number; x: number; y: number };
export type Callout = { from: number; to: number; x: number; y: number; text: string; dir?: "up" | "down" | "left" | "right" };
export type Step = { at: number; text: string };

const CW = 1920;
const CH = 1080;

/** The time-remapped clip: one Sequence per anchor span, each at its own playback rate. */
function Remapped({ src, anchors, total }: { src: string; anchors: Anchor[]; total: number }) {
  const spans: React.ReactNode[] = [];
  const pts = [...anchors];
  if (pts[pts.length - 1][0] < total) pts.push([total, pts[pts.length - 1][1]]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [f0, c0] = pts[i];
    const [f1, c1] = pts[i + 1];
    const dur = f1 - f0;
    if (dur <= 0) continue;
    const dc = c1 - c0;
    spans.push(
      <Sequence key={i} from={f0} durationInFrames={dur} layout="none">
        {dc < 0.05 ? ( /* hold (or a backwards anchor) */
          <Freeze frame={0}>
            <OffthreadVideo src={staticFile(src)} startFrom={Math.round(c0 * FPS)} muted style={{ width: CW, height: CH }} />
          </Freeze>
        ) : (
          <OffthreadVideo src={staticFile(src)} startFrom={Math.round(c0 * FPS)} playbackRate={(dc * FPS) / dur} muted style={{ width: CW, height: CH }} />
        )}
      </Sequence>,
    );
  }
  return <>{spans}</>;
}

/** Playback speed at the current frame (to show an honest "sped up" badge). */
function rateAt(anchors: Anchor[], f: number) {
  for (let i = 0; i < anchors.length - 1; i++) {
    const [f0, c0] = anchors[i];
    const [f1, c1] = anchors[i + 1];
    if (f >= f0 && f < f1) return ((c1 - c0) * FPS) / (f1 - f0);
  }
  return 1;
}

function camAt(cams: Cam[], f: number) {
  if (f <= cams[0].f) return cams[0];
  for (let i = 0; i < cams.length - 1; i++) {
    const a = cams[i];
    const b = cams[i + 1];
    if (f <= b.f) {
      const p = interpolate(f, [a.f, b.f], [0, 1], { easing: Easing.bezier(0.65, 0, 0.35, 1) });
      return { f, s: a.s + (b.s - a.s) * p, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    }
  }
  return cams[cams.length - 1];
}

export function Footage(p: {
  src: string;
  url: string;
  anchors: Anchor[];
  total: number;
  cams: Cam[];
  callouts?: Callout[];
  steps?: Step[];
  section: string;
  title: React.ReactNode;
  network?: "mainnet" | "testnet";
}) {
  const f = useCurrentFrame();
  // Frame box on screen
  const FX = 470;
  const FY = 118;
  const FW = 1370;
  const FH = Math.round((FW * CH) / CW);
  const cam = camAt(p.cams, f);
  // Map clip pixels into the frame: base fit, then camera zoom around (x, y).
  const base = FW / CW;
  const s = base * cam.s;
  const tx = FW / 2 - cam.x * s;
  const ty = FH / 2 - cam.y * s;
  const clampX = Math.min(0, Math.max(FW - CW * s, tx));
  const clampY = Math.min(0, Math.max(FH - CH * s, ty));
  const rate = rateAt(p.anchors, f);
  const enter = interpolate(f, [0, 16], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill>
      {/* Side panel: section, title, steps */}
      <div style={{ position: "absolute", left: 70, top: 130, width: 360, opacity: enter, transform: `translateX(${(1 - enter) * -40}px)` }}>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: 4, color: C.forest }}>{p.section}</div>
        <div style={{ fontFamily: serif, fontSize: 58, lineHeight: 1.02, color: C.ink, marginTop: 14 }}>{p.title}</div>
        <div style={{ marginTop: 34 }}>
          {(p.steps ?? []).map((st, i) => {
            const shown = interpolate(f, [st.at - 10, st.at], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const next = p.steps![i + 1];
            const active = f >= st.at && (!next || f < next.at);
            const done = next && f >= next.at;
            return (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 18, opacity: 0.25 + 0.75 * shown, transform: `translateX(${(1 - shown) * 16}px)` }}>
                <span
                  style={{
                    flex: "0 0 auto",
                    width: 38,
                    height: 38,
                    borderRadius: 38,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: mono,
                    fontSize: 17,
                    background: done ? C.forest : active ? C.gold : "transparent",
                    color: done ? C.gold : C.ink,
                    border: `2px solid ${done ? C.forest : active ? C.gold : "rgba(27,27,24,0.2)"}`,
                    boxShadow: active ? `0 0 0 6px rgba(232,174,69,0.25)` : undefined,
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span style={{ fontFamily: sans, fontSize: 24, fontWeight: active ? 650 : 500, color: active ? C.ink : C.ink2, lineHeight: 1.25, paddingTop: 5 }}>{st.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Browser frame with the real app */}
      <div
        style={{
          position: "absolute",
          left: FX,
          top: FY - 44,
          width: FW,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(15,74,40,0.25), 0 0 0 1px rgba(0,0,0,0.08)",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px) scale(${0.97 + 0.03 * enter})`,
        }}
      >
        <div style={{ height: 44, background: "#1b1b18", display: "flex", alignItems: "center", gap: 9, padding: "0 18px" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 12, height: 12, borderRadius: 12, background: c }} />
          ))}
          <div style={{ marginLeft: 14, flex: 1, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)", fontFamily: mono, fontSize: 15, display: "flex", alignItems: "center", padding: "0 14px" }}>
            🔒 {p.url}
          </div>
          <span style={{ fontFamily: mono, fontSize: 13, letterSpacing: 2, padding: "5px 10px", borderRadius: 999, background: p.network === "testnet" ? C.gold : C.green, color: C.ink }}>
            {p.network === "testnet" ? "ARC TESTNET" : "ARC MAINNET"}
          </span>
        </div>
        <div style={{ position: "relative", width: FW, height: FH, overflow: "hidden", background: C.paper }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH, transformOrigin: "0 0", transform: `translate(${clampX}px, ${clampY}px) scale(${s})` }}>
            <Remapped src={p.src} anchors={p.anchors} total={p.total} />
            {(p.callouts ?? []).map((c, i) => {
              const k = interpolate(f, [c.from, c.from + 10, c.to - 8, c.to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              if (k <= 0) return null;
              const inv = 1 / cam.s;
              const dir = c.dir ?? "up";
              const off = 26 * inv;
              const pos: React.CSSProperties =
                dir === "up"
                  ? { left: c.x, top: c.y + off, transform: `translate(-50%, 0) scale(${inv * (0.85 + 0.15 * k)})`, transformOrigin: "50% 0" }
                  : dir === "down"
                    ? { left: c.x, top: c.y - off, transform: `translate(-50%, -100%) scale(${inv * (0.85 + 0.15 * k)})`, transformOrigin: "50% 100%" }
                    : dir === "left"
                      ? { left: c.x + off, top: c.y, transform: `translate(0, -50%) scale(${inv * (0.85 + 0.15 * k)})`, transformOrigin: "0 50%" }
                      : { left: c.x - off, top: c.y, transform: `translate(-100%, -50%) scale(${inv * (0.85 + 0.15 * k)})`, transformOrigin: "100% 50%" };
              return (
                <React.Fragment key={i}>
                  <div style={{ position: "absolute", left: c.x - 12 * inv, top: c.y - 12 * inv, width: 24 * inv, height: 24 * inv, borderRadius: 99, background: C.gold, opacity: k, boxShadow: `0 0 0 ${8 * inv}px rgba(232,174,69,0.3)` }} />
                  <div style={{ position: "absolute", ...pos, opacity: k, whiteSpace: "nowrap", fontFamily: sans, fontWeight: 650, fontSize: 30, color: C.paper, background: C.forest, padding: "12px 22px", borderRadius: 999, boxShadow: "0 14px 34px rgba(0,0,0,0.3)" }}>{c.text}</div>
                </React.Fragment>
              );
            })}
          </div>
          {rate > 1.8 && (
            <div style={{ position: "absolute", right: 18, top: 18, fontFamily: mono, fontSize: 16, letterSpacing: 2, padding: "8px 14px", borderRadius: 999, background: "rgba(27,27,24,0.85)", color: C.gold }}>
              ⏩ SPED UP {Math.round(rate)}×
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
