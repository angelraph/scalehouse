import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Neon Postgres over HTTP: one round trip per query, no connection pool to manage, which suits
 * serverless functions. Use as a tagged template: await sql()`select … where id = ${id}`.
 */
export function sql(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.DATABASE_URL || process.env.NEON_URL;
  if (!url) throw new Error("DATABASE_URL (or NEON_URL) must be set to the Neon connection string");
  client = neon(url);
  return client;
}

/** Public URL for an evidence photo stored in sh_evidence.photo. */
export function evidencePhotoUrl(hash: string, hasPhoto: boolean): string | null {
  return hasPhoto ? `/api/evidence/photo/${hash.toLowerCase()}` : null;
}
