import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import { ENV, type Env } from "../config/env";

/** Only asymmetric algorithms are accepted. `none` and HMAC algorithms are rejected. */
export const ALLOWED_JWT_ALGORITHMS = ["RS256", "PS256", "ES256", "EdDSA"] as const;

export interface VerifiedAccessToken {
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  mfaSatisfied: boolean;
  claims: JWTPayload;
}

export class TokenVerificationError extends Error {}

/** Key resolver injection point: tests supply a local JWKS; production discovers it remotely. */
export const JWKS_RESOLVER = Symbol("JWKS_RESOLVER");
export type JwksResolverFactory = () => Promise<JWTVerifyGetKey>;

export function remoteJwksResolverFactory(env: Env): JwksResolverFactory {
  let cached: JWTVerifyGetKey | null = null;
  return async () => {
    if (cached) return cached;
    let jwksUri = env.OIDC_JWKS_URI;
    if (!jwksUri) {
      const discoveryUrl = `${env.OIDC_ISSUER_URL.replace(/\/$/, "")}/.well-known/openid-configuration`;
      const res = await fetch(discoveryUrl, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`OIDC discovery failed: HTTP ${res.status}`);
      const doc = (await res.json()) as { issuer?: string; jwks_uri?: string };
      if (doc.issuer !== env.OIDC_ISSUER_URL || !doc.jwks_uri) {
        throw new Error("OIDC discovery document issuer mismatch or missing jwks_uri");
      }
      jwksUri = doc.jwks_uri;
    }
    cached = createRemoteJWKSet(new URL(jwksUri), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
    });
    return cached;
  };
}

/** Evaluates the MFA signal in a token against configured `amr`/`acr` values. */
export function evaluateMfa(
  claims: JWTPayload,
  env: Pick<Env, "AUTH_MFA_AMR_VALUES" | "AUTH_MFA_ACR_VALUES">,
): boolean {
  const amr = Array.isArray(claims.amr)
    ? claims.amr.filter((v): v is string => typeof v === "string")
    : [];
  if (amr.some((m) => env.AUTH_MFA_AMR_VALUES.includes(m))) return true;
  const acr = typeof claims.acr === "string" ? claims.acr : null;
  return acr !== null && env.AUTH_MFA_ACR_VALUES.includes(acr);
}

@Injectable()
export class TokenVerifierService {
  private readonly logger = new Logger(TokenVerifierService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(JWKS_RESOLVER) private readonly resolveJwks: JwksResolverFactory,
  ) {}

  async verify(token: string): Promise<VerifiedAccessToken> {
    let payload: JWTPayload;
    try {
      const keys = await this.resolveJwks();
      ({ payload } = await jwtVerify(token, keys, {
        issuer: this.env.OIDC_ISSUER_URL,
        audience: this.env.OIDC_AUDIENCE,
        algorithms: [...ALLOWED_JWT_ALGORITHMS],
        clockTolerance: 30,
        requiredClaims: ["iss", "sub", "aud", "exp", "iat"],
      }));
    } catch (err) {
      if (err instanceof joseErrors.JOSEError) {
        throw new TokenVerificationError(`Invalid access token (${err.code})`);
      }
      this.logger.error({ err }, "Token verification infrastructure failure");
      throw new TokenVerificationError("Unable to verify access token");
    }

    const subject = payload.sub;
    if (!subject) throw new TokenVerificationError("Token has no subject");
    return {
      issuer: payload.iss!,
      subject,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" ? payload.name : null,
      mfaSatisfied: evaluateMfa(payload, this.env),
      claims: payload,
    };
  }
}
