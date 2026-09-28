import { NextResponse, type NextRequest } from "next/server";

const capabilityCookie = "masulino_guest_capability";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function middleware(request: NextRequest) {
  const existing = request.cookies.get(capabilityCookie)?.value;
  if (existing && uuid.test(existing)) return NextResponse.next();
  const response = NextResponse.next();
  response.cookies.set(capabilityCookie, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/book",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export const config = {
  matcher: ["/book/:path*"],
};
