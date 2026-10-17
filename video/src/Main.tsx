import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { clip, SceneProvider } from "./lib";
import { Hook, Intro, Question } from "./scenes1";
import { Lock, Outro, People } from "./scenes2";
import { Attacks2, Confirm, Different2, Home, Open, Pay2, Receipt2 } from "./scenes3";
import { C, FPS } from "./theme";
import timing from "./timing.json";

const COMPONENTS: Record<string, React.FC> = {
  intro: Intro,
  hook: Hook,
  question: Question,
  home: Home,
  open: Open,
  pay2: Pay2,
  receipt2: Receipt2,
  confirm: Confirm,
  lock2: Lock,
  attacks2: Attacks2,
  people: People,
  different2: Different2,
  outro: Outro,
};
const DEFS = (timing as { id: string; lead: number; tail: number }[]).map((t) => ({ ...t, C: COMPONENTS[t.id] }));

/** Frames each scene overlaps the next, for the blur/scale crossfade. */
export const OVERLAP = 14;
/** Cuts that also get the diagonal brand wipe (into and out of the app tour). */
const WIPES = new Set(["home", "lock2", "people"]);

export const SCENES = (() => {
  let at = 0;
  return DEFS.map((d, i) => {
    const c = clip(d.id);
    const dur = d.lead + Math.ceil(c.duration * FPS) + d.tail;
    const s = { ...d, clip: c, from: at, dur, last: i === DEFS.length - 1 };
    at += dur - OVERLAP;
    return s;
  });
})();
export const TOTAL = SCENES[SCENES.length - 1].from + SCENES[SCENES.length - 1].dur;

/** Scene enters sharp from a soft blur and slight zoom, and leaves by blurring, shrinking and fading. */
function SceneFX({ dur, first, last, children }: { dur: number; first: boolean; last: boolean; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const inP = first ? 1 : interpolate(f, [0, OVERLAP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const outP = last ? 0 : interpolate(f, [dur - OVERLAP, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const blur = (1 - inP) * 16 + outP * 18;
  const scale = 1 + (1 - inP) * 0.05 - outP * 0.04;
  return (
    <AbsoluteFill style={{ opacity: inP * (1 - outP), filter: blur > 0.2 ? `blur(${blur}px)` : undefined, transform: `scale(${scale})` }}>{children}</AbsoluteFill>
  );
}

/** Diagonal brand bars sweeping across a cut. */
function Wipe() {
  const f = useCurrentFrame();
  const bars = [C.gold, C.forest, C.paper];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", zIndex: 1000 }}>
      {bars.map((b, i) => {
        const x = interpolate(f, [i * 2, 12 + i * 2, 20 + i * 2], [-2600, -300, 2600], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={i} style={{ position: "absolute", top: -400, left: 0, width: 1500, height: 2000, background: b, transform: `translateX(${x}px) rotate(18deg)` }} />;
      })}
    </AbsoluteFill>
  );
}

export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {SCENES.map((s, i) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
          <SceneFX dur={s.dur} first={i === 0} last={s.last}>
            <SceneProvider value={{ clip: s.clip, lead: s.lead, dur: s.dur }}>
              <s.C />
            </SceneProvider>
          </SceneFX>
          <Sequence from={s.lead} name={`vo-${s.id}`}>
            <Audio src={staticFile(s.clip.file)} volume={1} />
          </Sequence>
        </Sequence>
      ))}
      <Audio src={staticFile("sfx/bed.mp3")} loop volume={(f) => interpolate(f, [0, 60, TOTAL - 120, TOTAL], [0, 0.14, 0.14, 0], { extrapolateRight: "clamp" })} />
      {SCENES.slice(1).map((s) => (
        <Sequence key={`t-${s.id}`} from={s.from - 4} durationInFrames={26} name={`cut-${s.id}`}>
          {WIPES.has(s.id) && <Wipe />}
          <Audio src={staticFile("sfx/whoosh.mp3")} volume={WIPES.has(s.id) ? 0.35 : 0.18} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
