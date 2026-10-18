import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/** Optimistic gate only (cookie present): FastAPI and Better Auth validate the session on every request. */
export function proxy(request: NextRequest) {
  const signedIn = Boolean(getSessionCookie(request));
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app") && !signedIn) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/signup") && signedIn) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/login", "/signup"] };
