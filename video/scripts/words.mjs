// Gets word-level timestamps for each voiceover clip (Whisper, via the deployment's admin route)
// and aligns them to the script's own words (so captions show the script's spelling).
//   node scripts/words.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SITE = "https://scalehouse-app.vercel.app";
const secret = readFileSync("../.keys/admin.env", "utf8").match(/ADMIN_SECRET=(.*)/)[1].trim();
const vo = JSON.parse(readFileSync("src/vo.json", "utf8"));
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

for (const clip of vo) {
  const form = new FormData();
  form.set("file", new Blob([readFileSync(`public/${clip.file}`)], { type: "audio/mpeg" }), `${clip.id}.mp3`);
  const res = await fetch(`${SITE}/api/admin/transcribe`, { method: "POST", headers: { authorization: `Bearer ${secret}` }, body: form });
  if (!res.ok) throw new Error(`${clip.id}: ${res.status} ${await res.text()}`);
  const { words: heard } = await res.json();

  // Align script words to heard words in order; unmatched script words get interpolated times.
  const script = clip.text.split(/\s+/).filter(Boolean);
  const out = script.map((w) => ({ word: w, start: null, end: null }));
  let j = 0;
  for (let i = 0; i < script.length; i++) {
    const target = norm(script[i]);
    for (let k = j; k < Math.min(j + 4, heard.length); k++) {
      const h = norm(heard[k].word);
      if (h === target || (target.length > 3 && (h.startsWith(target.slice(0, 4)) || target.startsWith(h.slice(0, 4))))) {
        out[i].start = heard[k].start;
        out[i].end = heard[k].end;
        j = k + 1;
        break;
      }
    }
  }
  // Fill gaps by interpolation.
  const first = heard[0]?.start ?? 0;
  const last = heard[heard.length - 1]?.end ?? clip.duration;
  for (let i = 0; i < out.length; i++) {
    if (out[i].start != null) continue;
    let a = i - 1;
    while (a >= 0 && out[a].start == null) a--;
    let b = i + 1;
    while (b < out.length && out[b].start == null) b++;
    const t0 = a >= 0 ? out[a].end : first;
    const t1 = b < out.length ? out[b].start : last;
    const n = b - a - 1;
    const pos = i - a;
    out[i].start = t0 + ((t1 - t0) * (pos - 1)) / n;
    out[i].end = t0 + ((t1 - t0) * pos) / n;
  }
  clip.words = out;
  const matched = out.filter((_, i) => i < script.length).length;
  console.log(clip.id, `heard ${heard.length} / script ${script.length}`, matched);
}
writeFileSync("src/vo.json", JSON.stringify(vo, null, 2));
