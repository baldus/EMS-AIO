import { EncryptJWT, jwtDecrypt } from "jose";

/**
 * Encrypted, integrity-protected session payloads (JWE, dir + A256GCM). The key is derived from
 * SESSION_SECRET. Pure functions so they are unit-testable and usable from middleware.
 */

export interface SessionData {
  sub: string;
  name: string | null;
  email: string | null;
  accessToken: string;
  refreshToken: string | null;
  /** Access token expiry, epoch seconds. */
  expiresAt: number;
}

export interface LoginState {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

async function keyFrom(secret: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

export async function seal(
  payload: Record<string, unknown>,
  secret: string,
  purpose: "session" | "login",
  ttlSeconds: number,
): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: purpose })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .encrypt(await keyFrom(secret));
}

export async function unseal<T>(
  token: string | undefined,
  secret: string,
  purpose: "session" | "login",
): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload, protectedHeader } = await jwtDecrypt(token, await keyFrom(secret), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    if (protectedHeader.typ !== purpose) return null;
    return payload as T;
  } catch {
    return null;
  }
}

/** Browsers cap cookies near 4 KB, so large sealed values are split across numbered cookies. */
export const COOKIE_CHUNK_SIZE = 3_800;
export const MAX_COOKIE_CHUNKS = 4;

export function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += COOKIE_CHUNK_SIZE) {
    chunks.push(value.slice(i, i + COOKIE_CHUNK_SIZE));
  }
  if (chunks.length > MAX_COOKIE_CHUNKS) throw new Error("Session too large for cookies");
  return chunks;
}

export function joinChunks(
  get: (name: string) => string | undefined,
  base: string,
): string | undefined {
  let out = "";
  for (let i = 0; i < MAX_COOKIE_CHUNKS; i += 1) {
    const part = get(`${base}.${i}`);
    if (part === undefined) break;
    out += part;
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Only same-origin relative paths are allowed as post-login destinations (prevents open
 * redirects such as `//evil.example` or `/\evil.example`).
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/dashboard";
  }
  if (/[\r\n]/.test(value)) return "/dashboard";
  return value;
}
