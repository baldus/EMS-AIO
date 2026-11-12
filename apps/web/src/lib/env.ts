import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  OIDC_ISSUER_URL: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  OIDC_SCOPES: z.string().default("openid profile email"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  E2E_ALLOW_HTTP: z.enum(["true", "false"]).default("false"),
});

export type WebEnv = z.infer<typeof schema>;

let cached: WebEnv | null = null;

const isLocalhost = (url: string) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname);

/**
 * Plain HTTP is allowed in development, and in production mode only for the automated e2e suite
 * when every endpoint is on localhost (E2E_ALLOW_HTTP=true). Never for real deployments.
 */
export function allowsInsecureHttp(env: WebEnv): boolean {
  if (env.NODE_ENV !== "production") return true;
  return (
    env.E2E_ALLOW_HTTP === "true" &&
    [env.APP_URL, env.API_BASE_URL, env.OIDC_ISSUER_URL].every(isLocalhost)
  );
}

/** Server-only configuration, validated on first use. */
export function webEnv(): WebEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid web environment configuration: ${details}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    const https = env.APP_URL.startsWith("https://") && env.OIDC_ISSUER_URL.startsWith("https://");
    if (!https && !allowsInsecureHttp(env)) {
      throw new Error("APP_URL and OIDC_ISSUER_URL must use https in production");
    }
    if (/local-dev|replace-with/.test(env.SESSION_SECRET + env.OIDC_CLIENT_SECRET)) {
      throw new Error("Development secrets must not be used in production");
    }
  }
  cached = env;
  return env;
}
