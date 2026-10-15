"use client";

import { useEffect, useState } from "react";
import { PixelArt } from "./motion/Motion";

// 11×11 pixel icons, drawn in dots like Column's (1:20).
const ICONS = {
  shop: [
    "...........",
    ".#########.",
    ".#.#.#.#.#.",
    ".#########.",
    "...........",
    ".#########.",
    ".#.......#.",
    ".#.###...#.",
    ".#.#.#...#.",
    ".#.#.#...#.",
    ".#########.",
  ],
  team: [
    "...........",
    "..##...##..",
    ".####.####.",
    ".####.####.",
    "..##...##..",
    "...........",
    ".####.####.",
    "###########",
    "###########",
    "###########",
    "...........",
  ],
  bounty: [
    "...........",
    "....###....",
    "...#####...",
    "..#######..",
    "..##.#.##..",
    "..#######..",
    "...#####...",
    "....###....",
    ".....#.....",
    "...#####...",
    "...........",
  ],
  floor: [
    ".....#.....",
    ".....#.....",
    "#########..",
    "#...#...#..",
    ".#.###.#...",
    "..#####....",
    ".....#.....",
    ".....#.....",
    "....###....",
    "..#######..",
    "...........",
  ],
};

const CASES = [
  {
    key: "shop" as const,
    label: "Shops",
    title: "Paying suppliers for what actually arrived",
    body: "The clerk cuts a ticket at the door: ten bags, from this supplier, to this wallet. The owner counts. Nine arrived? It pays for nine, or freezes if the gap is too big. The agent pays the same day, oldest first.",
  },
  {
    key: "team" as const,
    label: "Teams",
    title: "Paying freelancers when the work is done",
    body: "Each milestone is a ticket bound to the worker's wallet. The client confirms with one free signature. Payment follows the work, not the end of the month.",
  },
  {
    key: "bounty" as const,
    label: "Bounties",
    title: "Paying contributors without paying twice",
    body: "Each accepted submission is a ticket; its link is the reference, so it can't be claimed twice. A reviewer witnesses, and can't be the one getting paid.",
  },
  {
    key: "floor" as const,
    label: "Buying floors",
    title: "Paying farmers by the kilo, in public",
    body: "Cocoa, cashew, shea: the weight goes on a ticket the moment it's on the scale, a second person checks it, and the farmer is paid at the posted price, once.",
  },
];

/** Column's big switching list (active item in ink, the rest receding), with pixel-dot icons. */
export function UseCases() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);

  // Gently cycles until someone picks one.
  useEffect(() => {
    if (hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % CASES.length), 4200);
    return () => clearInterval(t);
  }, [hold]);

  const c = CASES[i];
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
      <div>
        <div className="bigswitch space-y-1" role="tablist" aria-label="Who it's for">
          {CASES.map((x, j) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={i === j}
              aria-current={i === j}
              onClick={() => {
                setI(j);
                setHold(true);
              }}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div key={c.key} className="mt-8 max-w-md" style={{ animation: "fadein .6s var(--ease-reveal) both" }}>
          <h3 className="text-xl font-semibold">{c.title}</h3>
          <p className="mt-2 leading-relaxed text-muted">{c.body}</p>
        </div>
      </div>
      <div className="relative grid aspect-square max-h-[420px] place-items-center rounded-[32px] bg-paper-2">
        <div className="dots pointer-events-none absolute inset-0 rounded-[32px] opacity-50" />
        {CASES.map((x, j) => (
          <div
            key={x.key}
            className="absolute w-[58%] transition-all duration-700"
            style={{ opacity: i === j ? 1 : 0, transform: i === j ? "scale(1)" : "scale(0.9)", filter: i === j ? "none" : "blur(8px)" }}
          >
            <PixelArt rows={ICONS[x.key]} size={10} className="h-full w-full" color={j % 2 ? "var(--forest)" : "#2f7a35"} />
          </div>
        ))}
      </div>
      <style>{`@keyframes fadein{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}`}</style>
    </div>
  );
}
