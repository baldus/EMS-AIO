import "server-only";
import { cookies } from "next/headers";
import { webEnv } from "./env";
import {
  joinChunks,
  MAX_COOKIE_CHUNKS,
  seal,
  splitIntoChunks,
  unseal,
  type LoginState,
  type SessionData,
} from "./session-crypto";

export const SESSION_COOKIE = "ems_session";
export const LOGIN_COOKIE = "ems_login";
/** Absolute session lifetime; refresh tokens cannot extend a session beyond this. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const LOGIN_TTL_SECONDS = 10 * 60;

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: webEnv().APP_URL.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

type CookieGetter = (name: string) => string | undefined;
type CookieSetter = (name: string, value: string, maxAge: number) => void;

export async function readSession(get: CookieGetter): Promise<SessionData | null> {
  return unseal<SessionData>(joinChunks(get, SESSION_COOKIE), webEnv().SESSION_SECRET, "session");
}

export async function writeSession(set: CookieSetter, data: SessionData): Promise<void> {
  const sealed = await seal({ ...data }, webEnv().SESSION_SECRET, "session", SESSION_TTL_SECONDS);
  const chunks = splitIntoChunks(sealed);
  for (let i = 0; i < MAX_COOKIE_CHUNKS; i += 1) {
    const chunk = chunks[i];
    set(`${SESSION_COOKIE}.${i}`, chunk ?? "", chunk === undefined ? 0 : SESSION_TTL_SECONDS);
  }
}

export function clearSession(set: CookieSetter): void {
  for (let i = 0; i < MAX_COOKIE_CHUNKS; i += 1) set(`${SESSION_COOKIE}.${i}`, "", 0);
}

/** Reads the session in server components / server actions. */
export async function currentSession(): Promise<SessionData | null> {
  const store = await cookies();
  return readSession((name) => store.get(name)?.value);
}

export async function sealLoginState(state: LoginState): Promise<string> {
  return seal({ ...state }, webEnv().SESSION_SECRET, "login", LOGIN_TTL_SECONDS);
}

export async function unsealLoginState(value: string | undefined): Promise<LoginState | null> {
  return unseal<LoginState>(value, webEnv().SESSION_SECRET, "login");
}
