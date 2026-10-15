import { sql } from "@/lib/db";

/** Serves an evidence photo. Photos are public by design: the cut form says so. */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^0x[0-9a-f]{64}$/.test(hash)) return new Response("Not found", { status: 404 });
  const [row] = (await sql()`select photo, photo_type from sh_evidence where evidence_hash = ${hash} and photo is not null`) as {
    photo: Buffer | string;
    photo_type: string;
  }[];
  if (!row) return new Response("Not found", { status: 404 });
  // The HTTP driver returns bytea as a "\x…" hex string.
  const bytes = typeof row.photo === "string" ? Buffer.from(row.photo.slice(2), "hex") : row.photo;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.photo_type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
