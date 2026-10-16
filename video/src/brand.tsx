import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C } from "./theme";

/**
 * The Scalehouse mark, drawn on: roof and S stroke in, then the leaf and the gold scale pan pop.
 * `from` is the frame the drawing starts; draw takes ~40 frames.
 */
export function DrawnMark({ size, from = 0 }: { size: number; from?: number }) {
  const frame = useCurrentFrame() - from;
  const k = (a: number, b: number) => interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const roof = k(0, 18);
  const s = k(8, 34);
  const leaf = k(26, 40);
  const pan = k(32, 46);
  const panScale = interpolate(pan, [0, 0.6, 1], [0, 1.25, 1]);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id="v-s" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a8a4c" />
          <stop offset="1" stopColor="#0d4424" />
        </linearGradient>
        <linearGradient id="v-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6fb84a" />
          <stop offset="1" stopColor="#2f7a35" />
        </linearGradient>
      </defs>
      <path d="M33 25 L57 9.5 L84 25.5 V45" fill="none" stroke="url(#v-s)" strokeWidth="7.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - roof} />
      <path d="M38 22.5 C18 29 19 47 39 51 L61 55.5 C80 59.5 80 77 66 82" fill="none" stroke="url(#v-s)" strokeWidth="13" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s} />
      <path d="M69 78 V95" stroke="#0d4424" strokeWidth="8.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s} />
      <g style={{ opacity: leaf, transformOrigin: "37px 70px", transform: `scale(${0.6 + 0.4 * leaf})` }}>
        <path d="M16 57 C35 53 55 59 58 90 C47 73 33 65 16 57 Z" fill="url(#v-s)" />
        <path d="M31 66 C44 66 52 73 54 85 C46 77 39 71 31 66 Z" fill="url(#v-leaf)" />
      </g>
      <g style={{ transformOrigin: "57px 33px", transform: `scale(${panScale})` }}>
        <path d="M45 33 H69 A12 8.5 0 0 1 45 33 Z" fill={C.gold} />
        <path d="M57 33 V25" stroke="#0d4424" strokeWidth="2.6" />
        <path d="M53 25.5 L57 16 L61 25.5 Z" fill="#0d4424" />
      </g>
    </svg>
  );
}

const WORLD = [
  "                                                                        ",
  "         ########    #####            ####    ################          ",
  "    #################   ###         #####  ########################  ## ",
  "  #####################  ##        ##   ############################### ",
  "    ###################          ##################################     ",
  "     #################           ###############################        ",
  "      ###############           ###########################   #         ",
  "       #############            #####  ####################             ",
  "        ##########             ######   #################               ",
  "         #######               #########  ############  #               ",
  "          #####   #            ##########   ########   ##               ",
  "           #####              ############    ####     ###              ",
  "             #######           ##########      ##        #              ",
  "              #########         ########                ##  ##          ",
  "              ##########         ######                   #####         ",
  "               #########         ######                  #######        ",
  "                #######           ####                  #########       ",
  "                ######            ###                    #######        ",
  "                #####                                     ###     #     ",
  "                ####                                                    ",
  "                 ###                                                    ",
  "                 ##                                                     ",
];
const RAMP = [
  [15, 74, 40],
  [29, 107, 58],
  [62, 142, 90],
  [127, 182, 154],
  [176, 214, 196],
];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ramp = (v: number) => {
  const x = Math.max(0, Math.min(0.9999, v)) * (RAMP.length - 1);
  const i = Math.floor(x);
  return mix(RAMP[i], RAMP[i + 1], x - i);
};
// Lagos, roughly: the origin of the ripple.
const ORIGIN = { r: 12, c: 34 };

/**
 * The app's dot-matrix world: assembles outward from Lagos, then flows through brand greens,
 * with gold sparks travelling along it. `from` is when it starts assembling.
 */
export function DotWorld({ width, height, from = 0, cell = 24, dim = 1, sparks = true }: { width: number; height: number; from?: number; cell?: number; dim?: number; sparks?: boolean }) {
  const frame = useCurrentFrame() - from;
  const rows = WORLD.length;
  const cols = WORLD[0].length;
  const ox = (width - cols * cell) / 2;
  const oy = (height - rows * cell) / 2;
  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (WORLD[r][c] !== "#") continue;
      const d = Math.hypot(r - ORIGIN.r, (c - ORIGIN.c) * 0.6);
      const appear = interpolate(frame, [d * 1.6, d * 1.6 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      if (appear <= 0) continue;
      const wave = 0.5 + 0.5 * Math.sin(c * 0.22 + r * 0.31 - frame * 0.06);
      let col = ramp(wave * 0.9);
      let rad = cell * 0.2 * (0.7 + 0.5 * wave) * appear;
      if (sparks) {
        const sp = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
        const rnd = sp - Math.floor(sp);
        const blink = Math.max(0, Math.sin(frame * 0.09 + rnd * 40));
        if (rnd > 0.93 && blink > 0.7) {
          col = mix(col, [232, 174, 69], blink);
          rad *= 1.5;
        }
      }
      dots.push(<circle key={`${r}-${c}`} cx={ox + c * cell + cell / 2} cy={oy + r * cell + cell / 2} r={rad} fill={`rgb(${col.join(",")})`} opacity={dim * appear} />);
    }
  }
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      {dots}
    </svg>
  );
}

/** Mark + wordmark lockup. */
export function Wordmark({ size, color = C.paper }: { size: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.22 }}>
      <DrawnMark size={size} from={-999} />
      <span style={{ fontFamily: "Fraunces", fontWeight: 700, fontSize: size * 0.62, color, letterSpacing: -1 }}>Scalehouse</span>
    </span>
  );
}
