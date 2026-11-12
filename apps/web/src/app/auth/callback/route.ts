import * as client from "openid-client";
import { NextResponse, type NextRequest } from "next/server";
import { webEnv } from "@/lib/env";
import { oidcConfig, redirectUri, sessionFromTokens } from "@/lib/oidc";
import { cookieOptions, LOGIN_COOKIE, unsealLoginState, writeSession } from "@/lib/session";

/** Completes the Authorization Code flow: validates state, PKCE, and nonce; stores the session. */
export async function GET(request: NextRequest) {
  const appUrl = webEnv().APP_URL;
  const loginState = await unsealLoginState(request.cookies.get(LOGIN_COOKIE)?.value);
  if (!loginState) {
    return NextResponse.redirect(new URL("/login?reason=state", appUrl));
  }

  // Rebuild the callback URL on the configured origin so proxies cannot alter what is validated.
  const callbackUrl = new URL(redirectUri());
  callbackUrl.search = request.nextUrl.search;

  let tokens;
  try {
    tokens = await client.authorizationCodeGrant(await oidcConfig(), callbackUrl, {
      pkceCodeVerifier: loginState.codeVerifier,
      expectedState: loginState.state,
      expectedNonce: loginState.nonce,
      idTokenExpected: true,
    });
  } catch {
    const failed = NextResponse.redirect(new URL("/login?reason=failed", appUrl));
    failed.cookies.set(LOGIN_COOKIE, "", cookieOptions(0));
    return failed;
  }

  const response = NextResponse.redirect(new URL(loginState.returnTo, appUrl));
  response.cookies.set(LOGIN_COOKIE, "", cookieOptions(0));
  await writeSession(
    (name, value, maxAge) => response.cookies.set(name, value, cookieOptions(maxAge)),
    sessionFromTokens(tokens),
  );
  return response;
}
