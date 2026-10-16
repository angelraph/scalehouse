import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { clip, SceneProvider } from "./lib";
import { Hook, Intro, Pay, Question, Receipt } from "./scenes1";
import { Attacks, Different, Lock, Outro, People } from "./scenes2";
import { C, FPS } from "./theme";
import timing from "./timing.json";

const COMPONENTS: Record<string, React.FC> = { intro: Intro, hook: Hook, question: Question, pay: Pay, receipt: Receipt, lock: Lock, attacks: Attacks, people: People, different: Different, outro: Outro };
const DEFS = (timing as { id: string; lead: number; tail: number }[]).map((t) => ({ ...t, C: COMPONENTS[t.id] }));

export const SCENES = (() => {
  let at = 0;
  return DEFS.map((d) => {
    const c = clip(d.id);
    const dur = d.lead + Math.ceil(c.duration * FPS) + d.tail;
    const s = { ...d, clip: c, from: at, dur };
    at += dur;
    return s;
  });
})();
export const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0);

/** Diagonal brand bars sweeping across a cut. */
function Wipe({ dark }: { dark: boolean }) {
  const f = useCurrentFrame();
  const bars = [C.gold, C.forest, dark ? C.paper : C.night];
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
      {SCENES.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
          <SceneProvider value={{ clip: s.clip, lead: s.lead }}>
            <s.C />
          </SceneProvider>
          <Sequence from={s.lead} name={`vo-${s.id}`}>
            <Audio src={staticFile(s.clip.file)} volume={1} />
          </Sequence>
        </Sequence>
      ))}
      {/* Music bed and sound design, if generated. */}
      <Audio src={staticFile("sfx/bed.mp3")} volume={(f) => interpolate(f, [0, 60, TOTAL - 120, TOTAL], [0, 0.16, 0.16, 0], { extrapolateRight: "clamp" })} />
      {SCENES.slice(1).map((s) => (
        <Sequence key={`w-${s.id}`} from={s.from - 12} durationInFrames={26} name={`wipe-${s.id}`}>
          <Wipe dark={["hook", "lock", "attacks", "outro"].includes(s.id)} />
          <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.35} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
