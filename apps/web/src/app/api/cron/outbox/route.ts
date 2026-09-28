import { NextResponse } from "next/server";
import { handleOutboxJob } from "@masulino/reservations";
import { drainOutbox } from "@masulino/core";
import { env } from "../../../../server/env";

export const dynamic = "force-dynamic";

async function drain(request: Request) {
  const config = env();
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${config.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await drainOutbox("vercel-cron", handleOutboxJob);
  return NextResponse.json(result);
}

export function GET(request: Request) {
  return drain(request);
}

export function POST(request: Request) {
  return drain(request);
}
