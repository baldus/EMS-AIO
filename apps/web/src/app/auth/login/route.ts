import * as client from "openid-client";
import { NextResponse, type NextRequest } from "next/server";
import { webEnv } from "@/lib/env";
import { oidcConfig, redirectUri } from "@/lib/oidc";
import { cookieOptions, LOGIN_COOKIE, LOGIN_TTL_SECONDS, sealLoginState } from "@/lib/session";
import { safeReturnTo } from "@/lib/session-crypto";

/** Starts the OIDC Authorization Code flow with PKCE (S256), state, and nonce. */
export async function GET(request: NextRequest) {
  const config = await oidcConfig();
  const codeVerifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri(),
    scope: webEnv().OIDC_SCOPES,
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set(
    LOGIN_COOKIE,
    await sealLoginState({ state, nonce, codeVerifier, returnTo }),
    cookieOptions(LOGIN_TTL_SECONDS),
  );
  return response;
}
