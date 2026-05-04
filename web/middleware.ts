import { NextResponse, type NextRequest } from "next/server";

/**
 * Route-level auth gate. Runs on every request. The actual heavy lifting
 * (user/org fetch) happens in Server Components via lib/auth/session.ts;
 * middleware only does the cheap "is the cookie present" check so we can
 * redirect unauthenticated users without rendering an empty shell first.
 */

const PROTECTED_PREFIXES = [
  "/organization",
  "/upcoming",
  "/analytics",
  "/profile",
  "/integrations",
  "/docs",
  "/settings",
  "/billing",
  "/org-admin",
  "/mesh-showcase",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("cognia_session")?.value;
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
