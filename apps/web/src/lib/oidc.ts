import "server-only";
import * as client from "openid-client";
import { allowsInsecureHttp, webEnv } from "./env";
import type { SessionData } from "./session-crypto";

let configPromise: Promise<client.Configuration> | null = null;

/** Discovers the OIDC provider once per server process. */
export function oidcConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const env = webEnv();
    const issuer = new URL(env.OIDC_ISSUER_URL);
    // Plain-HTTP issuers are only tolerated for local development (docker Keycloak) and e2e tests.
    const insecure = issuer.protocol === "http:" && allowsInsecureHttp(env);
    configPromise = client
      .discovery(
        issuer,
        env.OIDC_CLIENT_ID,
        env.OIDC_CLIENT_SECRET,
        undefined,
        insecure ? { execute: [client.allowInsecureRequests] } : undefined,
      )
      .catch((err: unknown) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

export function redirectUri(): string {
  return new URL("/auth/callback", webEnv().APP_URL).toString();
}

export function sessionFromTokens(
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
  previous?: SessionData,
): SessionData {
  const claims = tokens.claims();
  const expiresIn = tokens.expiresIn() ?? 300;
  return {
    sub: claims?.sub ?? previous?.sub ?? "",
    name: (typeof claims?.name === "string" ? claims.name : null) ?? previous?.name ?? null,
    email: (typeof claims?.email === "string" ? claims.email : null) ?? previous?.email ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previous?.refreshToken ?? null,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
  };
}

/** Refreshes the access token. Returns null when refresh is impossible (re-login required). */
export async function refreshSession(session: SessionData): Promise<SessionData | null> {
  if (!session.refreshToken) return null;
  try {
    const tokens = await client.refreshTokenGrant(await oidcConfig(), session.refreshToken);
    return sessionFromTokens(tokens, session);
  } catch {
    return null;
  }
}
