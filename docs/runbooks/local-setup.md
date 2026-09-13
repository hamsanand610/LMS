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
- `SEED_DEMO_PASSWORD`: optional; the password shared by all demo accounts. Leave empty to have the
  demo seed generate and print one.
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
pnpm cli users:create-admin --email superadmin@demo.local --name "Super Admin"
pnpm db:seed:demo    # admin/ops/placement/trainer/student demo accounts (optional)
```

Run everything:

```bash
pnpm dev             # web http://localhost:3000, API http://localhost:4000 (docs at /api/docs)
```

Sign in at http://localhost:3000/login with the Super Admin email and the password you set.

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
| Reset the demo database (local only)        | `pnpm demo:reset` — drops the schema, migrates, seeds base + demo, recreates the Super Admin |
| Lint / types / unit tests                   | `pnpm lint`, `pnpm typecheck`, `pnpm test`                                                   |
| API tests against `lms_test`                | `pnpm --filter @lms/api test:e2e` (see testing.md)                                           |
| Separate worker process                     | `pnpm --filter @lms/worker worker:dev` with `WORKER_MODE=separate`                           |

## 4. Troubleshooting

| Symptom                                      | Cause and fix                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `P1000` authentication failed from Prisma    | Another PostgreSQL answers on the port. Use 5433 (default) or change `POSTGRES_PORT` and `DATABASE_URL` together.           |
| `pull access denied` for MinIO images        | The Compose file uses `quay.io/minio/minio` and `quay.io/minio/mc`; make sure no override points at Docker Hub.             |
| Login fails right after `users:create-admin` | The password in `.env` contained `#`; everything after it was dropped. Choose a password without `#` and run the CLI again. |
| Web shows "Could not reach the server"       | API not running or `NEXT_PUBLIC_API_URL` wrong; check http://localhost:4000/health/live.                                    |
| Seed refuses to run                          | `APP_ENV=production` blocks seeding unless `LMS_ALLOW_PRODUCTION_SEED=1` (base seed of a new deployment only).              |
