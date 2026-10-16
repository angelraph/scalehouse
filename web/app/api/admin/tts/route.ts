import { NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Admin-only text to speech for the demo video voiceover (OpenAI TTS). Requires the
 * ADMIN_SECRET bearer token. POST { text, voice?, instructions? } → audio/mpeg.
 */
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { text?: string; voice?: string; instructions?: string; model?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length > 4000) return NextResponse.json({ error: "text required (max 4000 chars)" }, { status: 400 });

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: body?.model ?? "gpt-4o-mini-tts",
      voice: body?.voice ?? "ash",
      input: text,
      instructions: body?.instructions,
      response_format: "mp3",
    }),
  });
  if (!res.ok) return NextResponse.json({ error: `OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 502 });
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } });
}
