import { NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Admin-only word timestamps for the demo video captions (OpenAI Whisper). Requires the
 * ADMIN_SECRET bearer token. POST multipart { file } → { words: [{ word, start, end }] }.
 */
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const body = new FormData();
  body.set("file", file, file.name || "audio.mp3");
  body.set("model", "whisper-1");
  body.set("response_format", "verbose_json");
  body.append("timestamp_granularities[]", "word");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body,
  });
  if (!res.ok) return NextResponse.json({ error: `OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 502 });
  const j = (await res.json()) as { text: string; words?: { word: string; start: number; end: number }[] };
  return NextResponse.json({ text: j.text, words: j.words ?? [] });
}
