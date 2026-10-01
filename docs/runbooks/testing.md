# Testing

Levels follow the architecture plan §23.1. Every level runs in CI (`.github/workflows/ci.yml`).

| Level                                                                                                                                                     | Where                                      | Command                                   | Needs                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Unit — shared contracts (schemas, token derivation and contrast, people and batch rules, custom fields, time)                                             | `packages/shared/src/**/*.spec.ts`         | `pnpm --filter @lms/shared test`          | nothing                                                                                          |
| Unit — API rules (env contract, passwords and tokens, pagination, MIME sniffing, rate-limit store, sheet parsing, student codes, completeness)            | `apps/api/src/**/*.spec.ts`                | `pnpm --filter @lms/api test`             | nothing                                                                                          |
| Unit — web helpers                                                                                                                                        | `apps/web/src/**/*.spec.ts`                | `pnpm --filter @lms/web test`             | nothing                                                                                          |
| API — the full application against PostgreSQL (route table, authentication, permission matrix, students, batches, notifications, dashboard, queue driver) | `apps/api/test/**/*.e2e-spec.ts`           | `pnpm --filter @lms/api test:e2e`         | PostgreSQL                                                                                       |
| Browser — the journeys, on desktop and (on demand) an emulated phone                                                                                      | `apps/web/e2e/*.spec.ts`                   | `pnpm --filter @lms/web test:e2e`         | running web, API, sandbox runner and object storage (MinIO); admin, trainer and student accounts |
| Unit — sandbox runner (container arguments and isolation flags, deadlines, the limiter, result parsing, the HTTP surface and its token)                   | `apps/runner/src/runner.spec.ts`           | `pnpm --filter @lms/runner test`          | nothing                                                                                          |
| Sandbox — real jobs in real containers (every language, SQL, time and memory limits, no network, read-only root, fork bombs, output caps)                 | `apps/runner/src/*.sandbox.spec.ts`        | `pnpm --filter @lms/runner test:sandbox`  | Docker and the `lms-sandbox:1` image                                                             |
| Content — every reference solution in the question bank passes every case in the sandbox                                                                  | `apps/api/scripts/verify-question-bank.ts` | `pnpm --filter @lms/api verify:questions` | Docker, the image, a built runner                                                                |

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
   `EMAIL_DRIVER=none`. Two drivers are replaced by stand-ins in `test/setup`: code execution
   (`FakeExecutionDriver`) and object storage (`MemoryStorageDriver`, so exports are written to
   memory). The suite therefore needs PostgreSQL and nothing else, here and in CI.

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
E2E_ADMIN_EMAIL=superadmin@siacademy.example E2E_ADMIN_PASSWORD='…' \
E2E_TRAINER_EMAIL=trainer1@siacademy.example E2E_TRAINER_PASSWORD='…' \
E2E_STUDENT_EMAIL=student01@siacademy.example E2E_STUDENT_PASSWORD='…' \
  pnpm --filter @lms/web test:e2e
```

The trainer and student credentials are the demo password (`SEED_DEMO_PASSWORD`); without them the
tests for that role skip rather than fail. Any account with the Admin role works for
`E2E_ADMIN_*`. Sign-in is limited to five attempts per quarter of an hour for one address, so a
suite re-run within that window fails in the `setup` project: wait for the window to pass rather
than raising the limit. Playwright browsers are installed once with
`pnpm --filter @lms/web exec playwright install chromium`.

Three journeys consume the thing they demonstrate, so a suite that has already run needs its
data put back. Each skips with a message saying which:

| Journey                  | What it uses up                                                         | What puts it back |
| ------------------------ | ----------------------------------------------------------------------- | ----------------- |
| J-04, J-05 roll call     | A class still waiting to be marked. The seed leaves a couple per batch. | `demo:reset`      |
| J-08 publish a recording | A finished class of this trainer with no recording yet.                 | `demo:reset`      |
| J-10 sit a test          | The learner's one permitted attempt at the open test.                   | `demo:reset`      |

`pnpm --filter @lms/api demo:advance` is the lighter one and is worth running first: it moves the
dates so today has classes and an open test window, and brings every class's status up to the
clock, which is what makes a class that has already finished offer its roll call and its recording
at all. It cannot give back an attempt that has been used — only `demo:reset` does that.

`demo:reset` drops the schema and re-seeds, so Prisma refuses to run it when it is invoked by an
AI agent without the developer's explicit consent. Run it yourself.

When a browser test fails, Playwright writes a trace, a screenshot and a page snapshot under
`apps/web/test-results/`. Those capture the page as it stood, **including the value of any form
field**, and Playwright makes no exception for a password box. Two things keep the demo password
out of them: the `setup` project, which is the only spec that types one, runs with tracing off, and
the sign-in helper empties the password box the moment it has been submitted. Both
`test-results/` and `playwright-report/` are also git-ignored, so nothing reaches the repository
either way — but delete those folders once a failure has been understood rather than attaching
them to a ticket.

Run the API compiled rather than watched for a browser run:

```bash
pnpm --filter @lms/api build
```

then `node dist/main.js` from `apps/api`. The `nest start --watch` runner restarts by killing a
process id that has sometimes already gone, and on Windows that takes the whole watcher down
mid-suite, which reads as a page full of failures rather than what it is.

The web side stays on `next dev`, which compiles a route the first time it is opened. The suite
allows one retry for that reason: a retry reaches the compiled route, and a test that fails twice
has failed. Do not try to warm every route up front — on a machine this size that starves the disk
badly enough to time out the database and take both servers down with it.

If the API cannot reach PostgreSQL while `docker ps` says the container is healthy, check from
inside it:

```bash
docker exec lms-postgres-1 psql -U lms -d lms -c "select 1"
```

When that answers and the host still cannot connect, Docker Desktop's port forwarder is wedged;
restarting Docker Desktop is what clears it.

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
