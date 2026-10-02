# SI Academy — Enterprise Learning Management & AI Learning Platform

Monorepo for SI Academy: one platform for students, trainers, administrators and system operators,
covering courses, practice in a secure code sandbox, assignments, tests, attendance, progress,
reports, placement, and, in later phases, an AI Learning Agent grounded in the platform's own
content.

- Product direction: `docs/product/PRODUCT_DIRECTION.md`
- **Active roadmap (controlling plan): `docs/ROADMAP.md`**, current phase and gates
- Where the implementation stands against it: `docs/product/IMPLEMENTATION_ROADMAP.md`
- Architecture: `docs/architecture/OVERVIEW.md`, AI layer `docs/architecture/AI_ARCHITECTURE.md`
- Session notes: `docs/PROGRESS_LOG.md`

`docs/PLANNING_REPORT.md` and `docs/ARCHITECTURE_DEMO_TEMPLATE_PLAN.md` are the original plans of
September 2026, kept as historical records.

## Layout

```
apps/web            Next.js application (student, trainer and admin portals)
apps/api            NestJS API (modular monolith; background jobs run embedded or in apps/worker)
apps/worker         Separate worker entry point (same modules, WORKER_MODE=separate)
apps/runner         Sandbox runner: one locked-down container per learner job (ADR-0016)
packages/shared     Zod schemas, types, enums, permission catalogue, event types, theme derivation, utilities
packages/ui         Design tokens and fallback styles (shadcn primitives live in apps/web/src/components/ui, ADR-0008)
packages/module-sdk Module manifest contract and extension points
packages/config     Shared TypeScript / ESLint configuration
clients/<key>       Institute configuration: branding, settings, flags, navigation, sample data (SI Academy: clients/demo)
infra               Docker Compose for local services and for staging, the Caddy configuration and the sandbox image
docs                Reports, ADRs, runbooks, progress log, stack pins
```

## Prerequisites

Node.js 22 (see `.nvmrc`), pnpm 11 (`corepack enable`), Docker Engine with Compose v2 (Docker
Desktop is free for individuals and businesses under 250 employees and USD 10M revenue; Rancher
Desktop or Podman Desktop also work), Git. Full instructions and troubleshooting:
`docs/runbooks/local-setup.md`.

## Quick start (local)

```bash
pnpm install
pnpm env:init                 # creates .env files from the examples (never overwrites)
#   then set SEED_ADMIN_PASSWORD in apps/api/.env (10+ characters, no "#")
pnpm services:up              # PostgreSQL (host port 5433), MinIO (buckets created), Mailpit
pnpm db:migrate               # applies migrations
pnpm db:seed                  # organisation, roles, permissions, settings, branding, flags, navigation
pnpm cli users:create-admin --email superadmin@siacademy.example --name "Super Admin"
pnpm db:seed:demo             # optional: SI Academy sample data (people, programme, batches, content)
pnpm dev                      # web on http://localhost:3000, API on http://localhost:4000
```

Mailpit UI: http://localhost:8025 · MinIO console: http://localhost:9001 · API docs: http://localhost:4000/api/docs

`pnpm demo:reset` (local only) drops the schema, migrates and re-seeds everything.
`pnpm --filter @lms/api demo:advance` moves the sample data's dates so today has a class and an open
test window and brings every class's status up to the clock, without disturbing the attendance and
results already recorded. (The "demo" in these tooling names is renamed in Roadmap Phase 12.)

## Checks and tests

```bash
pnpm lint && pnpm typecheck && pnpm test     # every package (unit level)
pnpm --filter @lms/api test:e2e              # API suite against a dedicated lms_test database
pnpm --filter @lms/web test:e2e              # Playwright journeys (needs E2E_* credentials)
pnpm --filter @lms/web exec playwright test --project=mobile   # the same journeys on a phone
```

Details in `docs/runbooks/testing.md`; the same checks run in `.github/workflows/ci.yml`.
Git hooks (husky): Prettier on commit, Conventional Commits message check, type-check and unit tests on push.

## Staging

Staging is Roadmap Phase 14, after every earlier phase has passed. `docs/runbooks/staging.md`
describes the deployment: one VM, the images CI publishes, HTTPS that Caddy obtains for itself, and
the monitor. Staging holds sample data only, never a real learner's record.

## Where the product stands

What is built, partial or missing, by capability and by roadmap phase, with evidence:
`docs/product/IMPLEMENTATION_ROADMAP.md`. Metrics whose source module does not exist yet say so
rather than showing a figure nobody could stand behind.

## Working rules

All development follows `docs/ROADMAP.md` and `docs/CLAUDE_OPERATING_RULES.md`. Decisions are recorded in `docs/adr/`,
progress in `docs/PROGRESS_LOG.md`, version pins in `docs/STACK.md`, module behaviour in each
`apps/api/src/modules/<module>/README.md`.
