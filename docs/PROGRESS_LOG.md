# Development progress log

One entry per working session. Newest first. IDs refer to the master report (F-/P-/Q-), the architecture plan (M-/DP-/J-/D-/DQ-) and the backlog (BL-).

## 2026-09-13 — Phase 1 (Foundation) started

**Approval recorded.** Client approved: monorepo with modular monolith; separate web, API and optional worker; PostgreSQL; Docker Compose local environment; one deployment and database per client; configuration and feature flags first, extension modules only when necessary; code execution through an external/isolated adapter, never inside the API; staging Option A (VM); AI, advanced labs, placement, certificates and gamification deferred to future phases. Instruction given to start implementing per the documents and to ask before inventing anything unclear.

**Environment verified on the development machine.** Node 22.22.1, pnpm 11.15.1, Git 2.53, Docker 29.7.2 with Compose v5.4.0 (Docker Desktop installed per-user; daemon started during this session). Windows 11.

**Version pins decided at setup (recorded in docs/STACK.md).** Next.js 16.3.5, React 19.2.8, NestJS 12.0.1 (CLI 12.0.0), Prisma 7.10.0 (the npm `latest` tag is an 8.0 release candidate, so the 7.x line is pinned explicitly as per D-04), Tailwind CSS 4.3.3, Zod 4.6.4, pg-boss 12.31.0, TypeScript 6.0.3 (the Nest 12 generator targets TypeScript 6; every dependency in use accepts it, so it is used workspace-wide instead of 5.9), Vitest 4.1.11, Playwright 1.63.0, Turborepo 2.10.12.

**Done.** Repository initialised (`git init`, branch `main`); workspace root files; Nest and Next apps scaffolded with their official generators (`@nestjs/cli@12 new`, `create-next-app@16.3.5`); nested workspace file removed from the web app; package manifests for `apps/api`, `apps/web`, `packages/config`, `packages/shared`, `packages/module-sdk`, `packages/ui`; `infra/compose.yml` (postgres, minio + bucket init, mailpit, adminer profile); `.env.example` files for root, API and web; Prettier, commitlint, editor config; `scripts/env-init.mjs`.

**Assumptions (not inventions; defaults from the approved documents).** Product codename "LMS" and package scope `@lms/*` until a product name is given (Q-01); demo brand "Demo Institute" (DQ-05); pg-boss as queue default (DQ-03); repository private (DQ-08); overlays inside the template repository (DQ-10).

**Next.** Install dependencies; Prisma baseline schema and first migration; core (config, logging, errors, guards, audit, queue, events, storage, email adapters); modules auth, rbac, users (me), settings/branding/flags/navigation, audit, health, files; web shell with theme injection and auth pages; seeds and CLI; tests; CI workflow; ADRs; runbooks.
