# Security Model

## 1. Threat model summary

| Asset | Primary threats | Key controls |
|---|---|---|
| Customer project and commercial data | Cross-tenant access, over-broad internal access | Tenant-scoped policy, project membership, 404-on-unauthorized |
| Approval records | Forgery, backdating, approving a different revision, agent self-approval | Human+MFA approver, DB-assigned time, content-hash binding, append-only, domain + DB checks |
| Financial state | Duplicate posting, marking paid without evidence | Idempotency keys, evidence-required CHECKs, internal-only verifier |
| Audit history | Tampering, deletion | Append-only triggers, hash chain, verification endpoint |
| Sessions/tokens | Theft via XSS, CSRF, token confusion | Tokens server-side only, httpOnly encrypted cookie, strict CSP, audience/issuer/alg checks |
| AI agents | Prompt injection, privilege escalation, data exfiltration | Proposal-only model, tool allowlists, prohibited actions in code + DB, scope boundaries, outbound approval |

## 2. Authentication

- **OIDC** with an external IdP (Keycloak locally). The web app is a **confidential client** using
  Authorization Code + **PKCE (S256)** + `state` + `nonce` (`openid-client`).
- The API is an **OAuth resource server**: verifies access tokens with the IdP JWKS (`jose`),
  allowing only `RS256/PS256/ES256/EdDSA`; requires `iss`, `aud` (= `OIDC_AUDIENCE`), `sub`, `exp`,
  `iat`; 30 s clock tolerance. HMAC and `none` tokens are rejected (tested).
- **Provisioning is mandatory.** A valid IdP login with no platform user → 403
  `USER_NOT_PROVISIONED`. First login links an *invited* user by **verified** email from the
  **configured issuer**; afterwards identity is by `(issuer, subject)` only, so another IdP account
  with the same email cannot take over (tested).
- **Sessions (web).** Tokens live in an encrypted JWE (dir/A256GCM, key = SHA-256 of
  `SESSION_SECRET`) httpOnly, SameSite=Lax, Secure-in-production cookie, chunked under browser
  limits; 12 h absolute lifetime; access tokens refreshed in middleware 60 s before expiry; failed
  refresh forces re-login. Login state (state/nonce/verifier/returnTo) uses a separate,
  purpose-bound, 10-minute sealed cookie. `returnTo` is restricted to same-origin relative paths.
- **Logout** is a same-origin `POST` (Origin checked) followed by IdP end-session.

## 3. Multi-factor authentication

- MFA is asserted by the IdP via `amr` (or configured `acr`) claims. The dev Keycloak realm
  pre-registers TOTP for fictional privileged users and adds an `amr` mapper.
- Enforcement points:
  1. Roles with `mfa_required` (platform_admin, ems_manager, ems_finance, customer_admin,
     customer approvers) are **inactive** without MFA.
  2. **Privileged permissions** (archive, user/role management, audit read, approvals, payment
     verification, member management, agent review) always require MFA.
  3. Every **approval** requires MFA (domain rule + `approvals_mfa_chk`).
- Production startup refuses configurations where password-only `amr` or `acr` 0/1 would count as
  MFA, or where no MFA signal is configured.

## 4. Authorization

**Default deny at three layers:**
1. **Route policy** — the global guard denies any route lacking `@Public`, `@AuthenticatedOnly`, or
   `@RequirePermission` (tested with a deliberately undecorated controller).
2. **Permission possession** — the guard checks the principal holds the permission in *some* scope.
3. **Resource scope** — services call `evaluate(principal, permission, {organizationId, projectId})`
   or build list filters from `accessScope(...)`.

**Grant model.** Grants = role assignments (global or organization) + project memberships (project
roles). Policy rules (`packages/domain/src/authorization/policy.ts`):
- inactive principals get nothing;
- **customer users never use global grants and only grants inside their home organization** —
  enforced in policy, independent of what assignments exist (protects against mis-assignment);
- organization grants match only that organization; project grants match only that project
  (except `organization:read`, which a project member may use on the project's own organization);
- role/assignment consistency (scope and assignable user types) is re-checked on load.

**Information hiding.** Reads of resources outside scope return **404**, not 403.

Role catalog and permissions: `packages/domain/src/authorization/{permissions,roles}.ts`.

## 5. Tenant isolation

- Every customer organization is a tenant. Tenant-owned rows carry `organization_id`; project
  children inherit through `project_id`.
- All list queries are constructed from `accessScope`, never from client-supplied tenant ids alone.
- Planned hardening (R2): PostgreSQL **Row-Level Security** keyed on a per-transaction
  `app.current_user` setting, and a separate DB role for the API without `UPDATE/DELETE` on
  append-only tables (in addition to triggers).

## 6. Data integrity, approvals, and audit

- Approvals: human (`actor_type=user`, not `service`), active, MFA-verified, correct party (EMS vs
  customer), correct tenant, holding the purpose's permission, not the author of the revision,
  current revision only, reviewed hash == stored hash, evidence when required, idempotency key
  required, client timestamps rejected. Validated in `validateApprovalDecision` **and** enforced by
  DB triggers/CHECKs. See [approval-matrix.md](../business-processes/approval-matrix.md).
- **No AI agent** may sign contracts, approve expenditures or technical/safety releases, alter
  approved baselines, mark invoices paid, declare customer acceptance, or create/backdate approvals
  (`PROHIBITED_AGENT_ACTIONS`, plus DB constraints).
- **Audit**: every mutation writes a hash-chained `audit_events` row in the same transaction (actor,
  tenant, entity, before/after diff, request id, IP, user agent). `GET /v1/audit-events/verify`
  recomputes the chain. Audit and approval tables are append-only.
- **Idempotency** for create operations now; **mandatory** for financial and approval endpoints.
- **Optimistic concurrency** (`version`) prevents lost updates.

## 7. Transport, headers, and input handling

- TLS terminates at the edge in deployed environments; HSTS enabled (API via helmet; web in
  production). Production config refuses non-HTTPS issuer/app URLs.
- API: helmet defaults, CORS allowlist, 256 KB JSON body limit, rate limiting, strict DTO validation
  (`whitelist` + `forbidNonWhitelisted`), UUID path validation, URL scheme allowlist (blocks
  `javascript:`), RFC 9457 errors without internals.
- Web: runtime CSP (`default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self' <IdP>`,
  `object-src 'none'`), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- Logs redact `Authorization`, cookies, and `Set-Cookie`.

## 8. Secrets management

- No real credentials in source control. Example env files and the dev realm contain **clearly
  labeled local-only placeholders**; production startup rejects recognizable dev secrets.
- Production: inject via the platform secret store (AWS Secrets Manager / Azure Key Vault /
  Vault). `integrations.secret_ref` stores only a pointer.
- Rotate `SESSION_SECRET` (invalidates sessions) and the OIDC client secret per policy.

## 9. Encryption

- In transit: TLS everywhere outside localhost.
- At rest: managed PostgreSQL and object storage encryption (KMS keys); S3 buckets private with
  SSE-KMS and presigned, short-lived URLs (R1).
- Session cookies are encrypted and integrity-protected (AES-256-GCM).

## 10. AI-specific controls (prompt-injection-aware tool execution)

- Retrieved content (emails, documents, web pages) is **data, never instructions**: it is passed in
  delimited, labeled blocks; tool calls are validated against the agent's allowlist and JSON
  schemas; tool arguments referencing records are re-authorized against the run's scope.
- The tool gateway, not the model, decides execute/propose/deny (`decideAgentAction`).
- Agents run with the **intersection** of the triggering user's permissions and the agent's
  declared scope, bounded to one organization/project (`agent_runs.organization_id/project_id`).
- **Outbound communication** is always a proposal requiring Level 1 human approval of the exact
  message revision.
- Per-run tool-call budgets and cost limits; all inputs/outputs/tokens logged.

## 11. Test data policy

Fixtures and seeds are fictional (organizations, people, projects), use `example.com` domains,
and create **no** approvals, executed contracts, invoices, or payments.

## 12. Known limitations (Release 0)

1. **Keycloak realm not validated in CI/this environment** (Docker unavailable; running the
   downloaded Keycloak binary was not permitted). The OIDC flow is verified end-to-end against a
   test-only mock provider; the realm JSON (especially the `oidc-amr-mapper` and pre-seeded TOTP
   credentials) must be smoke-tested on first `pnpm infra:up`.
2. **No PostgreSQL RLS yet** — isolation is application-level (policy + query scoping).
3. **Audit chain is not externally anchored** — a DBA with superuser rights could disable triggers
   and rewrite the chain consistently. Mitigation planned: periodic anchor to WORM storage.
4. **No user/role administration API** yet — provisioning is via seed/SQL (R1).
5. **No step-up re-authentication flow** — users without MFA must sign out and back in with MFA.
6. **Throttling is per-instance, in-memory** — move to Redis storage before horizontal scaling.
7. **CSP allows `'unsafe-inline'` scripts** (Next.js bootstrap). Nonce-based CSP is a later
   hardening item.
8. **Access tokens are cached in the session cookie** for up to their lifetime (5 min in the dev
   realm); revocation at the IdP takes effect at next refresh.
9. **Dependency and container scanning** (e.g. `pnpm audit`, Trivy) and SAST are not yet wired to CI.
