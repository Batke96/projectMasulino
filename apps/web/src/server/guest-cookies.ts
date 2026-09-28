import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const capabilityCookie = "masulino_guest_capability";
const sessionCookie = "masulino_booking_session";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function options(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/book",
    maxAge,
  };
}

export async function readCapability(): Promise<string | null> {
  const value = (await cookies()).get(capabilityCookie)?.value;
  return value && uuid.test(value) ? value : null;
}

export async function ensureCapability(): Promise<string> {
  const existing = await readCapability();
  if (existing) return existing;
  const created = randomUUID();
  (await cookies()).set(capabilityCookie, created, options(60 * 60 * 24 * 30));
  return created;
}

export async function readBookingSession(): Promise<string | null> {
  const value = (await cookies()).get(sessionCookie)?.value;
  if (!value || value.length < 20) return null;
  return value;
}

export async function writeBookingSession(token: string): Promise<void> {
  (await cookies()).set(sessionCookie, token, options(30 * 60));
}
