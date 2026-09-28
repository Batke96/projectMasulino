import { NextResponse } from "next/server";
import { getAppDb } from "@masulino/database";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  await getAppDb().execute(sql`select 1`);
  return NextResponse.json({ ok: true });
}
