import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "athletic_log_session";
const PUBLIC_PATHS = ["/sign-in"];

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const authed = await isAuthenticated(req);

  if (!authed && !PUBLIC_PATHS.includes(pathname)) {
    const url = new URL("/sign-in", req.url);
    return NextResponse.redirect(url);
  }
  if (authed && PUBLIC_PATHS.includes(pathname)) {
    const url = new URL("/", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image).*)",
};
