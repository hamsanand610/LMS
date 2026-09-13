## 19. Security and Privacy Plan

### 19.1 Minimum baseline for the local demo and free staging

The master security plan (§16) applies in full to production. For the demo and staging the following baseline is **mandatory from Phase 1**, because it is far cheaper to build in than to retrofit.

| Area | Baseline |
|---|---|
| Password hashing | Argon2id with tuned parameters; minimum 10 characters; common-password deny list |
| Session/token security | Access JWT 15 min (signed with a key from the environment, `kid` rotation supported); refresh token 30 days, rotated on every use, stored hashed, reuse detection revokes the family; httpOnly, Secure (staging over HTTPS), SameSite=Lax cookies; logout-all on password/role change or deactivation |
| Role-based authorisation | Permission + scope guard on every endpoint; route-table test fails CI if a route lacks a declaration; matrix tests for all demo roles |
| Permission checks | Service-level scope filters (trainers by batch, students by self); sensitive fields gated by `students:read_sensitive`; UI hides but never authorises |
| Input validation | Zod at HTTP, jobs, imports and environment; size limits; strict enums; rich text sanitised server-side with an allow-list |
| SQL injection | Prisma parameterised queries; raw SQL only through tagged templates in `reports`; app database role without DDL |
| XSS | React escaping; sanitised rich text; strict CSP with nonces (no inline scripts), `frame-src` limited to the app and configured video providers; Web Lab/execution iframes sandboxed at an opaque origin |
| CSRF | SameSite cookies plus `X-CSRF-Token` double-submit on cookie-authenticated mutations; Origin check on WebSocket/SSE |
| Secure file uploads | Presigned uploads to private buckets; MIME sniffing on completion; per-context type/size limits; filename sanitisation; no execution of uploads; images re-encoded; PDFs served as attachments |
| Rate limiting | Login 5/15 min per account and 20/15 min per IP; OTP (future) 3/15 min; general 600/5 min per user; execution and submission quotas; in-memory store (single instance) with a PostgreSQL store available |
| Audit logging | Interceptor writes before/after for mutations of users, roles, students (sensitive), batches, publications, attendance, grades, settings, branding, flags, exports; append-only table; viewer for Super Admin |
| Secret management | Secrets only in environment variables or the host's secret store; `.env` ignored by Git; `.env.example` has placeholders; integration secrets encrypted at rest with a key from the environment; never logged or returned |
| Environment separation | `APP_ENV` = local / staging / production; demo seeds, reset commands and API docs are disabled in production by code; staging shows an environment banner |
| CORS | Allow-list of the web origin(s); credentials allowed only for those; no wildcard |
| Error response safety | problem+json without stack traces outside local; request IDs; generic auth errors |
| Backups (staging) | Nightly `pg_dump` to R2 for Option A; Neon retains its own history on free tiers (verify); demo data is reproducible from seeds so loss is tolerable |
| Data privacy | **Synthetic data only** in demo and staging; no real student records; consent text and privacy page present; erasure/anonymisation job implemented for the template even if unused in demo |
| Student data protection | Sensitive fields gated and encrypted-at-rest by the database/storage provider; documents private; download audit; leaderboards/ranks off by default |
| Admin access protection | Separate Super Admin role; first admin created by CLI; strong password policy; optional TOTP two-factor for staff prepared as a flag (Standard tier); session list and revocation; impersonation not in demo |
| Dependencies | Lockfile; `pnpm audit` and CodeQL in CI; Renovate weekly |
| Infrastructure (Option A VM) | Firewall 22/80/443 only; SSH keys; automatic security updates; non-root containers; Caddy TLS; Docker socket not exposed |

### 19.2 Code execution statement

Code execution is **limited to a safe prototype in the demo and is implemented through an isolated service where available**:

- The `browser-sandbox` driver runs student JavaScript inside a sandboxed iframe at an opaque origin (no cookies, storage or parent access) using a Web Worker with a watchdog timeout, and Python through Pyodide (WebAssembly) in the same sandbox. Nothing is executed on the server. Results are stored with `trust = untrusted` and shown with a "verified in browser" badge; they are suitable for practice and demonstrations, not for high-stakes grading.
- The `judge0` driver sends code to a Judge0 CE instance running as a **separate service** (Docker Compose profile on a Linux host, or a dedicated VM in production) over a private network; results are `trusted`.
- The API process never compiles, evaluates or spawns student code. This is enforced by code review, by the absence of any execution library in `apps/api`, and by a test that asserts the `browser-sandbox` driver performs no server-side execution.

### 19.3 Privacy notes for demonstrations

Demo accounts use fictional names and `@demo.local` addresses; screenshots and recordings of the demo therefore contain no personal data; the reference portal's data is never reproduced.

---

## 20. Repository and Folder Structure

### 20.1 Proposed tree

```
lms-platform/
├── apps/
│   ├── web/                          # Next.js 16 application (all portals)
│   │   ├── src/app/
│   │   │   ├── (public)/             # landing, content pages, 403/404/500
│   │   │   ├── (auth)/               # login, invite, forgot, reset
│   │   │   ├── (student)/            # /dashboard, /courses, /assignments, /tests, /practice, /progress, /profile, /schedule, /notifications
│   │   │   ├── (trainer)/trainer/    # trainer portal
│   │   │   ├── (admin)/admin/        # admin portal incl. settings
│   │   │   └── api/                  # only BFF helpers (auth cookie relay), no business logic
│   │   ├── src/modules/<key>/        # feature UI: pages, components, hooks, queries (mirrors API modules)
│   │   ├── src/shell/                # app shell, navigation renderer, theme provider, portal layouts
│   │   ├── src/lib/                  # api client (generated), auth helpers, formatting, feature-flag hooks
│   │   ├── public/                   # static assets incl. pyodide/ runtime, default fonts
│   │   ├── e2e/                      # Playwright journeys (J-01…J-12)
│   │   └── next.config.ts, tailwind.config.ts, .env.example
│   ├── api/                          # NestJS 12 application
│   │   ├── src/main.ts, app.module.ts
│   │   ├── src/core/                 # config (Zod env), prisma service, auth guards, permission guard, scope, audit interceptor, problem filter, logging, queue interface, event bus, tenant context, storage/video/email/execution adapters
│   │   ├── src/modules/<key>/        # manifest.ts, module.ts, controllers/, services/, repositories/, events/, jobs/, dto/, seeds/, tests/, README.md
│   │   ├── src/registry/             # module registry: manifests → permissions, navigation, routes, flags, settings sections
│   │   ├── prisma/schema.prisma, prisma/migrations/, prisma/seed/{base,demo}/
│   │   ├── test/                     # integration/API/contract tests, permission matrix generator
│   │   └── .env.example
│   └── worker/                       # thin entry point that boots the same modules in WORKER_MODE=separate
├── packages/
│   ├── shared/                       # Zod schemas, types, enums, permission catalogue types, event types, utils (IST dates, ids)
│   ├── ui/                           # design tokens, Tailwind preset, shadcn components, composites, theme utilities (contrast, token derivation)
│   ├── module-sdk/                   # manifest types, extension point interfaces, testing harness for modules and overlays
│   └── config/                       # eslint, prettier, tsconfig, tailwind base configs
├── clients/
│   ├── _template/                    # copy to start a new client overlay (README, schemas, examples)
│   └── demo/                         # the demo client overlay: branding.json, settings.json, flags.json, navigation.json, custom-fields.json, templates/, assets/, seeds/, extensions/ (empty)
├── infra/
│   ├── compose.yml                   # core services (postgres, minio, mailpit) + profiles (tools, judge0)
│   ├── compose.app.yml               # web/api/worker containers for image verification and VM staging
│   ├── caddy/Caddyfile               # staging TLS/reverse proxy
│   ├── docker/                       # Dockerfiles (web, api, worker) with multi-stage builds
│   └── scripts/                      # deploy.sh (VM), backup.sh (pg_dump → R2), reset-demo.sh
├── docs/
│   ├── PLANNING_REPORT.md            # master (unchanged)
│   ├── ARCHITECTURE_DEMO_TEMPLATE_PLAN.md   # this document
│   ├── adr/                          # architecture decision records
│   ├── modules/                      # one page per module (generated skeleton + hand-written details)
│   ├── runbooks/                     # local setup, staging deploy, backup/restore, demo script, client onboarding, upgrade
│   ├── PROGRESS_LOG.md, STACK.md, CLAUDE_OPERATING_RULES.md
│   └── source-materials/             # client screenshots
├── .github/workflows/                # ci.yml (lint, typecheck, test, build, migrate-check, e2e-smoke), deploy-staging.yml, release.yml
├── .husky/                           # pre-commit (lint-staged), commit-msg (commitlint)
├── CLAUDE.md                         # pointer to docs and operating rules for AI-assisted sessions
├── package.json, pnpm-workspace.yaml, turbo.json, .nvmrc, .gitattributes, .editorconfig, .env.example (root, compose)
└── README.md
```

### 20.2 Directory responsibilities

| Directory | Responsibility | Rules |
|---|---|---|
| `apps/web/src/app` | Routing and layouts only; pages import from `src/modules` | No data access outside the generated client; server components forward cookies |
| `apps/web/src/modules` | Feature UI mirrored on API modules | May depend on `packages/ui` and `packages/shared`; never on another module's internals except through exported hooks |
| `apps/web/src/shell` | Navigation renderer (from `/me`), theme injection, portal guards, error boundaries | Brand-neutral; tokens only |
| `apps/api/src/core` | Cross-cutting infrastructure and adapters | Adapters expose interfaces (`StorageDriver`, `VideoDriver`, `EmailDriver`, `ExecutionDriver`, `QueueDriver`, `CacheDriver`) with drivers selected by environment |
| `apps/api/src/modules` | Business logic per module | Follows the module contract; owns its tables (prefix-free but listed in manifest); communicates via services/events/jobs |
| `apps/api/src/registry` | Boot-time assembly of modules, flags, permissions, navigation | Single place that knows about all modules |
| `apps/api/prisma` | Schema, migrations, seeds | Migrations named `<timestamp>_<module>_<change>`; seeds idempotent |
| `apps/worker` | Separate process entry | Same code, different mode |
| `packages/shared` | Contracts | No runtime dependencies on Nest or React |
| `packages/ui` | Design system | No business logic; Storybook optional |
| `packages/module-sdk` | Extension contracts | Versioned with the template |
| `clients/<key>` | Overlay | Configuration validated by schemas; extensions must compile against the SDK only |
| `infra` | Runtime definitions | Same images for local verification, staging and production |
| `docs` | Knowledge base | ADRs numbered; runbooks maintained per phase; progress log per session |

### 20.3 Configuration and environment files

Root `.env.example` (compose ports and volumes); `apps/api/.env.example` (`APP_ENV`, `CLIENT_KEY`, `DATABASE_URL`, `JWT_*`, `STORAGE_DRIVER=s3|disk`, `S3_*`, `VIDEO_DRIVER=storage-file|youtube|bunny|cloudflare`, `EMAIL_DRIVER=smtp|resend`, `SMTP_*`, `EXECUTION_DRIVER=browser-sandbox|judge0`, `JUDGE0_URL`, `WORKER_MODE=embedded|separate`, `RATE_LIMIT_DRIVER=memory|postgres`, `CACHE_DRIVER=memory|postgres|redis`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD`); `apps/web/.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLIENT_KEY`). Every variable documented; a test keeps examples in sync with the Zod schema.

---

## 21. Demo Data and Seed Strategy

### 21.1 Demo dataset

| Entity | Count | Notes |
|---|---|---|
| Organisation | 1 | "Demo Institute", timezone Asia/Kolkata, brand seeds in `clients/demo/branding.json` |
| Super Admin | 1 | `superadmin@demo.local` |
| Admins | 2 | `admin@demo.local`, `ops@demo.local` |
| Trainers | 8 | `trainer1…8@demo.local`; subjects spread over Core Java, Advanced Java, SQL, HTML/CSS, JavaScript, Programming, Aptitude, Soft skills |
| Placement Coordinator (role only) | 1 | `placement@demo.local` (no portal in demo; used to show role configuration) |
| Students | 60 | `student01…60@demo.local`; fictional names; 20 per batch; varied progress, attendance and scores so charts look real |
| Programmes | 1 | Java Full-Stack (24 weeks) |
| Batches | 3 | `JFS-2026-B1` running (week 6), `JFS-2026-B2` planned (starts in 2 weeks), `JFS-2025-B4` completed |
| Courses | 6 | Programming Essentials, Core Java, SQL, HTML & CSS, JavaScript, Aptitude; 20 lessons each on average (video, article, resources, practice); short open-licensed sample videos (≤ 30 s, small files) |
| Questions | 120 | 80 MCQ, 10 true/false, 10 descriptive, 20 coding (JavaScript and Python starter/reference with 3 sample + 5 hidden tests each) |
| Assignments | 4 | Java Basics (3 modules, sequential unlock), SQL Fundamentals, HTML & CSS Practice, JavaScript Essentials; published to B1 with varied progress |
| Tests | 3 | Weekly Test 5 (released, results present), Weekly Test 6 (scheduled today, live window), Weekly Test 7 (upcoming) |
| Sessions | ≈ 60 | Two weeks of past sessions for B1 (with attendance) and two weeks ahead (scheduled); one session today at a time near the demo slot |
| Attendance | ≈ 1,200 | Realistic distribution (85% present, some late/excused); three students below threshold |
| Submissions | ≈ 2,000 | Across assignments and the released test; includes descriptive answers awaiting grading and a few coding submissions with each verdict type |
| Notifications / announcements | ≈ 500 / 3 | Unread items for the demo student; one scheduled announcement |
| Reports | — | Aggregates computed by the seed's final step so the dashboard is populated on first load |

### 21.2 Credentials policy

Demo passwords are **not stored in the repository**. The seed reads `SEED_DEMO_PASSWORD` (required outside local; in local it defaults to a documented value printed by the seed) and applies it to all demo accounts; `SEED_ADMIN_PASSWORD` is used for the Super Admin. The demo runbook lists the emails and instructs presenters to set the password before seeding. Real secrets (API keys) are never part of seeds.

### 21.3 Seed scripts and reset

`pnpm db:seed` (base) → `pnpm db:seed:demo` (demo) → `pnpm demo:reset` (drop, migrate, seed base + demo, clear buckets, recreate sample files) — guarded by `APP_ENV !== 'production'`. Seeds are idempotent (natural keys) and deterministic (fixed random seed) so screenshots stay consistent. A `demo:advance` command moves dates forward so "today" always contains a session and a live test.

### 21.4 Demo scenarios and sample metrics

- Dashboard on load: 60 students, 41 active (7 days), attendance 84%, completion 37%, assessment average 68%, assignment status 12 completed / 31 in progress / 17 not started.
- Student `student07@demo.local`: 3 courses in progress, one assignment at 60% with module 2 just unlocked, one graded test, one live test, one unread "results released" notification.
- Trainer `trainer1@demo.local`: session today at 10:00, 6 descriptive answers to grade, batch B1 attendance 84%, two at-risk students.

### 21.5 Demonstration flow (about 20 minutes)

1. Open the login page: point out brand name, logo and colours coming from settings.
2. Sign in as Super Admin; open Settings › Branding; change primary colour and logo; save; show the login page and dashboard re-themed without redeploy.
3. Settings › Feature flags: disable "Practice"; show the student navigation losing the item and the API returning "not enabled"; re-enable.
4. Settings › Roles: show the permission matrix; explain scopes.
5. Sign in as Admin: dashboard tiles and filters; drill into Attendance report; export XLSX; open the export notification.
6. Students: import the sample sheet (60 rows, 3 invalid) → error report → invitations in Mailpit.
7. Batches: open B1; show students, trainers, timetable (series), content publications; create a session series for B2.
8. Courses: open the builder; add a lesson; publish to B2.
9. Question bank: open a coding question; run validation; import MCQs from the sample sheet.
10. Tests: schedule Weekly Test 7 for B1; show monitor.
11. Sign in as Trainer: dashboard; mark attendance for today's session; grade two descriptive answers; publish an assignment to B1.
12. Sign in as Student (phone-sized viewport): dashboard "today" band; join button; continue learning.
13. Course player: resume position, resources, mark complete, inline practice.
14. Assignments: solve an MCQ, then a coding question in the browser sandbox (JavaScript), then Python; show verdicts and the trust badge; module 2 unlocks.
15. Tests: start the live test; answer; reload to show resume; submit.
16. Trainer releases results; student sees the notification and result page.
17. Practice: solve a problem from the catalogue.
18. Profile: completeness, resume upload, documents.
19. Admin: audit log showing the session's actions; system health page.
20. Close with the future modules list (flags off) and the client-overlay folder to explain white-labeling.

---
