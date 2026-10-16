// Writes out/scalehouse-demo.srt and out/transcript.txt from the voiceover word timings and the
// shared scene timing (src/timing.json), so captions line up with the rendered video.
//   node scripts/srt.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FPS = 30;
const vo = JSON.parse(readFileSync("src/vo.json", "utf8"));
const timing = JSON.parse(readFileSync("src/timing.json", "utf8"));
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, "0")}`;
};

let frame = 0;
let n = 0;
const srt = [];
const txt = [];
for (const t of timing) {
  const c = vo.find((v) => v.id === t.id);
  const base = (frame + t.lead) / FPS;
  let cur = [];
  c.words.forEach((w, i) => {
    cur.push(w);
    const end = /[.?!:]$/.test(w.word) || (/[,]$/.test(w.word) && cur.length >= 5) || cur.length >= 9 || i === c.words.length - 1;
    if (end) {
      srt.push(`${++n}\n${ts(base + cur[0].start)} --> ${ts(base + cur[cur.length - 1].end + 0.15)}\n${cur.map((x) => x.word).join(" ")}\n`);
      cur = [];
    }
  });
  txt.push(`[${ts(base).slice(3, 8)}] ${c.text}`);
  frame += t.lead + Math.ceil(c.duration * FPS) + t.tail;
}
mkdirSync("out", { recursive: true });
writeFileSync("out/scalehouse-demo.srt", srt.join("\n"));
writeFileSync("out/transcript.txt", txt.join("\n\n") + "\n");
console.log("cues", n, "total", (frame / FPS).toFixed(1) + "s");
