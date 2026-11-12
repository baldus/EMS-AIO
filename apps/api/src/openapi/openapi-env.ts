/** Inert configuration used only to construct the app for contract generation (no I/O occurs). */
export const OPENAPI_GENERATION_ENV = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
  OIDC_ISSUER_URL: "https://issuer.invalid/realms/ems",
  OIDC_AUDIENCE: "ems-api",
  AUTH_MFA_AMR_VALUES: "mfa",
  API_DOCS_ENABLED: "false",
} as const;
