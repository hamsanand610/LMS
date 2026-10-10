# Local setup

Target: a new developer runs the complete stack in under one hour (Phase 1 exit criterion).

## 1. Prerequisites

| Tool                       | Version                                                                     | Check                    |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| Node.js                    | 22 (see `.nvmrc`)                                                           | `node -v`                |
| pnpm                       | 11.15.1 (`corepack enable` then `corepack prepare pnpm@11.15.1 --activate`) | `pnpm -v`                |
| Docker Engine + Compose v2 | Docker Desktop, Rancher Desktop or Podman Desktop                           | `docker compose version` |
| Git                        | any recent                                                                  | `git -v`                 |

Windows note: Docker Desktop may be installed per user (`%LOCALAPPDATA%\Programs\DockerDesktop`);
start it before `pnpm services:up`.

## 2. First run

```bash
pnpm install
pnpm env:init        # copies .env.example files (root, apps/api, apps/web); never overwrites
```

Edit `apps/api/.env`:

- `SEED_ADMIN_PASSWORD`: choose a password for the first Super Admin (10+ characters). Do not use `#`
  inside the value — Node's `.env` loader treats it as the start of a comment.
- `SEED_DEMO_PASSWORD`: optional; the password shared by all sample accounts. Leave empty to have
  the sample-data seed (`db:seed:demo`) generate and print one.
- Keep the other values for local work; they match `infra/compose.yml`.

Start the services (PostgreSQL, MinIO with buckets, Mailpit):

```bash
pnpm services:up
```

The Compose file is run with `--env-file .env`, so the root `.env` controls host ports. PostgreSQL is
published on **5433** by default because many machines already run a PostgreSQL service on 5432; the
API's `DATABASE_URL` in `apps/api/.env.example` uses 5433 accordingly. Change `POSTGRES_PORT` in the
root `.env` and the API `DATABASE_URL` together if you need another port.

Create the schema and the base data:

```bash
pnpm db:migrate      # applies prisma/migrations
pnpm db:seed         # organisation, permissions, system roles, settings, branding, flags, navigation
pnpm cli users:create-admin --email superadmin@siacademy.example --name "Super Admin"
pnpm db:seed:demo    # sample data: admin/ops/placement/trainer/student accounts (optional)
```

Run everything:

```bash
pnpm dev             # web http://localhost:3000, API http://localhost:4000 (docs at /api/docs)
```

Sign in at http://localhost:3000/login with the Super Admin email and the password you set.

### Code execution: the sandbox runner

Learners' code never runs in the API, and is never judged in the browser (ADR-0016): a Web Lab's
preview only shows the learner's page, in a sandboxed frame (ADR-0019). `apps/runner` starts one
locked-down container per run, submission or web check from the sandbox image, so it needs Docker
and that image once:

```bash
docker build -t lms-sandbox:1 infra/sandbox    # again after editing infra/sandbox
```

The image's first stage installs the Web Lab's checker dependency (jsdom) with `npm ci` from
`infra/sandbox/web/package-lock.json`, so the build needs the npm registry once; the image that runs
learner code has no package manager. Rebuild it after pulling Roadmap Phase 1: the `web` runtime
and the SQL Lab's fix live in the image.

**Bringing an existing database up to Phase 1 (Labs).** Apply the migration, then run the sample-data seed
again. The migration only adds (enum values, two columns, the `lab_drafts` table). The seed adds
the debugging and web labs it can prove (`verified-runs.json`), two lab lessons and the new
permissions' role grants, and removes nothing; like every run of the sample-data seed it also refreshes
the sample data: the sample history's dates move to centre on today, recent classes are marked,
and the sample accounts are reset — password set again to `SEED_DEMO_PASSWORD`, unlocked, and their
sessions ended. Accounts outside the sample set, such as the Super Admin, are left alone. Back
the database up first if it holds anything you want to keep as it is.

```bash
pnpm --filter @lms/api db:migrate
pnpm --filter @lms/api db:seed:demo
```

Labs are a module (`module.practice`). A new institute starts with it off; SI Academy's
configuration (`clients/demo/flags.json`) turns it on, and an existing flag row keeps its value.

**Phase 2 (learner experience).** One additive migration
(`20261003090000_phase2_learner_experience`): watch time on lesson progress, the `withdrawn`
enrolment status, late answers, the certificates table, and practice lessons moved to the `pass`
rule. `pnpm --filter @lms/api db:migrate` applies it; nothing needs re-seeding. Certificates are a
module (`module.certificates`), off for a new institute: the base seed (`pnpm --filter @lms/api
db:seed`) turns it on for SI Academy when the flag row does not exist yet. If the API has already
started on that database (which creates the row switched off), turn it on in Settings › Feature
flags instead. Certificates are issued as learners complete courses, and on the five-minute sweep
for completions already recorded.

`pnpm env:init` writes one random `RUNNER_TOKEN` into both `apps/api/.env` and `apps/runner/.env`
when both are empty; otherwise put the same value (32+ characters) in both by hand. `pnpm dev`
then starts the runner with everything else, and the API reaches it at `RUNNER_URL`
(`http://127.0.0.1:4100`). Settings › System health shows whether the sandbox answers. With
`EXECUTION_DRIVER=none` nothing runs and coding answers wait for a trainer.

To prove the question bank after editing content: `pnpm --filter @lms/api verify:questions`
(add `-- --write` to save the outcomes the seed relies on).

| Service                               | URL                            |
| ------------------------------------- | ------------------------------ |
| Web                                   | http://localhost:3000          |
| API + OpenAPI UI                      | http://localhost:4000/api/docs |
| Mailpit (all outgoing email)          | http://localhost:8025          |
| MinIO console                         | http://localhost:9001          |
| Adminer (optional, `--profile tools`) | http://localhost:8080          |

## 3. Everyday commands

| Task                                        | Command                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Stop services (data kept)                   | `pnpm services:down`                                                                         |
| Service logs                                | `pnpm services:logs`                                                                         |
| New migration after editing `schema.prisma` | `pnpm db:migrate:dev --name <change>`                                                        |
| Regenerate the Prisma client                | `pnpm --filter @lms/api db:generate`                                                         |
| Reset the local sample database             | `pnpm demo:reset` — drops the schema, migrates, seeds base + demo, recreates the Super Admin |
| Lint / types / unit tests                   | `pnpm lint`, `pnpm typecheck`, `pnpm test`                                                   |
| API tests against `lms_test`                | `pnpm --filter @lms/api test:e2e` (see testing.md)                                           |
| Separate worker process                     | `pnpm --filter @lms/worker worker:dev` with `WORKER_MODE=separate`                           |

## 4. Troubleshooting

| Symptom                                      | Cause and fix                                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P1000` authentication failed from Prisma    | Another PostgreSQL answers on the port. Use 5433 (default) or change `POSTGRES_PORT` and `DATABASE_URL` together.                                                 |
| `pull access denied` for MinIO images        | MinIO no longer publishes images; Compose uses Chainguard's build, `cgr.dev/chainguard/minio` (ADR-0017). Remove any override still naming `quay.io/minio`.       |
| `permission denied` from MinIO on `/data`    | A volume the old image wrote belongs to root; `minio-volume` hands it to MinIO's user. Start the stack with `pnpm services:up`, not `minio` alone.                |
| Login fails right after `users:create-admin` | The password in `.env` contained `#`; everything after it was dropped. Choose a password without `#` and run the CLI again.                                       |
| Web shows "Could not reach the server"       | API not running or `NEXT_PUBLIC_API_URL` wrong; check http://localhost:4000/health/live.                                                                          |
| "Code cannot be run right now" on Run        | The runner is not running, or its token differs from the API's. Check `RUNNER_TOKEN` in both `.env` files and that `docker image inspect lms-sandbox:1` succeeds. |
| Seed refuses to run                          | `APP_ENV=production` blocks seeding unless `LMS_ALLOW_PRODUCTION_SEED=1` (base seed of a new deployment only).                                                    |
