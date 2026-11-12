# Local infrastructure

```bash
pnpm infra:up            # postgres:5432, redis:6379, minio:9000/9001, keycloak:8080, mailpit:8025
pnpm infra:up:workflows  # + temporal:7233, temporal-ui:8233 (used from Release 2)
pnpm infra:down
```

> **Everything here is for local development only.** All credentials below are placeholders that
> the production configuration checks reject. Never reuse them anywhere else.

| Service | URL | Credentials (dev only) |
|---|---|---|
| PostgreSQL | `localhost:5432` db `ems_dev` | `ems` / `ems_local_dev_only` |
| Keycloak admin | http://localhost:8080/admin | `admin` / `admin-local-dev-only` |
| MinIO console | http://localhost:9001 | `ems-local-dev` / `ems-local-dev-only-password` |
| Mailpit | http://localhost:8025 | — |

## Fictional users (realm `ems`)

Password for all: `LocalDev-Only-Pass-1`. Platform roles come from the seed (`pnpm db:seed`), not
from Keycloak.

| Email | Platform roles | TOTP |
|---|---|---|
| admin@ems.example.com | platform_admin | yes |
| manager@ems.example.com | ems_manager | yes |
| pm@ems.example.com | ems_member + project_manager on both projects | no |
| finance@ems.example.com | ems_finance | yes |
| lead@harborpoint.example.com | customer_admin (Harbor Point) | yes |
| engineer@harborpoint.example.com | customer_member + technical approver on HPA-2026-001 | yes |
| buyer@copperline.example.com | customer_member + commercial approver on CMW-2026-001 | yes |

**TOTP:** users marked "yes" have a pre-registered authenticator. Add this dev-only key to any
authenticator app (TOTP, SHA-1, 6 digits, 30 s):

```
MVWXGLLMN5RWC3BNMRSXMLLPNZWHSLLUN52HALLTMVRXEZLU
```

## Realm notes

`keycloak/ems-realm.json` defines the confidential client `ems-web` (PKCE S256 required, redirect
`http://localhost:3000/auth/callback`), an audience mapper adding `ems-api` to access tokens, and an
`amr` mapper so the API can detect MFA.

**Not yet validated:** this realm could not be imported in the Release 0 build environment (no
Docker). On first start, verify: (1) login works for `pm@…`; (2) users with TOTP are prompted for a
code; (3) the access token contains `"aud": [..., "ems-api"]` and `amr` including `otp` after TOTP.
If `amr` is missing, configure the authenticator reference values in the Keycloak browser flow or set
`AUTH_MFA_ACR_VALUES` to a level-of-authentication value that only the OTP step reaches, and record
the fix in `docs/architecture/decisions.md`.

## Tests

The `ems` role needs `CREATEDB`: tests create and drop their own `ems_test_run_*` databases using
`TEST_DATABASE_URL` (default `postgresql://ems:ems_local_dev_only@localhost:5432/ems_test`).
