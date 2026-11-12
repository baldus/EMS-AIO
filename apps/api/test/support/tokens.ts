import { randomUUID } from "node:crypto";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
  type JWTVerifyGetKey,
  type CryptoKey,
} from "jose";

export const TEST_ISSUER = "https://idp.test/realms/ems";
export const TEST_AUDIENCE = "ems-api";

export interface TokenOptions {
  sub?: string;
  email?: string;
  emailVerified?: boolean;
  amr?: string[];
  acr?: string;
  iss?: string;
  aud?: string;
  expiresIn?: string | number;
  issuedAt?: number;
  signWith?: "trusted" | "untrusted";
  extra?: JWTPayload;
}

/** Issues RS256 tokens like an OIDC provider would, verified by the API against a local JWKS. */
export class TestIdentityProvider {
  private constructor(
    private readonly trustedKey: CryptoKey,
    private readonly untrustedKey: CryptoKey,
    readonly jwks: JWTVerifyGetKey,
  ) {}

  static async create(): Promise<TestIdentityProvider> {
    const trusted = await generateKeyPair("RS256");
    const untrusted = await generateKeyPair("RS256");
    const publicJwk = {
      ...(await exportJWK(trusted.publicKey)),
      kid: "trusted",
      alg: "RS256",
      use: "sig",
    };
    return new TestIdentityProvider(
      trusted.privateKey,
      untrusted.privateKey,
      createLocalJWKSet({ keys: [publicJwk] }),
    );
  }

  /** Subject ids are stable per email so repeated logins map to the same identity. */
  subjectFor(email: string) {
    return `kc-${email}`;
  }

  async token(email: string, opts: TokenOptions = {}): Promise<string> {
    const claims: JWTPayload = {
      email,
      email_verified: opts.emailVerified ?? true,
      ...(opts.amr ? { amr: opts.amr } : {}),
      ...(opts.acr ? { acr: opts.acr } : {}),
      ...opts.extra,
    };
    const jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "trusted" })
      .setIssuer(opts.iss ?? TEST_ISSUER)
      .setAudience(opts.aud ?? TEST_AUDIENCE)
      .setSubject(opts.sub ?? this.subjectFor(email))
      .setJti(randomUUID())
      .setIssuedAt(opts.issuedAt)
      .setExpirationTime(opts.expiresIn ?? "5m");
    return jwt.sign(opts.signWith === "untrusted" ? this.untrustedKey : this.trustedKey);
  }

  /** Token with an MFA `amr` claim. */
  mfa(email: string, opts: TokenOptions = {}) {
    return this.token(email, { amr: ["pwd", "otp"], ...opts });
  }
}
