import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  );

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.string().url(),
    CORS_ORIGINS: csv,
    OIDC_ISSUER_URL: z.string().url(),
    OIDC_AUDIENCE: z.string().min(1),
    OIDC_JWKS_URI: z.string().url().optional(),
    AUTH_MFA_AMR_VALUES: csv,
    AUTH_MFA_ACR_VALUES: csv,
    AUTH_EMAIL_LINKING_ENABLED: bool,
    API_DOCS_ENABLED: bool,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    // Production hardening: refuse obviously unsafe configurations at startup.
    if (!env.OIDC_ISSUER_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["OIDC_ISSUER_URL"],
        message: "must use https in production",
      });
    }
    if (env.AUTH_MFA_AMR_VALUES.some((v) => ["pwd", "password"].includes(v))) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_MFA_AMR_VALUES"],
        message: "password is not an MFA method",
      });
    }
    if (env.AUTH_MFA_ACR_VALUES.some((v) => ["0", "1"].includes(v))) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_MFA_ACR_VALUES"],
        message: "acr 0/1 do not indicate MFA",
      });
    }
    if (env.AUTH_MFA_AMR_VALUES.length === 0 && env.AUTH_MFA_ACR_VALUES.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_MFA_AMR_VALUES"],
        message: "an MFA signal must be configured",
      });
    }
    if (/ems_local_dev_only/.test(env.DATABASE_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "development credentials in production",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid API environment configuration: ${details}`);
  }
  return result.data;
}

export const ENV = Symbol("ENV");
