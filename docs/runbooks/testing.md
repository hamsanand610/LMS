# Testing

Levels follow the architecture plan §23.1. Every level runs in CI (`.github/workflows/ci.yml`).

| Level                                                                                                         | Where                              | Command                           | Needs                                    |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------- | ---------------------------------------- |
| Unit — shared contracts (schemas, token derivation and contrast, time utilities)                              | `packages/shared/src/**/*.spec.ts` | `pnpm --filter @lms/shared test`  | nothing                                  |
| Unit — API rules (env contract, passwords and tokens, pagination, MIME sniffing, rate-limit store)            | `apps/api/src/**/*.spec.ts`        | `pnpm --filter @lms/api test`     | nothing                                  |
| Unit — web helpers                                                                                            | `apps/web/src/**/*.spec.ts`        | `pnpm --filter @lms/web test`     | nothing                                  |
| API — full application against PostgreSQL (route table, authentication, permission matrix, branding/settings) | `apps/api/test/**/*.e2e-spec.ts`   | `pnpm --filter @lms/api test:e2e` | PostgreSQL                               |
| Browser smoke — sign-in, admin shell, settings, sign-out (desktop and mobile emulation)                       | `apps/web/e2e/*.spec.ts`           | `pnpm --filter @lms/web test:e2e` | running web + API, a Super Admin account |

`pnpm test` at the root runs every unit level through Turborepo; `pnpm typecheck` and `pnpm lint`
cover the whole workspace. The pre-push hook runs `pnpm typecheck && pnpm test`.

## API tests and the test database

`apps/api/test/setup/global-setup.ts` prepares a dedicated database so tests never touch `lms`:

1. Resolves the URL: `TEST_DATABASE_URL` if set, otherwise `DATABASE_URL` from `apps/api/.env` with
   the database name replaced by `lms_test`.
2. Creates the database when missing, runs `prisma migrate deploy`, the base seed and
   `test/setup/seed-users.ts` (one account per system role plus a lockout account, all with a
   password generated for that run — nothing is stored).
3. Hands the URL, a JWT secret and the password to the test files (`inject()`); each file boots the
   real Nest application (`AppModule` + `configureApp`) with `WORKER_MODE=none` and
   `EMAIL_DRIVER=none`, so pg-boss workers and SMTP are not needed. Storage checks report degraded
   when MinIO is absent; no Phase 1 test uploads files.

Files run one at a time (they share the database). Sign-ins per file are kept under the login rate
limit (5 per 15 minutes per IP and email); each file gets a fresh in-memory limiter because it boots
its own application.

## Browser smoke

```bash
E2E_ADMIN_EMAIL=superadmin@demo.local E2E_ADMIN_PASSWORD=<your local admin password> \
  pnpm --filter @lms/web test:e2e
```

Playwright browsers are installed once with `pnpm --filter @lms/web exec playwright install chromium`.
The tests skip themselves when the two variables are missing, so an accidental run never fails for
lack of credentials. Never commit credentials; CI creates a throw-away Super Admin per run.

## Conventions

- Test names state the rule being protected, not the function name.
- No test may weaken a security control to pass (operating rule 29); use dedicated fixtures instead.
- New endpoints: extend `permissions.e2e-spec.ts`; the route-table test fails on any handler without
  `@Public()` or `@RequirePermission()`.
- New branding tokens or contrast rules: extend `derive.spec.ts` with the colours that motivated them.
