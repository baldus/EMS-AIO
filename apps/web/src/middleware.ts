import { NextResponse, type NextRequest } from "next/server";
import { webEnv } from "@/lib/env";
import { refreshSession } from "@/lib/oidc";
import { contentSecurityPolicy } from "@/lib/security-headers";
import { clearSession, cookieOptions, readSession, writeSession } from "@/lib/session";

/** Refresh access tokens this many seconds before they expire. */
const REFRESH_LEEWAY_SECONDS = 60;

/** Routes reachable without a session. */
const PUBLIC_PATHS = [/^\/auth\//, /^\/login$/, /^\/access$/, /^\/healthz$/];

function withSecurityHeaders(response: NextResponse): NextResponse {
  const env = webEnv();
  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy({ issuerUrl: env.OIDC_ISSUER_URL, dev: env.NODE_ENV !== "production" }),
  );
  return response;
}

/**
 * Applies security headers everywhere, requires a session for application pages, and
 * transparently refreshes access tokens. Authorization itself is enforced by the API on every
 * request; this is only routing.
 */
export async function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.some((p) => p.test(request.nextUrl.pathname))) {
    return withSecurityHeaders(NextResponse.next());
  }

  const session = await readSession((name) => request.cookies.get(name)?.value);
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  if (!session) return withSecurityHeaders(NextResponse.redirect(loginUrl));

  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt - REFRESH_LEEWAY_SECONDS > now)
    return withSecurityHeaders(NextResponse.next());

  const refreshed = await refreshSession(session);
  if (!refreshed) {
    const response = NextResponse.redirect(loginUrl);
    clearSession((name, value, maxAge) => response.cookies.set(name, value, cookieOptions(maxAge)));
    return withSecurityHeaders(response);
  }

  // Make the refreshed cookies visible to this request's server components and to the browser.
  const pending: [string, string, number][] = [];
  await writeSession((name, value, maxAge) => pending.push([name, value, maxAge]), refreshed);
  for (const [name, value] of pending) request.cookies.set(name, value);
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const [name, value, maxAge] of pending)
    response.cookies.set(name, value, cookieOptions(maxAge));
  return withSecurityHeaders(response);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
