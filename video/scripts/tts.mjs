// Generates one voiceover clip per scene through the deployment's admin TTS route, then writes
// src/vo.json with each clip's duration (seconds), measured with ffprobe.
//   node scripts/tts.mjs [voice]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FFPROBE = "C:/Users/Admin/Desktop/BUILTRA/tools/ffmpeg/bin/ffprobe.exe";
const SITE = "https://scalehouse-app.vercel.app";
const voice = process.argv[2] ?? "ash";
const secret = readFileSync("../.keys/admin.env", "utf8").match(/ADMIN_SECRET=(.*)/)[1].trim();
const lines = JSON.parse(readFileSync("src/script.json", "utf8"));
const instructions =
  "Voice: a calm, confident product-film narrator. Warm and clear, never salesy. Measured pace with natural pauses at commas and full stops. " +
  "Slightly lower and slower on short punchy sentences like 'Once.' or 'Frozen.' so they land. Crisp consonants.";

mkdirSync("public/vo", { recursive: true });
// Only (re)generate the ids passed after the voice, e.g. `node scripts/tts.mjs ash home open`; keep the rest.
const only = process.argv.slice(3);
let prev = [];
try {
  prev = JSON.parse(readFileSync("src/vo.json", "utf8"));
} catch {}
const out = [];
for (const l of lines) {
  const old = prev.find((p) => p.id === l.id && p.text === l.text);
  if (only.length && !only.includes(l.id) && old) {
    out.push(old);
    continue;
  }
  const res = await fetch(`${SITE}/api/admin/tts`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ text: l.text, voice, instructions }),
  });
  if (!res.ok) throw new Error(`${l.id}: ${res.status} ${await res.text()}`);
  const file = `public/vo/${l.id}.mp3`;
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const dur = Number(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim());
  out.push({ ...l, file: `vo/${l.id}.mp3`, duration: dur });
  console.log(l.id, dur.toFixed(2) + "s");
}
writeFileSync("src/vo.json", JSON.stringify(out, null, 2));
console.log("total", out.reduce((s, x) => s + x.duration, 0).toFixed(1) + "s");
