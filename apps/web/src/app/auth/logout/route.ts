import * as client from "openid-client";
import { NextResponse, type NextRequest } from "next/server";
import { webEnv } from "@/lib/env";
import { oidcConfig } from "@/lib/oidc";
import { clearSession, cookieOptions } from "@/lib/session";

/**
 * Signs out locally and at the identity provider. POST only, with a same-origin check, so a
 * third-party page cannot log users out (logout CSRF).
 */
export async function POST(request: NextRequest) {
  const env = webEnv();
  const origin = request.headers.get("origin");
  if (origin !== new URL(env.APP_URL).origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let destination = new URL("/login?reason=signed_out", env.APP_URL).toString();
  try {
    const config = await oidcConfig();
    if (config.serverMetadata().end_session_endpoint) {
      destination = client
        .buildEndSessionUrl(config, {
          client_id: env.OIDC_CLIENT_ID,
          post_logout_redirect_uri: destination,
        })
        .toString();
    }
  } catch {
    // Provider unreachable: still clear the local session.
  }

  const response = NextResponse.redirect(destination, { status: 303 });
  clearSession((name, value, maxAge) => response.cookies.set(name, value, cookieOptions(maxAge)));
  return response;
}
