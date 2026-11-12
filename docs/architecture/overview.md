# Architecture Overview

EMS Platform is an AI-native operating system for Engineered & Manufacturing Solutions, LTD (EMS),
an industrial project-management services company serving manufacturers, custom machine builders,
robotics integrators, automation companies, and OEMs.

It manages the full lifecycle:
**Prospecting → Sales → Proposal → Contract → Project Execution → Stage Gates → Billing → Closeout.**

> Status: **Release 0 (foundation)** is implemented. See [roadmap](../implementation/roadmap.md).

## 1. Guiding principles

1. **Modular monolith first.** One deployable API, one web app, one database. Module boundaries
   are enforced in code (folders → Nest modules, no cross-module table access) so a module can be
   extracted later if a real scaling or isolation need appears. No microservices now.
2. **Deterministic core, AI at the edge.** Business rules, authorization, and state transitions
   are plain, tested TypeScript (`packages/domain`). AI agents *propose*; deterministic services
   *validate and apply*. Prompts never contain business rules that matter for correctness.
3. **Default deny.** Every request is unauthenticated until proven otherwise; every route must
   declare a policy; every resource access is checked against tenant and project scope.
4. **Evidence over events.** A workflow event, agent output, or UI click is never proof of
   authorization. Controlled transitions validate identity, authority, evidence, and the exact
   document/baseline revision (content hash).
5. **History is immutable.** Audit events, approvals, and document revisions are append-only and
   protected by database triggers. Approved baselines cannot be modified.
6. **Contracts are generated, not hand-written.** The API's OpenAPI document is generated from code,
   committed, drift-checked in tests, and used to generate the typed web client.

## 2. System context

```
                ┌──────────────────────────┐
  EMS staff ───▶│                          │       ┌───────────────────────┐
  Customers ───▶│  apps/web (Next.js)      │──────▶│ OIDC IdP (Keycloak in │
                │  server components +     │◀──────│ dev; Entra/Okta/etc.) │
                │  server actions          │ code  └───────────────────────┘
                └──────────┬───────────────┘ +PKCE           ▲ JWKS
                           │ Bearer access token             │
                           ▼                                 │
                ┌──────────────────────────┐                 │
                │  apps/api (NestJS)       │─────────────────┘
                │  modular monolith        │
                └─┬────────┬────────┬──────┘
                  │        │        │
           ┌──────▼──┐ ┌───▼───┐ ┌──▼────────────┐   ┌──────────────────┐
           │Postgres │ │ Redis │ │ S3-compatible │   │ Temporal (R2+)   │
           │(Prisma) │ │BullMQ │ │ object store  │   │ durable workflows│
           └─────────┘ └───────┘ └───────────────┘   └──────────────────┘
                                                      ┌──────────────────┐
                                                      │ LLM providers    │
                                                      │ (via adapter, R3)│
                                                      └──────────────────┘
```

The browser never holds tokens: the web app is a confidential OIDC client and keeps tokens in an
encrypted, httpOnly session cookie, calling the API server-to-server.

## 3. Repository layout

| Path | Purpose |
|---|---|
| `apps/api` | NestJS API. Auth guard, authorization, audit, idempotency, organizations, projects, dashboard, OpenAPI. |
| `apps/web` | Next.js 15 App Router UI. OIDC login, session, dashboard, organization CRUD, projects. `e2e/` holds the full-stack browser test. |
| `packages/domain` | Framework-free business rules: permission catalog, system roles, policy evaluation, approval validation, agent guardrails, organization rules, canonical JSON. |
| `packages/db` | Prisma schema, SQL migrations (incl. integrity triggers), shared audit-chain append/verify, access-catalog sync, fictional seed, test-database helpers. |
| `packages/api-client` | `openapi.json` (generated from the API) and a typed client (`openapi-typescript` + `openapi-fetch`). |
| `infra` | Docker Compose for local Postgres, Redis, MinIO, Keycloak, Mailpit, Temporal (profile). |
| `docs` | Architecture, business processes, implementation roadmap. |
| `app/`, `tests/`, `run.py`, … | **Legacy** "EMS Home" Flask app (pre-existing). Left untouched; see §8. |

Build orchestration: **pnpm workspaces + Turborepo**. `domain` → `db` → `api` and
`api-client` → `web`. Internal packages compile to `dist/` (CommonJS for `domain`/`db`, ESM for
`api-client`).

## 4. Backend module map

Release 0 implements the modules marked ✅. Others are designed in the data model and roadmap.

| Module | Responsibility | R0 |
|---|---|---|
| `config` | Zod-validated environment, production hardening checks | ✅ |
| `auth` | OIDC access-token verification (JWKS), MFA evaluation, principal resolution, default-deny guard | ✅ |
| `authorization` | Adapter over `@ems/domain` policy (`evaluate`, `accessScope`) | ✅ |
| `audit` | Hash-chained append-only audit events; list and chain verification | ✅ |
| `idempotency` | At-most-once mutations keyed by `Idempotency-Key` | ✅ |
| `organizations` | Organization CRUD with optimistic concurrency, archive/restore | ✅ |
| `projects` | Read + membership (project-level authorization) | ✅ (read) |
| `dashboard` | Tenant-scoped summary | ✅ |
| `crm` | Contacts, opportunities, activities | R1 |
| `sales` | Estimates, proposals, contracts | R1–R2 |
| `delivery` | Engagements, milestones, tasks, dependencies | R1–R2 |
| `governance` | Gates, requirements, approvals, baselines, change requests, risks/issues/decisions | R2 |
| `documents` | Document metadata, revisions, S3 storage, hashing | R1 |
| `finance` | Time entries, invoices, payments, reconciliation | R3 |
| `agents` | Agent registry, runtime, tool gateway, evaluation | R3 |
| `workflows` | Temporal worker (`apps/worker`) | R2 |
| `notifications` | In-app + email (via approved outbound pipeline) | R2 |
| `integrations` | Accounting, calendar, email connectors | R4 |

Module rules: a module owns its tables; other modules call its service, not its tables. Services
take an explicit `principal` and enforce resource-level authorization themselves; the global guard
only enforces "has the permission somewhere".

## 5. Request lifecycle (API)

1. `pino-http` assigns/propagates `X-Request-Id`; Authorization and cookies are redacted from logs.
2. Throttler (300 req/min/IP baseline).
3. `AuthGuard` (global): `@Public` routes pass; otherwise the route **must** declare
   `@RequirePermission` or `@AuthenticatedOnly` (else 403 `NO_POLICY`). Bearer token verified
   against the IdP JWKS (asymmetric algorithms only; `iss`, `aud`, `exp` enforced). The OIDC
   identity is mapped to a pre-provisioned user (first-login linking by verified email), inactive
   users are rejected, grants are loaded, and the route's permission is checked.
4. `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`): unknown fields are rejected, so clients
   cannot set server-managed fields (`id`, `version`, timestamps).
5. Service: resource-level authorization (tenant/project), domain rule validation, transactional
   write + audit event + (optional) idempotency record in **one** database transaction.
6. Errors are rendered as RFC 9457 `application/problem+json` with stable `code` values.

## 6. Durable workflows and background jobs (designed, R2+)

- **Temporal** for long-running business processes with human steps (lead research, proposal
  review, contract execution, onboarding, gate readiness/approval routing, change requests,
  billing/reconciliation, closeout). Workflows orchestrate; **activities call the same domain
  services as the API** and therefore re-run every authorization and validation check. A workflow
  signal such as "approved" only *requests* a transition; the service verifies the approval record
  (identity, authority, MFA, exact revision hash) before applying it.
- **BullMQ on Redis** for short, retryable, non-business-critical jobs (thumbnailing, search
  indexing, notification fan-out, email sending after approval).
- Rule of thumb: if it waits on a human, spans days, or must survive deploys → Temporal; if it is
  seconds long and safely retryable → BullMQ.

## 7. AI integration (designed, R3)

Provider-agnostic `LlmProvider` port with adapters (Anthropic, OpenAI-compatible, local). Agents are
declared as versioned definitions (see [agent-framework.md](agent-framework.md)) and run through a
tool gateway that enforces `@ems/domain` guardrails (`decideAgentAction`, `PROHIBITED_AGENT_ACTIONS`)
plus the database CHECKs on `agent_actions`. Every run records model, prompt version, tokens, and
cost in `agent_runs`.

## 8. Relationship to the legacy "EMS Home" app

The repository already contained a Flask/SQLite "EMS Home" workspace (users, companies, projects,
tasks, pages). It is **left in place and untouched** because moving it would change where its
SQLite data lives on the machine it runs on. The new platform does not read or write its data.
Retiring it (and optionally importing its companies/projects/tasks) is an open decision — see
[decisions.md](decisions.md#open-questions).

## 9. Key technology choices

Node 22 · TypeScript 5.9 (strict) · pnpm 10 · Turborepo 2 · NestJS 11 · Next.js 15 (React 19) ·
PostgreSQL 16 · Prisma 6 · jose / openid-client 6 · class-validator + @nestjs/swagger ·
openapi-typescript + openapi-fetch · Vitest 3 · Playwright (e2e) · Keycloak 26 (local IdP) ·
Temporal, Redis/BullMQ, MinIO (provisioned, used from later releases).

Architecture decisions and their rationale are in [decisions.md](decisions.md).
