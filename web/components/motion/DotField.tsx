"use client";

import { useEffect, useRef } from "react";

/**
 * A coarse world map, one character per dot cell ('#' = land). Equirectangular, ~75°N to ~55°S.
 * Drawn faded at the edges, so precision isn't the point: the shape reads as "the world".
 */
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

const ROWS = WORLD.length;
const COLS = WORLD[0].length;

// Brand ramp: deep forest → leaf → sage → mint, with gold sparks.
const RAMP: [number, number, number][] = [
  [15, 74, 40],
  [29, 107, 58],
  [62, 142, 90],
  [127, 182, 154],
  [176, 214, 196],
];
const GOLD: [number, number, number] = [232, 174, 69];

function mix(a: number[], b: number[], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function ramp(v: number) {
  const x = Math.max(0, Math.min(0.9999, v)) * (RAMP.length - 1);
  const i = Math.floor(x);
  return mix(RAMP[i], RAMP[i + 1], x - i);
}

/**
 * Column's hero background, in Scalehouse colors: a dot-matrix world that assembles outward from
 * one point, then keeps slowly flowing through the brand greens with the odd gold spark. Canvas,
 * ~30fps, paused when off-screen, a still frame for reduced-motion users.
 */
export function DotField({
  className = "",
  origin = [0.62, 0.42],
  density = 1,
}: {
  className?: string;
  origin?: [number, number];
  density?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0,
      h = 0,
      dpr = 1,
      raf = 0,
      visible = true,
      last = 0;
    const start = performance.now();

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Precomputed per size: the land cells (ocean is skipped entirely) and their geometry.
    let cells: { cx: number; cy: number; x: number; y: number; d: number; edge: number }[] = [];
    const BUCKETS = 10;

    const layout = () => {
      const step = Math.max(8, Math.min(11, w / (COLS * 1.45 * density)));
      const cols = Math.ceil(w / step);
      const rows = Math.ceil(h / step);
      const ox = origin[0] * cols;
      const oy = origin[1] * rows;
      const maxD = Math.hypot(cols, rows);
      cells = [];
      for (let y = 0; y < rows; y++) {
        const line = WORLD[Math.floor((y / rows) * ROWS)] ?? "";
        for (let x = 0; x < cols; x++) {
          if (line[Math.floor((x / cols) * COLS)] !== "#") continue;
          const edge = 1 - Math.min(1, Math.hypot((x / cols - 0.62) * 0.95, (y / rows - 0.45) * 1.15));
          if (edge <= 0.04) continue;
          cells.push({ cx: x * step + step / 2, cy: y * step + step / 2, x, y, d: Math.hypot(x - ox, (y - oy) * 1.4) / maxD, edge });
        }
      }
    };

    // Colors are quantised into a few buckets so each frame is ~a dozen fills, not thousands.
    const paths: Path2D[] = Array.from({ length: BUCKETS + 1 }, () => new Path2D());
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      for (let i = 0; i <= BUCKETS; i++) paths[i] = new Path2D();
      const alphas = new Float32Array(BUCKETS + 1);
      const counts = new Uint16Array(BUCKETS + 1);
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        const appear = reduce ? 1 : Math.max(0, Math.min(1, (t * 0.75 - c.d) * 4));
        if (appear <= 0) continue;
        const v =
          0.5 +
          0.22 * Math.sin(c.x * 0.11 + t * 0.55) +
          0.18 * Math.sin(c.y * 0.17 - t * 0.42) +
          0.14 * Math.sin((c.x + c.y) * 0.07 + t * 0.3);
        const gold = Math.sin(c.x * 1.7 + c.y * 2.3 + t * 0.9) * Math.sin(c.x * 0.31 - t * 0.2) > 0.93;
        const b = gold ? BUCKETS : Math.max(0, Math.min(BUCKETS - 1, Math.floor(v * BUCKETS)));
        const r = (2.1 + 1.1 * v) * (0.55 + 0.45 * appear);
        paths[b].moveTo(c.cx + r, c.cy);
        paths[b].arc(c.cx, c.cy, r, 0, Math.PI * 2);
        alphas[b] += (0.45 + 0.55 * v) * Math.min(1, c.edge * 1.6) * appear;
        counts[b]++;
      }
      for (let b = 0; b <= BUCKETS; b++) {
        if (!counts[b]) continue;
        const col = b === BUCKETS ? GOLD : ramp((b + 0.5) / BUCKETS);
        ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${Math.min(0.95, alphas[b] / counts[b]).toFixed(3)})`;
        ctx.fill(paths[b]);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < 50) return;
      last = now;
      draw(now);
    };

    resize();
    layout();
    const ro = new ResizeObserver(() => {
      resize();
      layout();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    if (reduce) draw(start + 60_000);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin[0], origin[1], density]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none block h-full w-full ${className}`} />;
}
