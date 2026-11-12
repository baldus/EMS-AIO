/**
 * Content Security Policy computed at runtime so it can reference the configured identity provider
 * (form submissions such as logout redirect to the IdP, which `form-action` must allow).
 * Next.js requires 'unsafe-inline' for its inline bootstrap scripts/styles, and 'unsafe-eval' in
 * development for hot reloading.
 */
export function contentSecurityPolicy(opts: { issuerUrl: string; dev: boolean }): string {
  const idp = new URL(opts.issuerUrl).origin;
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self' ${idp}`,
    "object-src 'none'",
  ].join("; ");
}
