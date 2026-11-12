# Architecture Decisions, Assumptions, and Open Questions

Lightweight ADR log. Each entry: context → decision → consequences. Status is *Accepted* unless
noted. Add new entries at the end; supersede rather than edit.

## ADR-001 Modular monolith with workspace packages
**Context.** Small team, early product, strong consistency needs (approvals, billing).
**Decision.** One NestJS API + one Next.js app + shared packages in a pnpm/Turborepo monorepo.
**Consequences.** Simple deploys and transactions. Module boundaries must be policed in review
(no cross-module table access).

## ADR-002 Business rules in a framework-free `@ems/domain` package
**Decision.** Authorization policy, approval validation, agent guardrails, and entity state rules
are pure functions with unit tests, consumed by the API, workflows, and agents alike.
**Consequences.** One source of truth; rules are testable without a database; the API is an
adapter. Prompts never encode rules.

## ADR-003 PostgreSQL + Prisma, with raw-SQL integrity guards
**Decision.** Prisma for schema/migrations/client. Invariants Prisma cannot express (CHECKs,
partial/functional unique indexes, append-only and approval triggers) live in a dedicated SQL
migration (`20261112000100_integrity_guards`).
**Consequences.** Defense in depth: even buggy code, scripts, or AI tools cannot backdate an
approval, alter an approved baseline, verify a payment without evidence, or rewrite audit history.
`prisma migrate diff` shows no drift (Prisma ignores these objects).

## ADR-004 OIDC resource server; platform-side user provisioning
**Decision.** The API validates IdP access tokens (JWKS, asymmetric algs only). Users must exist in
`users` (invited) before they can do anything; first login links the IdP subject by **verified**
email from the configured issuer. Roles live in the platform DB, not IdP groups.
**Consequences.** IdP-agnostic (Keycloak locally; Entra ID/Okta/Auth0 in production). Customer
tenancy and project roles are modeled where they are enforced.

## ADR-005 MFA from token claims (`amr`/`acr`), enforced per role and permission
**Decision.** A session is MFA-satisfied when `amr` contains a configured method (default
`mfa,otp,totp,hwk,swk,webauthn`) or `acr` equals a configured value. Roles flagged `mfa_required`
and permissions flagged `privileged` are ignored without MFA. Production startup refuses
password-only or `acr` 0/1 configurations.
**Consequences.** Users can still sign in without MFA and see non-privileged data; privileged
actions demand step-up.

## ADR-006 Web app as confidential client; tokens never reach the browser
**Decision.** Authorization Code + PKCE + state + nonce with `openid-client`. Tokens are stored in an
encrypted (JWE A256GCM) httpOnly SameSite=Lax cookie (chunked), refreshed in middleware. Server
components call the API server-side. Logout is a same-origin POST.
**Consequences.** No token exposure to XSS; Server Actions provide CSRF origin checks for
mutations. Session lifetime is capped at 12 h.

## ADR-007 Tenancy model: every organization is a tenant boundary
**Decision.** Customer users belong to one home organization; their grants are only effective inside
it, and they can never hold global grants (enforced in policy, independent of assignments). EMS
internal users get global roles; project access for non-managers comes from `project_members`.
Unauthorized reads return **404** to avoid leaking existence.
**Consequences.** Application-level isolation. PostgreSQL Row-Level Security is planned as an
additional layer (R2).

## ADR-008 Engagement ≠ Project
**Decision.** `engagements` (EMS's paid service under a contract) and `projects` (the customer's
equipment project) are separate entities joined many-to-many by `engagement_projects`.
**Consequences.** A retainer can end while the machine project continues; one project can span
planning-package, retainer, and T&M engagements over time. Billing hangs off engagements; schedule,
gates and risks hang off projects.

## ADR-009 Approvals bind to exact content
**Decision.** Approvals target exactly one `document_revision` or `baseline`, store the content
SHA-256 the approver reviewed, and the DB rejects a mismatch. `decided_at` is always the database
clock. Approvals are append-only; revocation is a new row.
**Consequences.** Approving "the contract" is impossible — only "revision 3, hash abc…" can be
approved. Any edit creates a new revision that needs a new approval.

## ADR-010 Hash-chained audit log in the same transaction
**Decision.** Every mutation writes an `audit_events` row in its own transaction, chained by
SHA-256 over canonical JSON with a transaction-scoped advisory lock serializing appends.
**Consequences.** Tamper-evident and atomic. Audit writes are serialized (fine at EMS's scale);
revisit with per-tenant chains if write volume grows. An external anchor (e.g. periodic hash
published to WORM storage) is planned.

## ADR-011 Optimistic concurrency + idempotency keys
**Decision.** Mutable records carry `version`; updates must send the version they read (409 on
mismatch). Create endpoints accept `Idempotency-Key`; the key, request hash and response are stored
in the same transaction as the mutation. Financial and approval endpoints will **require** keys.

## ADR-012 Generated OpenAPI contract and client
**Decision.** DTO classes with explicit `@ApiProperty` metadata → `openapi.json` (committed) →
`openapi-typescript` types → `openapi-fetch` client. A test fails if the committed contract drifts.

## ADR-013 Tests use real infrastructure where it matters
**Decision.** API and DB tests run against real PostgreSQL in an **ephemeral, uniquely named
database per run** (created, migrated with `migrate deploy`, dropped) and real RS256 tokens verified
through a JWKS. The e2e suite drives the production web build against a test-only mock OIDC provider.
**Consequences.** No destructive resets of shared databases; tests catch trigger, constraint, and
auth-wiring bugs that mocks would hide.

## ADR-014 Temporal for durable workflows, BullMQ for short jobs (planned)
See [overview §6](overview.md#6-durable-workflows-and-background-jobs-designed-r2).

## ADR-015 Keep the legacy Flask app untouched
**Decision.** Leave `app/` (EMS Home) in place; the new platform lives under `apps/` and
`packages/`. **Consequence.** Two stacks coexist until a retirement decision (below).

---

## Assumptions (reasonable defaults chosen)

1. **Single currency per record, USD default**, ISO-4217 codes; amounts in integer cents.
2. **One EMS operator organization** (enforced by unique partial index).
3. **IdP is EMS-controlled** (so email-based first-login linking is acceptable). Disable
   `AUTH_EMAIL_LINKING_ENABLED` if multiple/untrusted IdPs are federated.
4. **Customers do not self-register**; EMS provisions customer users.
5. **Internal EMS staff may read all CRM organizations**; project data requires membership unless
   the user is an EMS manager/admin.
6. **Fractional allocation** is modeled as `engagements.weekly_hours_target` (0–80).
7. **Stage-gate model**: a project has ordered gates with a required approval level (1–3); the
   default template is G0 Charter → G1 Design Review → G2 FAT → G3 SAT → G4 Handover.
8. **No hard deletes** for business records; archive instead.
9. **Timestamps UTC** everywhere; UI renders UTC explicitly until per-user time zones exist.
10. **Audit chain is global**, serialized via advisory lock.

## Open questions

These do not block Release 0 but need an owner decision before the release noted.

| # | Question | Needed by |
|---|---|---|
| Q1 | Retire legacy EMS Home (Flask)? Import its companies/projects/tasks into the platform? | R1 |
| Q2 | Production identity provider (Entra ID, Okta, Auth0, self-hosted Keycloak)? Customer users via the same IdP or B2B federation? | R1 |
| Q3 | Hosting target (AWS/Azure/on-prem) and region/data-residency requirements for customer data. | R1 |
| Q4 | Accounting system of record for invoices/payments (QuickBooks Online, Xero, NetSuite)? | R3 |
| Q5 | E-signature provider for contract execution evidence (DocuSign, Adobe Sign, manual upload)? | R2 |
| Q6 | Which LLM providers are approved, and may customer documents be sent to them (DPA/zero-retention)? | R3 |
| Q7 | Who at EMS may grant Level 1 approvals for contracts above a value threshold (delegation of authority matrix)? | R2 |
| Q8 | Retention periods for audit events, documents, and agent transcripts. | R2 |
| Q9 | Multi-currency invoicing and tax handling (sales tax/VAT) requirements. | R3 |
