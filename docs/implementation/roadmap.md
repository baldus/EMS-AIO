# Implementation Roadmap

Each release ends with: migrations, OpenAPI regenerated, tests (unit + integration + e2e for new
flows), docs updated, `pnpm verify` green.

## Release 0 — Foundation ✅ (this release)

- pnpm + Turborepo monorepo; strict TypeScript; ESLint/Prettier; Turbo pipelines.
- Docker Compose: Postgres, Redis, MinIO, Keycloak (realm + fictional users with TOTP), Mailpit,
  Temporal (profile).
- Full normalized schema (39 tables) + integrity-guard migration (append-only, approval binding,
  baseline immutability, payment evidence, agent action limits).
- OIDC resource-server auth, provisioning/linking, MFA evaluation; web OIDC client (PKCE) with
  encrypted session and refresh.
- RBAC + tenant isolation + project-level authorization (domain policy, default-deny guard).
- Hash-chained audit events + verification; idempotency; optimistic concurrency.
- Organizations CRUD (create/list/get/update/archive/restore); projects read + members; dashboard.
- OpenAPI contract (drift-tested) and generated typed client.
- Responsive dashboard UI.
- Tests: domain unit, DB guard, API integration (ephemeral DB + real JWTs), web unit, full-stack e2e.
- Fictional seed data.

## Release 1 — CRM, documents, administration

1. User & role administration API/UI (invite, suspend, assign roles, project membership), audited,
   MFA-gated.
2. Contacts and opportunities CRUD; activities timeline.
3. Documents module: S3/MinIO upload via presigned URLs, SHA-256 on server, immutable revisions,
   classification, malware scan hook.
4. Projects and engagements create/update; engagement ↔ project linking.
5. CI pipeline (GitHub Actions): verify + e2e with service containers; `pnpm audit`; container
   build for api/web; Keycloak realm smoke test.
6. Decide Q1 (legacy EMS Home), Q2 (production IdP), Q3 (hosting).

## Release 2 — Governance and workflows

1. `apps/worker` (Temporal) with the activity pattern that calls domain services.
2. Approvals API implementing `validateApprovalDecision` end to end (step-up MFA prompt,
   idempotent).
3. Gates and gate requirements, gate package assembly, gate readiness workflow.
4. Baselines and change requests (CR → baseline revision), risks/issues/decisions.
5. Proposals and contracts with execution workflow (e-signature evidence; Q5).
6. Notifications (in-app + email through Mailpit locally) and outbound-communication approval.
7. PostgreSQL RLS + least-privilege DB roles; Redis-backed throttling.

## Release 3 — Agents and finance

1. Agent runtime: `LlmProvider` port + adapters, tool gateway, proposals, evals in CI, cost budgets.
2. Agents: Project Controls, Risk & Change, Gate Compliance first (internal value, low external
   risk); then Lead Intelligence, Sales Development, Proposal/Contract, Finance, Closeout.
3. Time entries and approval; invoices (retainer, milestone, T&M); payment recording, evidence
   verification, reconciliation workflow (Q4 accounting integration).

## Release 4 — Customer portal and integrations

Customer-facing views (gate approvals, deliverables, CRs), accounting/calendar/email integrations,
reporting (utilization, margin, schedule health), audit anchoring to WORM storage, data retention
jobs (Q8).

## Next-release backlog (Release 1, prioritized)

| # | Item | Notes |
|---|---|---|
| 1 | Validate Keycloak realm on `pnpm infra:up` (amr mapper, TOTP, audience) and add a CI smoke test | Not verifiable in R0 environment |
| 2 | GitHub Actions CI: `pnpm verify` + `pnpm --filter @ems/web e2e` with Postgres service | |
| 3 | User/role/membership administration endpoints + UI | MFA, audited, idempotent |
| 4 | Contacts & opportunities | |
| 5 | Documents & revisions on MinIO | Foundation for approvals |
| 6 | Project & engagement create/update | |
| 7 | Step-up MFA flow (`acr_values` / `prompt=login`) instead of sign-out/in | |
| 8 | Nonce-based CSP for the web app | |
| 9 | Dockerfiles for api/web (standalone output) | |
| 10 | Dependency scanning & SAST in CI | |
