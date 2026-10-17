// Extracts one frame per recorded mark (half size, with a 100px grid) so camera targets can be
// read off in clip pixels (grid lines every 100 clip px).   node scripts/keyframes.mjs <clip>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FF = "C:/Users/Admin/Desktop/BUILTRA/tools/ffmpeg/bin/ffmpeg.exe";
const state = JSON.parse(readFileSync("out/record-state.json", "utf8"));
const name = process.argv[2];
const marks = state[name].marks.filter((m) => m.label !== "start");
const inputs = [];
for (const m of marks) inputs.push("-ss", String(Math.max(0, m.t - 0.2)), "-i", `public/clips/${name}.mp4`);
const grid = "drawgrid=w=100:h=100:t=1:c=red@0.35";
const parts = marks.map((m, i) => `[${i}:v]trim=end_frame=1,${grid},scale=960:-1,drawtext=text='${m.label} ${m.t.toFixed(1)}s':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.7[v${i}]`);
const cols = 3;
const rows = Math.ceil(marks.length / cols);
const pads = [];
for (let i = marks.length; i < rows * cols; i++) pads.push(`color=c=black:s=960x540:d=1[v${i}]`);
const all = [...parts, ...pads].join(";");
const layout = Array.from({ length: rows * cols }, (_, i) => `${(i % cols) * 960}_${Math.floor(i / cols) * 540}`).join("|");
execFileSync(FF, ["-v", "error", "-y", ...inputs, "-filter_complex", `${all};${Array.from({ length: rows * cols }, (_, i) => `[v${i}]`).join("")}xstack=inputs=${rows * cols}:layout=${layout}[out]`, "-map", "[out]", "-frames:v", "1", `out/rec/${name}-keys.jpg`]);
console.log(`out/rec/${name}-keys.jpg`, marks.length, "marks");
