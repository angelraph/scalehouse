import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { MIGRATION_002 } from "@/lib/migrations";

export const dynamic = "force-dynamic";

/** Applies pending schema changes. Requires the ADMIN_SECRET bearer token. Idempotent. */
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const done: string[] = [];
  for (const stmt of MIGRATION_002) {
    try {
      await sql().query(stmt);
      done.push(`ok: ${stmt.slice(0, 60)}`);
    } catch (e) {
      return NextResponse.json({ done, failed: stmt, error: (e as Error).message }, { status: 500 });
    }
  }
  return NextResponse.json({ done });
}
