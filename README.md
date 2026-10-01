# LMS Platform — reusable, white-label learning and placement platform template

Monorepo for the platform described in `docs/PLANNING_REPORT.md` (master product plan) and
`docs/ARCHITECTURE_DEMO_TEMPLATE_PLAN.md` (base architecture, local demo and white-label plan).
Phase status and session notes live in `docs/PROGRESS_LOG.md`.

## Layout

```
apps/web            Next.js application (student, trainer and admin portals)
apps/api            NestJS API (modular monolith; background jobs run embedded or in apps/worker)
apps/worker         Separate worker entry point (same modules, WORKER_MODE=separate)
packages/shared     Zod schemas, types, enums, permission catalogue, event types, theme derivation, utilities
packages/ui         Design tokens and fallback styles (shadcn primitives live in apps/web/src/components/ui, ADR-0008)
packages/module-sdk Module manifest contract and extension points
packages/config     Shared TypeScript / ESLint configuration
clients/<key>       Client overlays: branding, settings, flags, navigation (later: custom fields, templates, seeds, extensions)
infra               Docker Compose for local services and for staging, plus the Caddy reverse-proxy configuration
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
pnpm cli users:create-admin --email superadmin@demo.local --name "Super Admin"
pnpm db:seed:demo             # optional: demo people, one programme and three batches with rosters
pnpm dev                      # web on http://localhost:3000, API on http://localhost:4000
```

Mailpit UI: http://localhost:8025 · MinIO console: http://localhost:9001 · API docs: http://localhost:4000/api/docs

`pnpm demo:reset` (local only) drops the schema, migrates and re-seeds everything.
`pnpm --filter @lms/api demo:advance` moves the demo's dates so today has a class and an open test
window and brings every class's status up to the clock, without disturbing the attendance and
results already recorded.

## Checks and tests

```bash
pnpm lint && pnpm typecheck && pnpm test     # every package (unit level)
pnpm --filter @lms/api test:e2e              # API suite against a dedicated lms_test database
pnpm --filter @lms/web test:e2e              # Playwright journeys (needs E2E_* credentials)
pnpm --filter @lms/web exec playwright test --project=mobile   # the same journeys on a phone
```

Details in `docs/runbooks/testing.md`; the same checks run in `.github/workflows/ci.yml`.
Git hooks (husky): Prettier on commit, Conventional Commits message check, type-check and unit tests on push.

## Putting it somewhere people can reach it

`docs/runbooks/staging.md` covers the whole of it: one VM, the images CI publishes, HTTPS that
Caddy obtains for itself, the monitor, and the twenty-minute demonstration script. Staging holds
demonstration data only, never a real institute's records.

## What is in the demo, and what is not

Every module of the plan's §12.2 is built. Six of the fifteen management metrics, and the pages
behind them, belong to modules that are deliberately out of the demo (projects, certificates,
placement, feedback, and the labs): the platform names them and says which module would supply
them, rather than showing a figure nobody could stand behind. `docs/runbooks/page-checklist.md`
lists all eighty pages and the state of each.

## Working rules

All development follows `docs/CLAUDE_OPERATING_RULES.md`. Decisions are recorded in `docs/adr/`,
progress in `docs/PROGRESS_LOG.md`, version pins in `docs/STACK.md`, module behaviour in each
`apps/api/src/modules/<module>/README.md`.
