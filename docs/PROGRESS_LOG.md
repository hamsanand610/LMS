# Development progress log

One entry per working session. Newest first. IDs refer to the master report (F-/P-/Q-), the architecture plan (M-/DP-/J-/D-/DQ-) and the backlog (BL-).

## 2026-09-13 (session 2) — Phase 1 (Foundation) complete; gate reached

**Delivered (architecture plan §24.1, Phase 1 deliverables).**

- Monorepo (pnpm 11 + Turborepo), Compose stack (PostgreSQL 16 on host port 5433, MinIO from quay.io, Mailpit, Adminer profile), root and app `.env.example` files, `scripts/env-init.mjs`.
- Environment validation at boot (`apps/api/src/core/config/env.ts`, Zod; production refuses insecure cookies and placeholder secrets).
- Prisma 7 baseline migration `20260913140206_init_foundation`: organizations, users, invitations, password resets, sessions, roles, permissions, role permissions, user roles, settings, branding settings, feature flags, navigation configs, audit logs, files.
- Authentication (ADR-0003): Argon2id, 15-minute access JWT in an httpOnly cookie or Bearer header, rotating refresh tokens with family reuse detection, double-submit CSRF, lockout after 5 failures, invitations and password resets as hashed single-use tokens, sessions list/revoke, logout-all.
- RBAC (ADR-0004): permission catalogue from module manifests, system role bundles, scopes `all|batch|own`, deny-by-default guard, module-enabled guard, 60-second auth context cache.
- Module registry (manifests → permissions, navigation defaults, flag defaults; catalogue synced at boot), foundation modules `settings`, `auth`, `rbac`, `users` (+ `/me`), `audit`, `files`, `health`, each with a README.
- Core services: pino logging with request ids and redaction, RFC 9457 problem responses, request context, audit service, tenant service, pg-boss queue with embedded workers, S3 storage driver with presigned uploads and MIME sniffing, SMTP/noop email drivers with branded templates, in-repo rate limiting.
- Shared package: schemas (auth, settings, branding, flags, navigation, common), permission catalogue, roles, error codes, `/me` contract, time utilities, theme derivation with WCAG contrast validation.
- Web shell (Next.js 16, shadcn `radix-vega`, Tailwind 4): branding injected server-side as CSS variables for light and dark schemes, theme toggle (system/light/dark), portal layouts with navigation from `/me`, user menu, mobile navigation, environment banner, typed API client with CSRF header and one silent refresh, server-side portal guards.
- Pages: sign in (with silent session restore from the refresh cookie), forgot/reset password, accept invitation, sign out, 403/404/error, admin home, users (list, filters, invite, roles, deactivate/reactivate, resend invitation), general settings, branding (live preview, contrast check, logo/favicon/background uploads), feature flags, navigation editor, roles and permissions matrix (create/clone roles, per-role save), audit log (filters, before/after viewer), system health, my account (name, password, devices), trainer and student placeholders (wireframes).
- Seeds and CLI: base seed with client overlay (`clients/demo`), Super Admin CLI, demo accounts seed (§21.1 people: admin, ops, placement, 8 trainers, 60 students), `demo:reset`.
- Worker entry (`apps/api/src/worker.ts`, `apps/worker`), CI workflow (`.github/workflows/ci.yml`), husky hooks (pre-commit Prettier, commit-msg commitlint, pre-push type-check + unit tests), runbooks (local setup, testing, page checklist), ADR-0001…0008, `docs/STACK.md`.

**Tests run (operating rule 28), all on the development machine, 13 September 2026.**

| Suite                                                                                                                        | Command                                                                                | Result                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Shared unit (schemas, token derivation/contrast for 10 sample brand colours, time)                                           | `pnpm --filter @lms/shared test`                                                       | 3 files, 26 tests passed                            |
| API unit (env contract, passwords/tokens, pagination, MIME sniffing, rate-limit store)                                       | `pnpm --filter @lms/api test`                                                          | 5 files, 22 tests passed                            |
| API integration against `lms_test` (route table, authentication, permission matrix for four roles, branding/settings/health) | `pnpm --filter @lms/api test:e2e`                                                      | 4 files, 28 tests passed (36 s)                     |
| Web unit (portal helpers)                                                                                                    | `pnpm --filter @lms/web test`                                                          | 1 file, 3 tests passed                              |
| Browser smoke, Chromium (redirect to sign-in, Super Admin sign-in → dashboard → settings → sign-out, wrong credentials)      | `pnpm --filter @lms/web test:e2e --project=chromium`                                   | 3 tests passed (see session note below)             |
| Lint / type-check                                                                                                            | `pnpm lint`, `pnpm typecheck` (per package: eslint `--max-warnings=0`, `tsc --noEmit`) | clean for `apps/api`, `apps/web`, `packages/shared` |

Manual browser verification (Claude in-app browser, viewport 553×616): sign-in as Super Admin, admin dashboard, general settings, branding, feature flags, navigation, roles matrix, audit log (5 rows from this session), system health (database/storage/email OK), users list, my account — all render with data from the API; dark theme resolved from the system preference.

**Phase 1 exit criteria (plan §24.1).**

| Criterion                                | Evidence                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New developer runs the stack in < 1 hour | `docs/runbooks/local-setup.md`; quick start is seven commands; ports and pitfalls documented                                                                                               |
| Login works for four roles               | `test/permissions.e2e-spec.ts` signs in Super Admin, Admin, Trainer and Student and checks home portals (`admin`, `admin`, `trainer`, `student`); Super Admin also verified in the browser |
| Branding changes re-theme                | `test/settings.e2e-spec.ts`: PATCH primary colour → new derived tokens, version bump, public branding and audit row; web injects tokens on every request (no cache)                        |
| Route-table test passes                  | `test/route-table.e2e-spec.ts`: 40+ routes, each public or permission-declared, permissions exist in the catalogue, protected GETs answer 401                                              |

**Fixes made during verification.**

- shadcn-generated components imported `cn` from an npm package instead of `@/lib/utils`; class names aligned with shadcn conventions (`text-muted-foreground` etc.).
- React Compiler lint rules: hoisted a component created during render, replaced `setState`-in-effect patterns (theme toggle now uses `useSyncExternalStore`; navigation editor remounts on fresh data), switched forms to `useWatch`.
- `/me` reported no portals for students and trainers (no navigation items yet in Phase 1) → portals now derive from roles as well; `POST /branding/preview` answered 201 → 200.
- Shared `emailSchema` now trims and lower-cases before validating, so a trailing space cannot block a sign-in.
- ESLint for the API: `@typescript-eslint/consistent-type-imports` needs the `emitDecoratorMetadata` parser option, otherwise auto-fix would break Nest dependency injection; shared config package now declares its runtime dependencies.
- Removed `vite-tsconfig-paths` (Vite resolves `tsconfig` paths natively) and `@nestjs/throttler` (no Nest 12 peer range; replaced by the in-repo guard) — recorded in `docs/STACK.md`.
- Login page restores a session silently when the access token expired but the refresh cookie is valid (the refresh cookie is scoped to `/api/v1/auth`, so server components cannot see it).

**Assumptions and deviations (stated, not invented).**

- Demo password (§21.2): outside local the seed requires `SEED_DEMO_PASSWORD`; locally, when unset, it generates a random password and prints it once instead of using a documented fixed value, because operating rule 9 forbids credentials in the repository or docs. The runbook tells presenters to set the variable.
- Phase 1 has only core (locked) modules, so the Feature flags page shows an explained empty state until Phase 2 modules add flags.
- Trainer and student home pages are temporary wireframes (labelled in `docs/runbooks/page-checklist.md`); their content arrives with Phases 2–3.
- `docs/source-materials/` (client WhatsApp screenshots) is kept out of version control because the images may contain personal data.
- CI has not run yet: the repository has no remote. The workflow is written to the plan (§23.2) and will be verified on the first push.

**Session note (rate limiting during verification).** The login route allows 5 attempts per 15 minutes per IP and email; repeated manual and automated sign-ins during verification hit that limit once, which is the intended behaviour. Test suites keep sign-ins per file below the limit and boot their own application instance.

**Next (needs approval — operating rule 42).** Phase 2 (Admin foundation): students, trainers, programmes, batches, notifications, announcements, audit viewer polish, basic search; journeys J-01 and J-02.

## 2026-09-13 — Phase 1 (Foundation) started

**Approval recorded.** Client approved: monorepo with modular monolith; separate web, API and optional worker; PostgreSQL; Docker Compose local environment; one deployment and database per client; configuration and feature flags first, extension modules only when necessary; code execution through an external/isolated adapter, never inside the API; staging Option A (VM); AI, advanced labs, placement, certificates and gamification deferred to future phases. Instruction given to start implementing per the documents and to ask before inventing anything unclear.

**Environment verified on the development machine.** Node 22.22.1, pnpm 11.15.1, Git 2.53, Docker 29.7.2 with Compose v5.4.0 (Docker Desktop installed per-user; daemon started during this session). Windows 11.

**Version pins decided at setup (recorded in docs/STACK.md).** Next.js 16.3.5, React 19.2.8, NestJS 12.0.1 (CLI 12.0.0), Prisma 7.10.0 (the npm `latest` tag is an 8.0 release candidate, so the 7.x line is pinned explicitly as per D-04), Tailwind CSS 4.3.3, Zod 4.6.4, pg-boss 12.31.0, TypeScript 6.0.3 (the Nest 12 generator targets TypeScript 6; every dependency in use accepts it, so it is used workspace-wide instead of 5.9), Vitest 4.1.11, Playwright 1.63.0, Turborepo 2.10.12.

**Done.** Repository initialised (`git init`, branch `main`); workspace root files; Nest and Next apps scaffolded with their official generators (`@nestjs/cli@12 new`, `create-next-app@16.3.5`); nested workspace file removed from the web app; package manifests for `apps/api`, `apps/web`, `packages/config`, `packages/shared`, `packages/module-sdk`, `packages/ui`; `infra/compose.yml` (postgres, minio + bucket init, mailpit, adminer profile); `.env.example` files for root, API and web; Prettier, commitlint, editor config; `scripts/env-init.mjs`.

**Assumptions (not inventions; defaults from the approved documents).** Product codename "LMS" and package scope `@lms/*` until a product name is given (Q-01); demo brand "Demo Institute" (DQ-05); pg-boss as queue default (DQ-03); repository private (DQ-08); overlays inside the template repository (DQ-10).

**Next.** Install dependencies; Prisma baseline schema and first migration; core (config, logging, errors, guards, audit, queue, events, storage, email adapters); modules auth, rbac, users (me), settings/branding/flags/navigation, audit, health, files; web shell with theme injection and auth pages; seeds and CLI; tests; CI workflow; ADRs; runbooks.
