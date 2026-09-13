# Testing

Levels follow the architecture plan §23.1. Every level runs in CI (`.github/workflows/ci.yml`).

| Level                                                                                                                                                     | Where                              | Command                           | Needs                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------- | ------------------------------------------------- |
| Unit — shared contracts (schemas, token derivation and contrast, people and batch rules, custom fields, time)                                             | `packages/shared/src/**/*.spec.ts` | `pnpm --filter @lms/shared test`  | nothing                                           |
| Unit — API rules (env contract, passwords and tokens, pagination, MIME sniffing, rate-limit store, sheet parsing, student codes, completeness)            | `apps/api/src/**/*.spec.ts`        | `pnpm --filter @lms/api test`     | nothing                                           |
| Unit — web helpers                                                                                                                                        | `apps/web/src/**/*.spec.ts`        | `pnpm --filter @lms/web test`     | nothing                                           |
| API — the full application against PostgreSQL (route table, authentication, permission matrix, students, batches, notifications, dashboard, queue driver) | `apps/api/test/**/*.e2e-spec.ts`   | `pnpm --filter @lms/api test:e2e` | PostgreSQL                                        |
| Browser — the journeys, on desktop and (on demand) an emulated phone                                                                                      | `apps/web/e2e/*.spec.ts`           | `pnpm --filter @lms/web test:e2e` | running web + API, an admin and a trainer account |

`pnpm test` at the root runs every unit level through Turborepo; `pnpm typecheck` and `pnpm lint`
cover the whole workspace. The pre-push hook runs `pnpm typecheck && pnpm test`.

## API tests and the test database

`apps/api/test/setup/global-setup.ts` prepares a dedicated database so tests never touch `lms`:

1. Resolves the URL: `TEST_DATABASE_URL` if set, otherwise `DATABASE_URL` from `apps/api/.env` with
   the database name replaced by `lms_test`.
2. Creates the database when missing, runs `prisma migrate deploy`, the base seed and
   `test/setup/seed-users.ts` — one account per system role plus a programme, two batches, a trainer
   assigned to one of them and a student in each, so batch scope has something real to filter. The
   password is generated per run and never stored.
3. Hands the URL, a JWT secret and the password to the test files (`inject()`); each file boots the
   real Nest application (`AppModule` + `configureApp`) with `WORKER_MODE=none` and
   `EMAIL_DRIVER=none`.

With `WORKER_MODE=none` there is no queue: `JobsService.enqueue` runs the handler inline and awaited,
so an invitation, a notification or an import has finished by the time the request returns. The
queue driver itself is covered separately by `test/queue.e2e-spec.ts`, which drives pg-boss for real
against the test database — the inline path would otherwise hide a mistake in the job options.

Files run one at a time (they share the database). Sign-ins per file stay under the login limit of
five attempts per quarter of an hour per address; each file boots its own application, so the
in-memory rate limiter starts empty.

Set `LMS_TEST_LOG=1` to see the server's own error output while a test fails.

## Browser tests

```bash
E2E_ADMIN_EMAIL=superadmin@demo.local E2E_ADMIN_PASSWORD='…' \
E2E_TRAINER_EMAIL=trainer1@demo.local E2E_TRAINER_PASSWORD='…' \
  pnpm --filter @lms/web test:e2e
```

The trainer credentials are the demo password (`SEED_DEMO_PASSWORD`); without them the trainer-scope
tests skip rather than fail. Playwright browsers are installed once with
`pnpm --filter @lms/web exec playwright install chromium`.

A `setup` project signs in once per role and stores the session; the other specs reuse it
(`test.use({ storageState })`). Only the sign-in tests themselves start signed out. This keeps the
suite under the login rate limit — a dozen tests each signing in would trip it, and the limiter is
behaviour the auth tests assert, so it is the suite that has to adapt.

`test:e2e` runs the Chromium project. Phone emulation is a separate project, run on demand with
`pnpm --filter @lms/web exec playwright test --project=mobile`; running both at once doubles the
load on the dev server, and the responsive pass belongs to Phase 6.

If a run leaves an account locked (five failed sign-ins), clear it with
`pnpm --filter @lms/api exec tsx scripts/unlock-account.ts <email>`; restarting the API clears the
in-memory rate-limit counters.

## Conventions

- Test names state the rule being protected, not the function name.
- No test may weaken a security control to pass (operating rule 29); use dedicated fixtures instead.
- New endpoints: extend `permissions.e2e-spec.ts` or the module's own spec; the route-table test
  fails on any handler without `@Public()` or `@RequirePermission()`.
- Assert on what the user or the database ends up with, not on a toast: toasts disappear.
- New branding tokens or contrast rules: extend `derive.spec.ts` with the colours that motivated them.
