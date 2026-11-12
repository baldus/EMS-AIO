# CLAUDE.md — working agreement for AI assistants in this repository

EMS Platform: AI-native operating system for an industrial project-management services company.
Read `docs/architecture/overview.md` first, then the doc for the area you are changing.

## Layout

- `apps/api` NestJS API · `apps/web` Next.js App Router · `packages/domain` pure business rules ·
  `packages/db` Prisma schema/migrations/seed · `packages/api-client` OpenAPI + typed client ·
  `infra` docker compose · `docs` architecture/process docs.
- `app/`, `tests/`, `run.py`, `wsgi.py`, `requirements.txt`, `start_ems_home.sh` are the **legacy
  Flask "EMS Home" app**. Do not modify or delete them unless explicitly asked.

## Commands

```bash
pnpm install
pnpm setup:env            # copy *.env.example files (never overwrites)
pnpm infra:up             # postgres, redis, minio, keycloak, mailpit
pnpm db:migrate && pnpm db:seed
pnpm dev                  # api :4000 (Swagger at /docs), web :3000
pnpm verify               # format:check + lint + typecheck + test (must be green before done)
pnpm --filter @ems/web e2e   # full-stack browser test (needs `pnpm build` + Postgres + Playwright)
pnpm openapi:generate     # after ANY API DTO/route change; commit packages/api-client/openapi.json
```

## Non-negotiable rules

1. **Business rules go in `packages/domain`** as pure functions with unit tests. The API calls them;
   prompts never encode them.
2. **Default deny.** Every controller route needs `@RequirePermission(...)`, `@AuthenticatedOnly()`,
   or (health only) `@Public()`. Services must enforce resource scope with
   `AuthorizationService.check/assert/scope`. Unauthorized reads return 404.
3. **Every mutation**: one transaction containing the change + `AuditService.recordUserAction`
   (+ idempotency record when a key is supplied). Updates require `version` (optimistic locking).
4. **Never** let code paths (including agents/workflows) create approvals without
   `validateApprovalDecision`, set approval timestamps, modify approved baselines, mark payments
   verified without evidence, or bypass `PROHIBITED_AGENT_ACTIONS`. The DB triggers will reject
   these — do not weaken or drop triggers/CHECKs in migrations.
5. **Migrations**: never edit an applied migration. Add a new one. Raw SQL invariants get a test in
   `packages/db/test`. Use `prisma migrate deploy` (non-destructive). Do not run
   `prisma migrate reset` or drop databases other than ephemeral `ems_test_run_*` ones.
6. **DTOs**: class-validator + explicit `@ApiProperty` types (including `type: "integer"`, nullable
   `type: String`) so the OpenAPI contract is compiler-independent. The `openapi.test.ts` drift check
   must pass.
7. **Test data is fictional** (example.com domains, no real customers). Never put real credentials
   in source; dev placeholders must contain `local-dev`/`dev-only` so production guards reject them.
8. Strict TypeScript; no `any`; no `console` in app code (use the Nest/pino logger).
9. Keep docs in sync: data model changes → `docs/architecture/data-model.md`; permissions/roles →
   `security-model.md`; approval purposes → `approval-matrix.md`; decisions → `decisions.md`.

## Testing

- Domain: `packages/domain/src/**/*.test.ts` (pure).
- DB: `packages/db/test` — runs against an ephemeral database created per run from
  `TEST_DATABASE_URL` (default `postgresql://ems:ems_local_dev_only@localhost:5432/ems_test`; role
  needs CREATEDB).
- API: `apps/api/test` — real Nest app, real Postgres, RS256 tokens via a local JWKS
  (`test/support/tokens.ts`). Add a test for every new endpoint covering authz denial and tenant
  isolation.
- Web: unit tests for lib code; `apps/web/e2e/run-e2e.mjs` for flows (uses a test-only mock OIDC
  provider).

## Adding an endpoint (checklist)

1. Rule in `@ems/domain` (+ tests) if there is any business logic.
2. DTOs with validation + Swagger metadata; controller with policy decorator + `operationId`.
3. Service: authorize resource → validate rules → transaction(change + audit).
4. API integration tests (happy path, 403/404 isolation, validation, concurrency where relevant).
5. `pnpm openapi:generate`; use the typed client in web.
6. Update docs.
