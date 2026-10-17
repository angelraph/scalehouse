// Converts recorded .webm clips to constant-30fps H.264 .mp4 (frame-accurate for editing) and
// writes per-clip contact sheets with timestamps to out/rec/ for review.
//   node scripts/convert.mjs [names...]
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";

const FF = "C:/Users/Admin/Desktop/BUILTRA/tools/ffmpeg/bin/ffmpeg.exe";
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync("public/clips").filter((f) => f.endsWith(".webm")).map((f) => f.replace(".webm", ""));
for (const n of names) {
  const src = `public/clips/${n}.webm`;
  if (!existsSync(src) || statSync(src).size === 0) {
    console.log(n, "skipped (not ready)");
    continue;
  }
  execFileSync(FF, ["-v", "error", "-y", "-i", src, "-vf", "fps=30", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-an", `public/clips/${n}.mp4`]);
  execFileSync(FF, ["-v", "error", "-y", "-i", `public/clips/${n}.mp4`, "-vf", "fps=1,scale=480:-1,drawtext=text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=6x6", "-frames:v", "1", `out/rec/${n}-sheet.jpg`]);
  console.log(n, "ok");
}
