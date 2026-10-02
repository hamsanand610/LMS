# Reusable Educational Learning Platform — Base Architecture, Local Demo Environment and White-Label Template Plan

> **Status note, 2 October 2026 — historical document.** The client approved this plan on 13 September 2026 (recorded in `docs/PROGRESS_LOG.md`); it guided foundation phases 1–6 and client Tasks 1–4. On 2 October 2026 the client reset the product direction: SI Academy is an enterprise learning management and AI learning platform, not a demo or a white-label template. The controlling plan is now `docs/ROADMAP.md`, and the direction is set out in `docs/product/PRODUCT_DIRECTION.md`. This plan's demo scope (§12) and roadmap (§24) are superseded, and its folder tree (§20) predates the sandbox runner (`docs/architecture/OVERVIEW.md` describes the repository as it is). Its architecture decisions (§28, as carried by the ADRs in `docs/adr/`) remain in force unless an ADR amends them. Nothing below this note has been changed.

| Field | Value |
|---|---|
| Document | Architecture, local-demo and white-label template plan (companion to the master planning report) |
| Master reference | `docs/PLANNING_REPORT.md` — *Learning & Placement Platform — Requirements, Architecture and Implementation Planning Report*, draft 0.1, 13 September 2026 (unchanged) |
| Document version | 0.1 — Draft for review (Workflow Step 4) |
| Date | 13 September 2026 |
| Prepared by | Solution architecture team (AI-assisted, Claude Fable 5.1) |
| Status | **DRAFT — awaiting comments (Step 5).** No code has been written. Nothing here is an approved decision until §28 is signed. |

> **How this document relates to the master report.** The master report defines the long-term product: vision, full feature catalogue (F-01…F-28), roles, page inventory, feature specifications, coding-lab analysis, UI/UX strategy, stack research, architecture, preliminary database and API design, security, testing, deployment, roadmap (MVP → Standard → Advanced), costs, risks, open questions (Q-01…Q-31) and the Claude operating rules. This document does not replace it. It takes the master as the destination and defines the **reusable base template** and the **first complete local demo** that lead to it, plus the **white-label mechanisms** that let the same template serve several clients. Identifiers from the master (`F-`, `P-`, `E-`, `Q-`) are reused; new identifiers introduced here are `M-` (template module), `DP-` (demo page), `J-` (journey), `D-` (decision), `DR-` (demo risk).

## Table of contents

1. Executive Summary
2. Existing Report Preservation Statement
3. Product Vision and Reusable Template Strategy
4. Customer Expectation and Reference Analysis
5. Architecture Options Comparison
6. Recommended Base Architecture
7. Final Technology Stack Analysis
8. Local Development Environment
9. Free Staging Environment
10. External Services and Cost Boundaries
11. Reusable Module Structure
12. Demo Scope
13. User Roles and Permissions
14. Complete Page Inventory
15. Navigation and User Journeys
16. UI/UX and Design-System Plan
17. Database Architecture
18. API Architecture
19. Security and Privacy Plan
20. Repository and Folder Structure
21. Demo Data and Seed Strategy
22. White-Label Strategy
23. Testing and Quality Plan
24. Implementation Roadmap
25. Risks and Mitigation
26. Cost and Feasibility Analysis
27. Open Questions
28. Architecture Approval Checklist
29. Recommended Next Steps
- Appendix A. Sources verified for this document

---

## 1. Executive Summary

**Objective.** Turn the master product plan into one reusable educational-platform template that can be (a) built and demonstrated completely on a developer machine, (b) shown to prospective clients from a free staging environment, and (c) later branded, configured and extended per client without rebuilding. Coding does not start with this document; it starts only after the architecture is approved (§28) and the Step 9 artefacts exist.

**Recommended base architecture.** A **monorepo containing a modular monolith**: one web application (Next.js 16), one API (NestJS 12) whose feature modules follow a fixed module contract, a worker process that can run *embedded* in the API (demo and free staging) or *separately* (production), shared packages (schemas, UI kit, configuration), and a `clients/` overlay directory that holds each client's branding, configuration, custom fields, templates, seeds and optional extension modules. Code execution and AI stay outside the monolith as adapters to isolated services, exactly as the master requires; in the demo, code execution is a **safe browser-side prototype** plus an optional Judge0 container on Linux hosts, never execution inside the API.

**Stack lock (proposed).** TypeScript everywhere; Next.js 16 + Tailwind CSS 4 + shadcn/ui + TanStack Query/Table + React Hook Form + Zod + Recharts + TipTap + CodeMirror 6; NestJS 12 + Zod validation + own authentication (Argon2id, JWT + rotating refresh cookie) + permission guards + pino + OpenAPI; PostgreSQL 16+ with Prisma 7; **pg-boss** (PostgreSQL-backed job queue) as the default queue driver so the demo and free staging need no Redis, with Redis/BullMQ kept as the documented high-scale driver; S3-compatible file storage (MinIO locally, Cloudflare R2 free tier in staging); Mailpit for local email; Docker Compose for the whole local stack; GitHub Actions for CI. Every item is free or open source; the only paid items are client-owned production services (§10).

**Local demo.** Four roles (Super Admin, Admin, Trainer, Student), fourteen template modules fully wired end to end, about 75 pages, seeded demo data for one institute with three batches, and a scripted 20-minute demonstration. Placement Coordinator and Content Manager exist as seeded roles and data structures but their portals are deferred; Projects, Certificates, Placement, AI, gamification and labs are future phases exactly as in the master roadmap.

**Free staging.** Two documented options, both explicitly demo/staging grade: **Option A**, one free virtual machine (Oracle Cloud Always Free, now 2 OCPU / 12 GB Arm, subject to capacity and idle reclamation) running the same Docker Compose stack behind Caddy with a free subdomain; **Option B**, a free-tier combination (Cloudflare Workers or Vercel Hobby for the web app, Render free for the API in embedded-worker mode, Neon free PostgreSQL, Cloudflare R2 free storage, Resend free email, GitHub Actions, Sentry and UptimeRobot free tiers). Every limit, sleep behaviour and data-loss risk is tabulated in §9. Neither option is production.

**White-label.** Branding, theme tokens, navigation labels, enabled modules, roles, attendance and assessment rules, certificate and email templates, custom fields and optional integrations are configuration- or database-driven; genuinely new workflows are extension modules in the client overlay; one deployment (and one database) per client gives data isolation without multi-tenant complexity, while the schema keeps an `organizations` anchor so shared multi-tenancy can be added later if a hosted model is ever wanted.

**Effort.** Phases 0–6 of the demo roadmap are estimated at **12–16 weeks for two engineers** (longer for one). Costs for the local demo are zero beyond developer time; free staging is zero within tier limits; production costs are itemised and client-owned (§26).

**Decisions required.** Twenty-three architecture decisions are listed in §28 with recommendation, alternatives and the impact of changing later; nine open questions carried from the master remain relevant to the demo (§27).

---

## 2. Existing Report Preservation Statement

1. The master report (`docs/PLANNING_REPORT.md`, draft 0.1) remains the **master product vision and long-term roadmap**. It is not edited by this document. Its feature catalogue (F-01…F-28), tiers (MVP / Standard / Advanced / Future / Optional integrations), reference-portal observations (§5), UI/UX strategy (§11), technology research (§12), cost analysis (§20), deployment strategy (§18), security plan (§16), testing strategy (§17), roadmap (§19), risks and open questions (§20–21) and the Claude operating rules (§22) all stand.
2. This document **narrows, sequences and operationalises** the master for three purposes: a reusable base template, a first complete local demo, and white-label readiness. It does not remove any feature from the long-term vision; features not in the demo are marked *Future* with their master reference.
3. Five points are **refined** (not contradicted) because the demo must run on free infrastructure and a single developer machine. Each refinement keeps the master's production path intact and is listed as a decision in §28.

| # | Master statement | Refinement in this document | Why | Decision |
|---|---|---|---|---|
| R-1 | Redis + BullMQ for queues, cache, rate limits and sessions (master §12.3, §13.7) | A **queue interface** with **pg-boss** (PostgreSQL) as the default driver; Redis/BullMQ remains the documented driver for high-scale production. Cache and rate limits use in-process/PostgreSQL implementations behind the same interfaces. | Free staging options either have no worker processes (Render free) or count Redis commands (Upstash free 500K/month, and BullMQ's polling is not recommended there); one less service locally; the scale target (≤ 5,000 students) is well within pg-boss capacity. | D-08 |
| R-2 | Hosted video provider (Bunny/Cloudflare Stream) for playback (master §12.5) | Video **provider adapter** with a `storage-file` driver (MP4/HLS files in S3-compatible storage, signed URLs) for the demo; Bunny/Cloudflare drivers implemented when a client signs up for one. | Zero cost for the demo; adapter keeps the production path. | D-10 |
| R-3 | Self-hosted Judge0 on an isolated VM from MVP (master §10) | Demo ships an **execution adapter** with two drivers: `browser-sandbox` (JavaScript in a sandboxed iframe/worker, Python via Pyodide WebAssembly, results recorded as *untrusted*) and `judge0` (Docker Compose profile, Linux hosts only). Trusted server-side grading is enabled when a Judge0 host exists (production). | Judge0 needs a Linux host with specific kernel/cgroup settings; free Arm VMs cannot run its images; the demo must still show a coding workspace with real execution safely. | D-09 |
| R-4 | Single institute assumed (master A-02), no tenant model | **One deployment and one database per client** ("single-tenant per instance") with an `organizations` anchor table and tenant-ready conventions so shared multi-tenancy can be added without a rewrite. | White-label delivery with strong data isolation and per-client customisation; avoids premature multi-tenant complexity. | D-12 |
| R-5 | Production hosting on two VMs + managed PostgreSQL (master §18) | Unchanged for production; **staging is free-tier only** and is explicitly not production. | Requirement of this stage. | D-14 |

4. Where this document repeats master material (roles, pages, entities, APIs), it does so as the **demo subset** with the fields this brief asks for; the master remains authoritative for the full scope.

---

## 3. Product Vision and Reusable Template Strategy

### 3.1 Five layers, clearly separated

| Layer | Definition | Where specified |
|---|---|---|
| **1. Long-term product vision** | Everything in the master catalogue F-01…F-28 across MVP, Standard and Advanced tiers, plus future expansions. | Master §6–§9, §19 |
| **2. Reusable base template** | The stable core that every client deployment shares: the monorepo, the module contract, the fourteen common modules, the design system with theme tokens, configuration and flag systems, the overlay mechanism, migrations, seeds and tests. | This document §6, §11, §17–§22 |
| **3. Initial local demo** | The base template with fourteen modules fully wired, demo data and a demo script; runs on one machine and on free staging. | §12, §14, §21, §24 |
| **4. Client-specific customisations** | Branding, configuration, custom fields, templates, enabled modules, and optional extension modules in `clients/<client>/`; never forks of the core. | §22 |
| **5. Advanced features for later phases** | Labs (SQL/Web/Debug), Projects, Certificates, Placement management, AI assistant and interviews, gamification, advanced analytics, integrations. | Master §19 (Standard/Advanced), §24 here (future phases) |

### 3.2 Template principles

1. **One codebase, many deployments.** Clients are deployments of the same template at a pinned version, plus an overlay. No per-client forks.
2. **Configuration before code.** Anything a client is likely to change is data (settings, flags, labels, themes, templates, custom fields) before it is code.
3. **Modules are the unit of reuse.** Every feature is a module with a manifest (permissions, navigation, routes, settings, seeds, migrations, flags) and can be enabled or disabled per client.
4. **Stable contracts.** Module interfaces, the API conventions, the design tokens and the overlay contract change only with a version bump and a migration note.
5. **Isolation of risk.** Untrusted code execution and AI calls live behind adapters to external/isolated services; the core never depends on them to function.
6. **Free to run, cheap to scale.** The template runs on a laptop and on free tiers; production adds managed services through the same adapters.
7. **Demonstrable at every step.** Every page is complete only when wired end to end (§19 rule in the brief; §24 here).

### 3.3 Common base features (template core)

Authentication and sessions (F-01); roles and permissions (F-02); admin dashboard (F-19 core); user, student and trainer management (F-03, F-04); batch management (F-05); courses, modules and lessons with player (F-06, F-07); live schedule (F-08); learning progress (F-14); question bank, assignments and tests (F-09, F-10, F-11); attendance (F-13); reports and exports (F-19); notifications and announcements (F-20); student profile and resumes (F-21 core); coding-practice structure with the execution adapter (F-12 core); placement data structures and role (F-17 data model only, pages deferred); settings, branding, flags, audit (F-26); search (F-25 basic).

### 3.4 Client customisation matrix

| Customisable item | Mechanism | Where it lives | Requires code? |
|---|---|---|---|
| Logo, favicon, brand name, tagline | **Database-driven** branding settings (with initial values from the overlay) | `branding_settings` table; `clients/<client>/branding.json` seed; assets in `clients/<client>/assets/` | No |
| Brand colours, fonts, radius, density | **Theme-driven** design tokens generated from branding settings into CSS variables at runtime | `branding_settings.theme` (JSON validated by schema); token contract in `packages/ui` | No |
| Login page appearance (background image, welcome text, layout variant) | Database-driven settings + theme; layout variant is a **configuration** enum among supported variants | `branding_settings.login` | No (new variants = custom development) |
| Dashboard branding (welcome text, banner, links) | Database-driven | `branding_settings.dashboard`, `announcements` | No |
| Navigation labels and order | **Database-driven** navigation configuration merged over module defaults | `navigation_config` table; defaults from module manifests | No |
| Enabled / disabled modules | **Feature-flag / module-registry-driven** | `feature_flags` (module keys) evaluated by the registry at boot and per request | No |
| Course categories, levels, subjects, tags | Database-driven taxonomies | `taxonomies` and `taxonomy_terms` tables | No |
| User roles and permission bundles | Database-driven within the permission catalogue | `roles`, `role_permissions` (catalogue seeded from module manifests) | No (new *permissions* require code in a module) |
| Batch structure (modes, terms, capacity rules, naming) | Configuration + database | `settings` (academic section); batch fields; custom fields | No |
| Attendance rules (statuses counted, thresholds, correction window, capture method) | **Configuration-driven** rules validated by schema | `settings.attendance` | No |
| Assessment rules (attempt limits, negative marking, release policy, integrity options, grading scales) | Configuration-driven defaults plus per-test overrides | `settings.assessment`, test settings JSON | No |
| Certificate design | **Template-driven** (HTML template + variables + assets) | `certificate_templates` (future module) | No |
| Email and notification templates | **Template-driven** with variables and per-client overrides | `email_templates`, `notification_templates` | No |
| Custom fields on students, trainers, batches, courses | **Database-driven** custom field definitions and values | `custom_field_definitions`, `custom_field_values` (JSONB) | No |
| Custom pages (static content: policies, help, FAQ) | Database-driven content pages | `content_pages` | No |
| Client-specific workflows (approval steps, extra stages) | **Plugin/module-driven**: extension modules implementing hooks/events in the overlay | `clients/<client>/extensions/*` | Yes (isolated) |
| Additional reports | Configuration-driven report definitions (query template + columns + filters) for simple cases; extension module for complex ones | `report_definitions`; overlay | Sometimes |
| Optional integrations (video host, email provider, SMS, live-class API, AI) | **Configuration-driven** provider selection through adapters | `integration_configs` (encrypted secrets) | No for supported providers; yes for new providers (adapter) |
| Locale, timezone, date formats, currency | Configuration-driven | `settings.locale` | No |
| Terms, privacy text, consent wording | Database-driven content | `content_pages`, `settings.legal` | No |
| Domain, TLS, environment sizing | **Deployment configuration** | `infra/` compose files and environment variables per client | No |

Items requiring **custom development** are limited to: new question types, new integrations without an adapter, new modules, and workflow changes that cannot be expressed as configuration or hooks. These are delivered as extension modules that depend on the core's public interfaces, never as edits to core files.

---

## 4. Customer Expectation and Reference Analysis

### 4.1 Customer reference images (four screenshots)

The images are analysed in detail in master §3.1 and §4. For template design the expectations they set are:

| Expectation from the images | Demo coverage | Deferred |
|---|---|---|
| Admin dashboard with total/active/batch-wise/course-wise students, attendance, completion %, assessment scores, assignment status, exports | **Full** in demo (F-19 core tiles, XLSX/CSV export) | Project status, trainer performance composite, placement status, company-wise placements, certificates issued, feedback tiles appear as *placeholder tiles* labelled "module not enabled" until their modules exist |
| Student dashboard with overall/course progress, upcoming sessions and calendar | **Full** | Webinar/workshop and interview/project progress widgets (future modules) |
| Self-paced video courses, live classes, materials, completion tracking | **Full** with file-based video and link-based live classes | Certifications (future) |
| Coding practice: problems, web/SQL/debug practice, IDE | **Prototype**: coding problems with browser-side execution for JavaScript and Python; problem list, workspace, verdicts | SQL Lab, Web Lab, Debug Challenges, Playground with server execution |
| Projects and assessments: projects, assignments, skill assessments, portfolio | Assignments and tests **full**; profile projects list | Guided projects module, portfolio page |
| Career and placement: mock interviews, resume, portfolio, interview prep, placement guidance | Resume upload in profile; placement tables and role seeded | Placement portal, kits, AI interviews |
| AI support | None (flag exists, off) | AI assistant, hints, interviews |
| Student profile: personal, skills, projects, progress, resume | **Full** core profile | Derived skills, generated resume |

### 4.2 Reference portal (TAI) — what the demo must feel like

The master's page-by-page analysis (§5.3) and adopt/adapt/avoid summary (§5.5) drive the template's UX. For the demo, the following patterns are mandatory because they define the "expected experience":

- **App shell**: left navigation with labels, top utility bar (search, notifications, profile), light/dark theme, employability-style summary ring optional (off by default).
- **Dashboard composition**: "today" band (sessions, deadlines) first, then progress tiles with explanations, continue-learning cards, announcements; streaks and leaderboards are future flags.
- **Courses**: card grid with thumbnail, module count, duration and progress; tabs with counts; course player with curriculum sidebar, lesson types, done markers and inline practice items.
- **Assignments**: header statistics; module rail with lock state; question list with type, difficulty, marks, attempts, time and review; per-question workspace.
- **Tests**: Upcoming / History tabs; cards with type, window, duration, status, result; instruction page; full-screen attempt with palette and timer; result page.
- **Schedule**: month calendar plus agenda list with join buttons.
- **Profile**: tabbed sections, completeness indicator, resumes with default, document verification status.
- **Information density**: comfortable on phones; compact staff tables on desktop.

**Inspection status for this document.** The app browser session on the reference portal was signed out when this document was prepared, so **no new authenticated pages were inspected**; all observations come from the inspection recorded in the master (§3.2, §5). If a deeper look at the test-taking, coding or notification screens is wanted for the revision round, sign in privately in the app browser and the analysis will be extended. Credentials are never to be typed into this conversation, stored, or placed in any file.

### 4.3 Modern LMS patterns adopted beyond the reference

Command-palette search; keyboard-navigable tables; skeleton loading; optimistic bookmarks; installable PWA shell; accessible timers and verdicts; consistent empty/error states; branded email templates; audit visibility for admins; per-client theme tokens.

---

## 5. Architecture Options Comparison

### 5.1 Evaluation criteria

Local development ease; free staging fit; small team (1–3 engineers); reusability across clients; white-label deployment; maintainability; security boundaries; future scaling; initial operating cost.

### 5.2 Comparison

| Criterion | 1. Monolithic application (single deployable, no internal module boundaries) | 2. Modular monolith (single deployable, strict internal modules) | 3. Microservices (many deployables) | 4. Monorepo-based modular architecture (several apps + shared packages in one repository, modular monolith inside) |
|---|---|---|---|---|
| Local development | Easiest to start; becomes tangled | Easy; one API process, one web process | Hard: many processes, service discovery, orchestration | Easy: `docker compose up` + two dev servers; shared types |
| Free staging | Fits one free service | Fits one free service (+ web) | Does not fit free tiers (many services, networking) | Fits: web on a static/edge free tier, API on one free service or one VM |
| Small team | Fine at first, painful later | Ideal | Overhead too high | Ideal |
| Reusability / white-label | Poor: features entangled; hard to disable | Good: modules toggled by flags | Good in theory, expensive in practice | Best: modules + shared packages + client overlay directory |
| Maintainability | Degrades with size | Good with enforced boundaries | Good per service, hard overall | Good; lint rules enforce boundaries across packages |
| Security boundaries | Weak: code execution or AI would run in-process unless separated | Good if risky work is external | Strong per service | Strong where needed (execution, AI adapters) without paying for it everywhere |
| Future scaling | Vertical only | Vertical, then replicas; extract hot modules later | Horizontal from day one | Same as 2; extraction path is natural because packages are already separate |
| Initial cost | Lowest | Lowest | Highest | Lowest (same runtime footprint as 2) |
| Risk of over-engineering | Low | Low | High | Low if the number of apps stays at three |

### 5.3 Recommendation

**Option 4: a monorepo holding a modular monolith** — three runtime apps (`web`, `api`, `worker`), shared packages, and a client overlay — with **only two out-of-process components by necessity**: the execution service (isolated host; browser prototype in the demo) and external providers (video, email, AI) behind adapters. This is the master's architecture (§12.3, §13) made concrete for reuse; it scores best or equal-best on every criterion above and adds nothing a two-person team cannot operate.

---

## 6. Recommended Base Architecture

### 6.1 Overview

```
┌──────────────────────────────── monorepo (pnpm workspaces + Turborepo) ────────────────────────────────┐
│ apps/web (Next.js 16)        apps/api (NestJS 12)                apps/worker (NestJS standalone)        │
│  • route groups per portal    • feature modules (module contract) • same modules' job handlers          │
│  • design system from         • REST /api/v1 + OpenAPI            • runs EMBEDDED in api (demo/staging) │
│    packages/ui + theme tokens • guards: auth, permission, scope   •   or as a separate process (prod)   │
│  • typed client from OpenAPI  • domain events (in-process)        • queue driver: pg-boss (default)     │
│                               • queue interface → pg-boss/BullMQ  •   BullMQ/Redis (scale option)      │
│ packages/shared (Zod schemas, types, enums, permissions catalogue, utilities)                            │
│ packages/ui (tokens, Tailwind preset, components, composites)     packages/config (eslint, ts, tailwind)│
│ packages/module-sdk (module manifest types, hooks, extension points, testing helpers)                    │
│ clients/<client>/ (branding.json, settings.json, flags.json, navigation.json, custom-fields.json,        │
│                    templates/, assets/, seeds/, extensions/)   ← overlay, never edits core               │
│ infra/ (docker compose files, Caddy config, deploy scripts)   docs/ (master report, this plan, ADRs)     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
          │ HTTP/JSON, SSE            │ SQL (Prisma)          │ S3 API                 │ adapters (HTTPS)
          ▼                           ▼                       ▼                        ▼
   browsers / PWA             PostgreSQL 16+           S3-compatible storage      video · email · SMS · AI ·
   (students, staff)          (+ pg-boss schema)       (MinIO local, R2 staging)   execution service (isolated)
```

### 6.2 Modules that will exist (template core)

`auth`, `rbac`, `users`, `students`, `trainers`, `batches`, `courses` (modules, lessons, resources, publications), `enrollments-progress`, `sessions` (live schedule), `attendance`, `questions`, `assignments`, `tests`, `practice` (problems + execution adapter), `reports`, `notifications` (+ announcements), `profile`, `files`, `settings` (branding, flags, navigation, custom fields, templates, taxonomies, integrations), `audit`, `search`, `health`. Placement (`placement`), `projects`, `certificates`, `feedback`, `gamification`, `ai`, `doubts`, `events` are **future modules** with reserved keys and, for placement, seeded tables.

### 6.3 How modules communicate

- **Synchronous**: a module exposes a *service interface* (TypeScript interface + Nest provider token); other modules depend on the interface, never on repositories or tables of another module. A lint rule blocks cross-module imports outside `index.ts` exports.
- **Asynchronous**: modules publish **domain events** (`lesson.completed`, `submission.graded`, `attendance.marked`, `test.released`, `user.invited`) on an in-process event bus; subscribers in other modules react (progress, notifications, reports, audit). Events are typed in `packages/shared`.
- **Background**: work that must survive a request or run later is enqueued through the **queue interface** (`jobs.enqueue('exports.generate', payload)`); handlers live in the owning module and run in the worker (embedded or separate).
- **Real-time**: a `realtime` gateway (Socket.IO with the PostgreSQL adapter, or SSE) pushes notifications and submission status; modules never talk to sockets directly, they emit events.
- **HTTP**: the web app talks only to the API through the generated typed client; server components forward the session cookie.

### 6.4 Shared components

`packages/shared` (schemas, types, permission catalogue, event types, date/IST utilities, error codes); `packages/ui` (tokens, primitives, composites: DataTable, PageHeader, StatTile, StatusChip, EmptyState, Timer, CodeEditor, VideoPlayer, CalendarView); `packages/module-sdk` (manifest type, extension point registries, test harness for modules); `packages/config` (ESLint, TypeScript, Tailwind, Prettier presets).

### 6.5 Adding a module

A module is a folder under `apps/api/src/modules/<key>` plus optional UI under `apps/web/src/modules/<key>` with a **manifest**:

```
manifest = {
  key, name, version,
  permissions: [...],            // added to the catalogue at boot
  navigation: [{ portal, label, route, icon, order, permission }],
  routes: [...],                 // web route registrations
  settingsSchema: ZodSchema,     // per-client settings (validated)
  flags: [{ key, default }],
  seeds: { demo: fn, base: fn },
  migrationsDir,
  events: { publishes: [...], subscribes: [...] },
  extensionPoints: [...]         // hooks other modules/overlays may implement
}
```

The registry loads manifests, applies feature flags (a disabled module contributes no routes, navigation, permissions or jobs), validates settings, and exposes the merged navigation to the web app. New core modules are added the same way; client extensions are modules in the overlay that register through the same manifest.

### 6.6 Isolating client-specific functionality

- Overlay directory `clients/<client>/` is selected by the `CLIENT_KEY` environment variable at build and at boot; it can only contribute: configuration files (validated against core schemas), assets, templates, seeds, and extension modules.
- Extension modules may: add routes/pages, add permissions, subscribe to events, implement extension points (e.g. `beforeEnrollment`, `eligibilityRules`, `reportDefinitions`, `customValidators`), add report definitions, add settings sections. They may not modify core tables (they own their own tables with a prefix) or import core internals beyond the SDK.
- Core upgrades therefore stay possible: run core migrations, run overlay migrations, validate configuration, run the client's smoke tests.

### 6.7 Evolution without restructuring

| Need | Change | Structural impact |
|---|---|---|
| More traffic | Run `api` replicas behind the proxy; move worker to its own process; add Redis and switch the queue/cache/realtime drivers | None (drivers) |
| Trusted code grading | Provision a Judge0 host; set the execution driver to `judge0` | None (adapter) |
| AI features | Enable the `ai` module (flag) with a client-owned API key | None |
| Hosted video | Configure the Bunny/Cloudflare driver | None |
| Many small clients on one server | Add `organization_id` to scoped tables via migration; enable the tenant resolver middleware; the `organizations` table already exists | Medium, planned |
| Extract execution/AI/reporting into services | They already sit behind interfaces; move handlers to a new app | Low |

---

## 7. Final Technology Stack Analysis

Legend for the "Free/OSS" column: **OSS** open-source licence; **Free** free service tier; **Client-paid** production cost owned by the client.

### 7.1 Frontend

| Category | Recommended | Reason | Free/OSS | Local cost | Free staging | Production | Alternatives | Risks / limitations |
|---|---|---|---|---|---|---|---|---|
| Framework | **Next.js 16** (App Router, React 19, React Compiler) | Master choice; SSR for phones, route groups per portal, image optimisation, self-hostable in Docker | OSS (MIT) | 0 | Cloudflare Workers via OpenNext (3 MiB free-plan bundle limit — must be checked), Vercel Hobby (non-commercial use only), or on the free VM | Any Node host | Vite + React Router SPA (simpler, no SSR); Remix | Bundle size on Workers free plan; discipline on server/client boundaries |
| Language | **TypeScript 5 (strict)** | Shared types with API | OSS (Apache-2.0) | 0 | — | — | JavaScript | — |
| UI library | **React 19** | Ecosystem, shadcn, Radix | OSS (MIT) | 0 | — | — | Vue, Svelte | — |
| Component library | **shadcn/ui** (Radix primitives, copied into `packages/ui`) | Owned code, accessible, token-themeable, no vendor lock | OSS (MIT) | 0 | — | — | MUI, Ant Design, Mantine | Upgrades are manual (acceptable) |
| Styling | **Tailwind CSS 4** + CSS variables for tokens | Fast, consistent, theme by variables | OSS (MIT) | 0 | — | — | CSS Modules, vanilla-extract | Class verbosity |
| Forms | **React Hook Form** | Performance, RHF + Zod resolver | OSS (MIT) | 0 | — | — | Formik, TanStack Form | — |
| Validation | **Zod** (shared schemas) | One schema for web and API | OSS (MIT) | 0 | — | — | Valibot, Yup | — |
| State | **TanStack Query** (server state) + URL state + **Zustand** (few client stores) | Minimal boilerplate | OSS (MIT) | 0 | — | — | Redux Toolkit | Query-key discipline |
| API communication | Typed client generated with **openapi-typescript** + `openapi-fetch` | Contract-first, works with a separate API | OSS (MIT) | 0 | — | — | tRPC (couples deployments), manual fetch | Regeneration step in CI |
| Routing | Next.js App Router with route groups `(public) (auth) (student) (trainer) (admin)` | Layout per portal, guards | OSS | 0 | — | — | — | — |
| Charts | **Recharts** | Declarative, responsive, token colours | OSS (MIT) | 0 | — | — | ECharts, Chart.js | Large datasets need aggregation (planned) |
| Rich text | **TipTap** (ProseMirror) | Code blocks, images, tables; JSON content | OSS (MIT core) | 0 | — | — | Lexical, Quill | Some TipTap extensions are paid (not needed) |
| Code editor | **CodeMirror 6** | Light, touch-friendly | OSS (MIT) | 0 | — | — | Monaco | Less IntelliSense |
| Accessibility | Radix primitives, `eslint-plugin-jsx-a11y`, axe in tests | AA baseline | OSS | 0 | — | — | — | Manual passes still needed |
| Responsive design | Tailwind breakpoints; mobile-first student portal; bottom tab bar | Phone-first audience | OSS | 0 | — | — | — | — |
| Icons | **Lucide** | Consistent set | OSS (ISC) | 0 | — | — | Heroicons | — |
| Tables | **TanStack Table** | Headless, server pagination | OSS (MIT) | 0 | — | — | AG Grid (paid features) | Assembly effort |
| Calendar | Lightweight calendar composite built on `date-fns` (or FullCalendar core if drag-drop is needed later) | Month/week/agenda views | OSS | 0 | — | — | FullCalendar (MIT core, premium plugins) | Build vs buy trade-off |
| Video playback | HTML5 `<video>` with `hls.js` for HLS; provider players via adapter | Works with file-based demo video | OSS (Apache-2.0) | 0 | — | Provider players | Video.js, Plyr | Adaptive bitrate only with HLS or providers |
| In-browser execution (demo) | Sandboxed `<iframe sandbox="allow-scripts">` + Web Worker for JavaScript; **Pyodide** (CPython on WebAssembly) for Python, loaded from the app's own static assets | Real execution with no server risk; free | OSS (MPL-2.0 for Pyodide) | 0 (≈ 15 MB first load, cached) | Static assets | Prototype only | none server-side | Results are untrusted for grading; no Java/C |

### 7.2 Backend

| Category | Recommended | Reason | Free/OSS | Local cost | Free staging | Production | Alternatives | Risks / limitations |
|---|---|---|---|---|---|---|---|---|
| Framework | **NestJS 12** (modular monolith) | Module system matches the module contract; guards/interceptors; ESM; Standard Schema (Zod) | OSS (MIT) | 0 | Render free (sleeps), free VM | Any Node host | Fastify plain, Hono, Django, Laravel | Learning curve; abstraction |
| Language | TypeScript 5 (strict) | Shared with web | OSS | 0 | — | — | — | — |
| API style | REST + JSON `/api/v1`, OpenAPI 3.1 generated, SSE/WebSocket for real-time | Simple, cacheable, mobile-ready | OSS | 0 | — | — | GraphQL, tRPC | Purpose-built aggregate endpoints needed |
| Validation | Zod via Nest 12 Standard Schema pipes | Single source of truth | OSS | 0 | — | — | class-validator | — |
| Authentication | Own: Argon2id, JWT access (15 min) + rotating refresh (httpOnly cookie), invitations, reset; OTP adapter later | No per-user SaaS cost; invite-first | OSS (`argon2`, `jose`) | 0 | — | — | Auth.js, Keycloak, Clerk | Must be tested thoroughly (planned) |
| Authorization | Permission catalogue + `@RequirePermission` guard + scope filters | Master §7 | OSS | 0 | — | — | CASL | Discipline in services |
| Error handling | RFC 9457 problem+json filter, typed domain errors | Consistent clients | OSS | 0 | — | — | — | — |
| Logging | **pino** structured JSON, request IDs, no PII | Fast | OSS (MIT) | 0 | — | Ship to Loki/Axiom later | winston | — |
| Background jobs | **Queue interface**; default driver **pg-boss** (PostgreSQL, SKIP LOCKED, cron, retries); optional driver BullMQ/Redis | No Redis for demo/staging; reliable; embedded mode for free PaaS | OSS (MIT) | 0 | Works on Render free (embedded) and on the VM | pg-boss fine to ≈ thousands of jobs/hour; BullMQ for more | BullMQ only | pg-boss adds load to PostgreSQL (acceptable at scale target) |
| File handling | File registry + S3-compatible storage via AWS SDK v3 (MinIO local, R2 staging), presigned URLs, MIME sniffing | Master F-07 | OSS SDK; MinIO AGPL (self-host, unmodified) | 0 | R2 free 10 GB | R2/S3 | Local disk driver (also provided for tiny deployments) | MinIO's AGPL licence is acceptable for unmodified self-hosting; do not modify MinIO |
| Notification handling | Notification service with channel adapters (in-app, email SMTP/provider); SMS/WhatsApp/push adapters later | Master F-20 | OSS (`nodemailer`) | 0 | Mailpit on VM or Resend free | Resend/SES | — | — |
| Real-time | Socket.IO with `@socket.io/postgres-adapter` (or SSE endpoints) | No Redis needed | OSS (MIT) | 0 | Works on VM; on Render free, SSE preferred | Redis adapter later | SSE only | Long-lived connections on serverless hosts are unsuitable (use SSE with reconnect) |
| PDF/XLSX | `exceljs` for XLSX; CSV streaming; PDF via Playwright/Chromium in worker (future certificates/PDF reports) | Master F-19 | OSS | 0 | — | — | pdf-lib | Chromium image size (worker only) |
| Rate limiting | `@nestjs/throttler` with in-memory store (single instance) or PostgreSQL store; Redis store later | No Redis needed | OSS | 0 | — | — | — | Per-instance limits when replicated (switch driver) |
| Cache | In-process LRU + PostgreSQL-backed cache table for cross-instance needs; Redis driver later | Same | OSS | 0 | — | — | — | — |

### 7.3 Database

| Category | Recommended | Reason | Free/OSS | Local cost | Free staging | Production | Alternatives | Risks / limitations |
|---|---|---|---|---|---|---|---|---|
| Engine | **PostgreSQL 16** (or 17) | Relational integrity, JSONB, FTS, SKIP LOCKED for pg-boss | OSS (PostgreSQL licence) | 0 (Docker) | Neon free (0.5 GB/project, 100 CU-hours), Supabase free (500 MB, pauses after 7 days), Render free (1 GB, expires after 30 days), or on the VM | Managed PostgreSQL (client-paid) | MySQL | Free DB tiers are small and can pause/expire |
| ORM | **Prisma ORM 7** | Type-safe client, migrations, TS runtime | OSS (Apache-2.0) | 0 | — | — | Drizzle (1.0 still RC) | Raw SQL for reports (planned) |
| Migration strategy | Prisma Migrate, one migration per PR, expand/contract, CI check `prisma migrate diff` against schema, overlay migrations run after core | Safe upgrades per client | OSS | 0 | — | — | — | Discipline |
| Seed data | TypeScript seed scripts: `base` (roles, permissions, settings, taxonomies), `demo` (institute, users, content), per-client `clients/<client>/seeds` | Repeatable demo | OSS | 0 | — | — | — | Keep demo seeds idempotent |
| Local setup | Docker Compose `postgres:16` with named volume; `pgweb`/`Adminer` optional | One command | OSS | 0 | — | — | Local install | — |
| Production compatibility | Plain PostgreSQL features only (no provider-specific extensions beyond `pgcrypto`, `uuid`, `pg_trgm`) | Portability across Neon/Supabase/RDS/self-host | — | — | — | — | — | — |
| Multi-client | **Single-tenant per deployment** (one DB per client) with `organizations` anchor; tenant-ready conventions (§17.2) | Isolation, simplicity | — | — | — | — | Shared DB with `organization_id` | Later migration adds a column to scoped tables |

### 7.4 Infrastructure

| Category | Recommended | Reason | Free/OSS | Local cost | Free staging | Production | Alternatives | Risks / limitations |
|---|---|---|---|---|---|---|---|---|
| Containers | **Docker Engine**; Docker Desktop on Windows/macOS (free for individuals and businesses under 250 employees and USD 10M revenue) | Standard | OSS engine; Desktop free within licence | 0 | — | — | Rancher Desktop, Podman Desktop (both free) | Licence check for larger companies |
| Compose | Docker Compose v2 with profiles (`core`, `tools`, `judge0`) | One file for local and VM staging | OSS | 0 | VM | Prod compose or K8s later | — | — |
| Local environment | pnpm 10, Node 22 LTS, Turborepo, `.env` from `.env.example`, Zod-validated env | Fast, reproducible | OSS | 0 | — | — | npm/yarn | — |
| Environment variables | Per-app `.env`; secrets never committed; `CLIENT_KEY` selects overlay | Twelve-factor | — | 0 | Provider secrets UI | Host secrets | — | — |
| File storage | **MinIO** (local) / **Cloudflare R2** (staging free 10 GB) / R2 or S3 (production) through one S3 driver; local-disk driver for tiny installs | Zero cost, portable | MinIO AGPL; R2 free tier | 0 | Free | Client-paid | Backblaze B2 (10 GB free), Supabase Storage (1 GB) | Free tiers are small |
| Video storage | Files (MP4/HLS) in the same storage with signed URLs for demo; hosted provider drivers for production | Zero cost demo | — | 0 | R2 free | Bunny/Cloudflare Stream (client-paid) | YouTube unlisted embed driver (free, no protection) | No adaptive bitrate for plain MP4; demo videos kept small |
| Cache | In-process + PostgreSQL | No extra service | — | 0 | — | Redis later | — | — |
| Queue | pg-boss on PostgreSQL | No extra service | OSS | 0 | — | BullMQ/Redis later | — | — |
| Email dev tools | **Mailpit** (SMTP catcher with web UI) | See every email locally | OSS (MIT) | 0 | Mailpit on VM; Resend free (3,000/month) or Brevo free (300/day) when real inboxes are needed | Resend/SES (client-paid) | MailHog (unmaintained) | — |
| Background workers | Embedded in API (`WORKER_MODE=embedded`) locally and on free tiers; separate container in production | Free tiers lack worker services | — | 0 | — | — | — | Long jobs compete with request handling in embedded mode (acceptable for demo) |
| Reverse proxy (VM) | **Caddy** (automatic HTTPS) | Simplest TLS | OSS (Apache-2.0) | 0 | Free | Caddy/Traefik | Nginx + certbot | — |
| Code execution (optional local) | Judge0 CE via Compose profile on Linux hosts meeting its requirements; not on Windows Docker Desktop or Arm VMs | Trusted grading demo where possible | OSS (GPL-3.0, separate service) | 0 | Not on free Arm VM | Client-paid VM | Piston | Host requirements; amd64 only |

### 7.5 Testing

| Category | Recommended | Reason | Free/OSS | Notes |
|---|---|---|---|---|
| Unit | **Vitest** | Fast, TS-native, same runner for web and API | OSS | Coverage thresholds per package |
| Integration | Vitest + **Testcontainers** (PostgreSQL) or the Compose database | Real database behaviour | OSS | CI uses a service container |
| API | **Supertest** against a booted Nest app + OpenAPI response validation | Contract confidence | OSS | Permission matrix generated tests |
| End-to-end | **Playwright** (Chromium, WebKit, mobile emulation) | Role journeys (§15) | OSS | Nightly full, PR smoke |
| UI/component | Vitest + Testing Library + Storybook (optional) | States per component | OSS | Storybook optional to keep scope small |
| Security | `pnpm audit`, CodeQL (GitHub), OWASP ZAP baseline against staging, custom auth abuse tests, sandbox tests when Judge0 is present | Baseline | OSS/Free | — |
| Accessibility | `axe-core` in Playwright and component tests; manual screen-reader passes on player and test attempt | AA | OSS | — |
| Load (light) | k6 smoke on staging (list pages, test autosave) | Sanity | OSS | Free tiers throttle; keep light |

### 7.6 Code quality

| Category | Recommended | Notes |
|---|---|---|
| TypeScript strictness | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` where practical; no `any` in core (lint error) | Shared `tsconfig` in `packages/config` |
| ESLint | Flat config; `typescript-eslint`, `eslint-plugin-import` boundaries (module isolation rules), `jsx-a11y`, `security` | Custom rule: no cross-module deep imports |
| Prettier | Shared config; format on commit | — |
| Git hooks | **Husky** + **lint-staged** (lint, format, type-check touched packages) + **commitlint** | Conventional Commits |
| Commit conventions | Conventional Commits with scope = module key and backlog ID in body | Enables changelogs and traceability |
| Environment validation | Zod schema per app; boot fails with a readable list of missing variables | `.env.example` kept in sync by a test |
| API documentation | OpenAPI generated from Nest decorators; served at `/api/docs` outside production; client regenerated in CI; contract tests | — |
| Database migration checks | CI runs `prisma migrate diff` (schema ↔ migrations), applies migrations to a fresh database, runs seeds, and fails on drift; destructive migrations need a label and review | — |
| Dependency hygiene | Renovate/Dependabot, lockfile, pinned majors, licence check (`license-checker`) to keep the template OSS-clean | — |

### 7.7 Stack lock statement

The stack above is proposed for locking at Step 8. After locking, changes require an ADR (master rule 3, 21). Version pins are recorded in `docs/STACK.md` at Phase 1 and upgraded only at phase boundaries.

---
## 8. Local Development Environment

### 8.1 Prerequisites (all free)

| Tool | Version | Purpose | Notes |
|---|---|---|---|
| Git | current | Source control | Windows: enable `core.autocrlf=false`; repo ships `.gitattributes` with LF |
| Node.js | 22 LTS (pinned in `.nvmrc` / `.node-version`) | Runtime | Use `fnm` or `nvm-windows` |
| pnpm | 10 (pinned via `packageManager`) | Package manager, workspaces | `corepack enable` |
| Docker Engine + Compose v2 | current | Services | Docker Desktop (free within licence) or Rancher Desktop / Podman Desktop; on Windows use the WSL 2 backend and keep the repository inside the WSL filesystem for fast file watching |
| VS Code (or any editor) | — | Editor | Recommended extensions listed in `.vscode/extensions.json` |
| Playwright browsers | installed by `pnpm exec playwright install` | E2E | ≈ 500 MB |

### 8.2 Services in `docker compose` (profile `core` starts by default)

| Service | Image | Port (host) | Profile | Purpose | Data |
|---|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | core | Application database (+ pg-boss schema) | Named volume `pgdata` |
| `minio` | `minio/minio` (+ `mc` init job creating buckets) | 9000 (S3), 9001 (console) | core | S3-compatible file/video storage | Named volume `minio` |
| `mailpit` | `axllent/mailpit` | 1025 (SMTP), 8025 (UI) | core | Catches all outgoing email | Ephemeral |
| `adminer` | `adminer` | 8080 | tools | Database browser | — |
| `judge0-server`, `judge0-workers`, `judge0-db`, `judge0-redis` | `judge0/judge0:<pinned>` | 2358 | judge0 (Linux hosts only) | Optional trusted execution | Volumes |

The application processes (`web`, `api`, embedded worker) run **on the host** with hot reload during development; a `compose.app.yml` overlay also builds them as containers to verify the production images locally (`pnpm docker:up`).

### 8.3 Running everything locally

| Step | Command (proposed) | What happens |
|---|---|---|
| 1. Install | `pnpm install` | Installs all workspaces; Husky hooks installed |
| 2. Environment | `pnpm env:init` | Copies `.env.example` → `.env` for each app with local defaults (no secrets) |
| 3. Services | `pnpm services:up` (`docker compose --profile core up -d`) | PostgreSQL, MinIO (buckets created), Mailpit |
| 4. Database | `pnpm db:migrate` | Applies Prisma migrations (core, then overlay if `CLIENT_KEY` set) |
| 5. Seed | `pnpm db:seed` (base) and `pnpm db:seed:demo` | Roles, permissions, settings, taxonomies; then the demo institute, users, content |
| 6. Admin account | `pnpm cli users:create-admin --email admin@demo.local` | Creates a Super Admin (password printed once or taken from `SEED_ADMIN_PASSWORD`); demo seed also creates the demo accounts (§21) |
| 7. Run | `pnpm dev` | Turborepo starts `web` (http://localhost:3000) and `api` (http://localhost:4000, docs at `/api/docs`) with the worker embedded; SSE/WebSocket on the API port |
| 8. Email | open http://localhost:8025 | Every invitation, reminder and notification email appears in Mailpit |
| 9. Files | http://localhost:9001 | MinIO console (dev credentials from `.env`) |
| 10. Reset | `pnpm demo:reset` | Drops and recreates the database and buckets, re-runs migrations and seeds (guarded to local/staging only) |
| 11. Tests | `pnpm test`, `pnpm test:e2e` | Unit/integration/API; Playwright against the running stack |
| 12. Optional execution | `docker compose --profile judge0 up -d` (Linux) and `EXECUTION_DRIVER=judge0` | Trusted grading locally when the host supports it |

**Frontend**: Next.js dev server with Turbopack; reads `NEXT_PUBLIC_API_URL`; branding fetched from the API at boot and cached. **Backend**: Nest in watch mode; Prisma client generated on install; OpenAPI regenerated on start in development. **Workers**: `WORKER_MODE=embedded` runs pg-boss workers inside the API process; `WORKER_MODE=separate` runs `apps/worker`. **File storage**: presigned URLs point at `localhost:9000`. **Code execution**: `EXECUTION_DRIVER=browser-sandbox` by default. **Demo users**: created by the demo seed with well-known demo emails and a password from `SEED_DEMO_PASSWORD` (default only in local; must be set explicitly for staging).

### 8.4 Windows-specific notes

Docker Desktop with WSL 2; keep the repo under `\\wsl$` or a WSL path for file watching and Prisma performance; use Git Bash or WSL shell for scripts; line endings enforced by `.gitattributes`; Playwright runs on Windows natively; Judge0 is not supported on Windows Docker Desktop (cgroup requirements) — use the browser sandbox driver or a Linux VM.

---

## 9. Free Staging Environment

All facts below were checked against vendor pages or current reports in September 2026 (Appendix A) and will change; re-verify before relying on them. **Every option here is demo/staging grade, not production.**

### 9.1 Two viable topologies

**Option A — one free virtual machine running the Compose stack (recommended when a VM can be obtained).** Same images as local; Caddy provides HTTPS on a free subdomain; PostgreSQL, MinIO, Mailpit, API (embedded worker) and web all on the VM. Highest fidelity, no sleeping, real background jobs, WebSockets work. Risks: obtaining capacity, idle reclamation, single point of failure, Arm-only images (no Judge0), you are the operator (updates, backups).

**Option B — free-tier combination (fallback).** Web on Cloudflare Workers (via OpenNext) or Vercel Hobby; API on Render free web service in embedded-worker mode; PostgreSQL on Neon free; files on Cloudflare R2 free; email via Resend free; CI on GitHub Actions; monitoring on Sentry and UptimeRobot free tiers. Zero operations, but the API sleeps after inactivity, long-lived WebSockets are unreliable (use SSE), background jobs run only while the API is awake, and free databases have small caps or expiry.

### 9.2 Candidate services and their verified limits

| Service | Category | Classification | Verified limits and behaviour (Sept 2026) | Sleep / expiry | Data-loss risk | Suitable for |
|---|---|---|---|---|---|---|
| **Oracle Cloud Always Free** (Ampere A1 VM) | VM hosting | Free tier with limitations | Since 15 June 2026: **2 OCPU / 12 GB RAM** Arm (down from 4/24); instances over the new limit terminated from 18 Aug 2026; 200 GB block storage total; capacity frequently unavailable in popular regions | **Idle reclamation**: instance may be reclaimed if 95th-percentile CPU < 20% over 7 days (keep a light scheduled load or accept risk) | Medium (reclamation, no managed backups → script your own dumps to R2) | Staging/demo (Option A) |
| Google Cloud Always Free e2-micro | VM hosting | Free tier with limitations | 1 shared vCPU / 1 GB RAM / 30 GB disk, only in us-west1, us-central1, us-east1 | None, but 1 GB RAM is too small for the full stack (API + DB + MinIO); usable for the API alone | Low | Partial staging |
| AWS Free plan (new accounts) | VM/PaaS | Trial-only | Credit-based since July 2025: USD 100 credits (up to 200), **6 months**, account closes when exhausted | Expires | High after expiry | Short demos only |
| **Render** free web service | API hosting | Free tier with limitations | 750 free instance-hours/month per workspace; spins down after **15 minutes** without traffic, ~1 minute to wake; instance size not documented (small); no free background workers or cron; "do not use for production" | Sleeps | Low (stateless) | Option B API (embedded worker) |
| Render free PostgreSQL | Database | Free tier with limitations, **expires** | 1 GB; one per workspace; **expires 30 days after creation** (14-day grace) then deleted; no backups; no pooling | Expires | **High** | Not recommended (use Neon) |
| Render free Key Value (Redis) | Cache | Free tier | In-memory only, one per workspace, data lost on restart | Volatile | High | Not needed (pg-boss) |
| **Neon** free PostgreSQL | Database | Free tier with limitations | 0.5 GB storage per project, 100 CU-hours per project per month, up to 100 projects; compute auto-suspends when idle (cold start on first query) | Auto-suspend (seconds to resume) | Low (managed) but no PITR on free | Option B database; also Option A if the VM's disk is not trusted |
| Supabase free | Database/storage | Free tier with limitations | 2 projects, 500 MB DB, 1 GB file storage, 5 GB egress, 50,000 MAU; **paused after 7 days of inactivity**; no backups | Pauses (manual restore) | Medium | Alternative to Neon |
| **Cloudflare R2** | Object storage | Free tier with limitations | 10 GB-month storage, 1 M Class A and 10 M Class B operations per month, free egress; USD 0.015/GB-month beyond | None | Low | Files and demo videos (both options) |
| Backblaze B2 | Object storage | Free tier (verify) | Commonly 10 GB free storage; egress allowance limited | None | Low | Alternative |
| **Cloudflare Workers** (Next.js via OpenNext) | Web hosting | Free tier with limitations | 100,000 requests/day, 10 ms CPU per request, 128 MB memory, **3 MiB Worker bundle on the free plan** (10 MiB paid), static assets 20,000 files/25 MiB each | None | Low | Option B web (bundle size must be verified; fallback: Vercel or VM) |
| **Vercel Hobby** | Web hosting | Free tier with limitations, **non-commercial only** | Up to 1 M edge requests, 1 M function invocations, 4 CPU-hours, 100 deployments/day, 300 s function duration; usage pause of 30 days when exceeded; fair-use policy restricts Hobby to personal, non-commercial use | Pause on overage | Low | Personal demo only; a client demo may violate fair use — prefer Workers or VM |
| Netlify Free | Web hosting | Free tier with limitations | 300 credits/month (≈ 15 GB bandwidth or ≈ 20 deploys at 15 credits each); sites pause when credits run out; legacy accounts 100 GB/300 build minutes | Pause | Low | Static export only (not for SSR app) |
| Koyeb | PaaS | **No free tier** (Pro USD 29/month) | — | — | — | Not suitable |
| Railway | PaaS | Trial-only then paid | One-time USD 5 credit expiring in 30 days; Hobby USD 5/month | — | — | Not free |
| Fly.io | PaaS | **No free tier** | Free allowance discontinued Oct 2024; trial limited; Hobby USD 5/month | — | — | Not free |
| **Upstash Redis** | Cache/queue | Free tier with limitations | 500 K commands/month, 256 MB, 10 GB bandwidth, 1 database; BullMQ-style polling is not recommended | None | Low | Not needed with pg-boss |
| **Resend** | Email | Free tier with limitations | 3,000 emails/month, 100/day; Pro USD 20/month for 50,000 | None | — | Real inboxes in staging |
| Brevo | Email | Free tier with limitations | 300 emails/day | None | — | Alternative |
| Mailtrap | Email testing/sending | Free tier with limitations | Sending: 4,000 emails/month, 150/day, 1 domain; sandbox for testing | None | — | Alternative to Mailpit for hosted testing |
| Mailpit (self-hosted on VM) | Email testing | Fully free (OSS) | Unlimited catch-all; no real delivery | — | — | Option A default |
| **GitHub Actions** | CI/CD | Free tier with limitations | 2,000 minutes/month and 500 MB artifact storage for private repositories on GitHub Free; standard runners free for public repositories | — | — | CI for both options (keep pipelines lean; Linux runners only) |
| **Sentry** Developer | Error tracking | Free tier with limitations | 5 K errors/month, 5 M spans, 50 replays, 1 user, 30-day retention; Team from USD 26/month | — | — | Both options |
| **UptimeRobot** Free | Monitoring | Free tier, **non-commercial** since Dec 2024 | 50 monitors, 5-minute interval | — | — | Personal staging checks; commercial use needs a paid plan or a self-hosted Uptime Kuma (free) on the VM |
| Uptime Kuma (self-hosted) | Monitoring | Fully free (OSS) | Runs on the VM | — | — | Option A |
| DuckDNS / FreeDNS / sslip.io / nip.io | Domain | Fully free | Free subdomains (DuckDNS) or IP-based hostnames (sslip.io/nip.io); Let's Encrypt via Caddy works with DuckDNS | — | Low | Staging URL; a real domain is a client cost |
| Cloudflare Tunnel quick tunnel (`trycloudflare.com`) | Exposure | Fully free | Random URL, no account, not persistent; named tunnels need a domain | Non-persistent | — | Ad-hoc demos from a laptop |
| GitHub Codespaces | Cloud dev | Free allowance | Included hours per month on personal accounts (verify current allowance) | — | — | Optional |

### 9.3 Recommended staging plan

| Layer | Option A (VM) | Option B (free-tier combination) |
|---|---|---|
| Web | Next.js container behind Caddy | Cloudflare Workers via OpenNext (verify bundle ≤ 3 MiB compressed) or Vercel Hobby for **personal** demos only |
| API + jobs | API container, `WORKER_MODE=embedded` | Render free web service, `WORKER_MODE=embedded`; accept 15-minute sleep; add a free uptime ping every 10 minutes only if the vendor's terms allow keeping it awake (otherwise accept cold starts and say so in demos) |
| Database | PostgreSQL container with nightly `pg_dump` to R2 **or** Neon free | Neon free (0.5 GB) |
| Files/video | MinIO container or R2 free | R2 free |
| Email | Mailpit container (catch-all) or Resend free | Resend free |
| Real-time | Socket.IO/SSE | SSE |
| Domain/TLS | DuckDNS subdomain + Caddy Let's Encrypt | Vendor subdomains |
| CI/CD | GitHub Actions → build images → SSH deploy (`docker compose pull && up`) | GitHub Actions → vendor deploy hooks |
| Monitoring | Uptime Kuma + Sentry free | UptimeRobot (personal) + Sentry free |
| Execution | Browser sandbox only (Arm VM) | Browser sandbox only |

### 9.4 Classification summary

| Classification | Services |
|---|---|
| Fully free (open source, self-hosted) | PostgreSQL, MinIO, Mailpit, Caddy, Uptime Kuma, pg-boss, Judge0 CE (where a suitable host exists), all frameworks and libraries |
| Free tier with limitations | Oracle Always Free VM, GCP e2-micro, Render web service, Neon, Supabase, R2, B2, Cloudflare Workers, Vercel Hobby (non-commercial), Netlify, Upstash, Resend, Brevo, Mailtrap, GitHub Actions, Sentry, UptimeRobot (non-commercial) |
| Trial-only | AWS Free plan (6 months), Railway (USD 5 once), Fly.io trial |
| Paid after usage limits | Render, Neon, R2, Resend, Sentry, Workers, GitHub Actions (all continue at paid rates only if a payment method is added; otherwise they pause) |
| Not suitable for production | Every item in this section (sleeping services, expiring databases, no backups, single VM without redundancy, free-tier terms) |

### 9.5 Security limitations of free staging

Shared infrastructure, no private networking on PaaS free tiers, limited WAF, no guaranteed backups, single admin accounts on vendor consoles; therefore staging must hold **only synthetic demo data**, never real student data, and must be reset from seeds at will.

---

## 10. External Services and Cost Boundaries

### 10.1 Free and open-source development components (no cost to anyone)

Frameworks and libraries (Next.js, React, NestJS, Prisma, Zod, Tailwind, shadcn/ui, TanStack, TipTap, CodeMirror, Recharts, pg-boss, pino, Playwright, Vitest, Testcontainers, k6, axe); PostgreSQL; Docker Engine and Compose (Docker Desktop within its free licence terms, or Rancher/Podman Desktop); MinIO; Mailpit; Caddy; Uptime Kuma; Judge0 CE and Pyodide; Git and GitHub free plan; VS Code.

### 10.2 External services that create costs (client-owned)

| Service | When it becomes necessary | Typical owner cost driver |
|---|---|---|
| Domain and DNS | Any client-facing deployment | Annual domain fee |
| Production hosting (VMs or PaaS) | Production | Monthly compute |
| Managed PostgreSQL with backups | Production | Monthly, by size |
| Object storage beyond free tier | Production or large libraries | Per GB-month |
| Video hosting (Bunny, Cloudflare Stream) | When adaptive streaming/protection is required | Storage and delivery minutes/GB |
| Email provider beyond free tier | Production volumes | Per 1,000 emails |
| SMS/OTP provider and DLT registration | If OTP login or SMS alerts are wanted | Per SMS + registration |
| WhatsApp Business API | If WhatsApp alerts are wanted | Per conversation |
| Live-class provider (Zoom/Meet licences and API) | Live classes | Per host licence |
| AI API (Anthropic Claude) | AI features enabled | Per token |
| Code-execution infrastructure (Judge0 host or Judge0 Cloud) | Trusted grading in production | VM or subscription |
| Monitoring beyond free tiers (Sentry Team, uptime, logs) | Production | Monthly |
| Paid design assets, fonts, stock media | If chosen by the client | One-off |
| Premium integrations (proctoring, payment gateway fees) | If scoped | Per use |

### 10.3 Cost boundary statement

**External service accounts, subscriptions, API usage, hosting charges, domain charges and production infrastructure costs will be owned and paid for by the client unless separately agreed in writing.** Accounts for such services are to be created in the client's name with the developer granted delegated access. **AI and code-execution services must not be silently included in the developer's personal expenses**: they are enabled only when the client provides the account or key and approves the budget, and the platform's flags keep them off until then. During the local demo and free staging stages, no paid service is required; where a free tier is used, its limits and terms (including non-commercial clauses) are documented in §9 and must be respected.

---
## 11. Reusable Module Structure

### 11.1 Template modules

| ID | Module key | Master features | Purpose | Owns (tables) | Publishes → Subscribes | Navigation contributed | Flag | Demo status |
|---|---|---|---|---|---|---|---|---|
| M-01 | `auth` | F-01 | Sign-in, invitations, reset, sessions | `sessions`, `invitations`, `password_resets`, `otp_codes` (future) | `user.logged_in`, `user.invited` → — | Auth pages | always on | **Full** |
| M-02 | `rbac` | F-02 | Roles, permissions, scopes, guards | `roles`, `permissions`, `role_permissions`, `user_roles` | `role.changed` → `module.registered` | Admin › Roles | always on | **Full** |
| M-03 | `users` | F-03 | Accounts, staff management, deactivation | `users` | `user.created`, `user.deactivated` | Admin › Users | always on | **Full** |
| M-04 | `students` | F-03, F-21 (core) | Student records, import, documents, profile sections | `student_profiles`, `documents`, `resumes`, `student_skills` | `student.enrolled`, `student.status_changed` → `batch.member_added` | Admin › Students; Student › Profile | always on | **Full** |
| M-05 | `trainers` | F-04 | Trainer profiles and assignments | `trainer_profiles`, `batch_trainers` | `trainer.assigned` | Admin › Trainers | always on | **Full** |
| M-06 | `batches` | F-05 | Programmes, batches, membership | `programs`, `program_courses`, `batches`, `batch_members` | `batch.created`, `batch.member_added`, `batch.status_changed` | Admin › Batches; Trainer › Batches | always on | **Full** |
| M-07 | `courses` | F-06, F-07 | Course authoring, publication, catalogue, player | `courses`, `course_modules`, `lessons`, `lesson_resources`, `course_publications` | `course.published`, `lesson.viewed` → `session.recording_attached` | Admin › Courses; Student › Courses | always on | **Full** |
| M-08 | `progress` | F-14 | Enrolments, lesson progress, activity, aggregates | `enrollments`, `lesson_progress`, `activity_events` | `lesson.completed`, `course.completed` → `lesson.viewed`, `submission.graded`, `attendance.marked` | Student › Progress | always on | **Full** |
| M-09 | `sessions` | F-08 | Series, occurrences, links, recordings, calendar | `session_series`, `live_sessions` | `session.scheduled`, `session.rescheduled`, `session.completed` | Schedule (all portals) | `module.sessions` | **Full** (link-based) |
| M-10 | `attendance` | F-13 | Roll-call, corrections, thresholds | `attendance_records` | `attendance.marked`, `attendance.corrected` → `session.completed` | Trainer › Attendance; Admin › Attendance | `module.attendance` | **Full** (roll-call) |
| M-11 | `questions` | F-09 | Question bank, versions, import, validation | `questions`, `question_options`, `coding_problems`, `test_cases`, `question_versions` | `question.published` | Admin › Question bank | always on | **Full** (MCQ, true/false, descriptive, coding) |
| M-12 | `assignments` | F-10 | Assignments, modules, publication, submissions, grading | `assignments`, `assignment_modules`, `assignment_questions`, `assignment_publications`, `submissions`, `submission_results` | `submission.created`, `submission.graded` → `execution.completed` | Assignments (all portals) | `module.assignments` | **Full** |
| M-13 | `tests` | F-11 | Test builder, schedules, attempts, grading, results | `tests`, `test_sections`, `test_questions`, `test_schedules`, `test_attempts`, `test_answers` | `test.scheduled`, `attempt.submitted`, `test.released` | Tests (all portals) | `module.tests` | **Full** (objective + descriptive + coding via adapter) |
| M-14 | `practice` | F-12 (core) | Problem catalogue, execution adapter, verdicts | `practice_problems` (view over questions), `execution_runs` | `execution.completed` | Student › Practice | `module.practice` | **Prototype** (browser sandbox; Judge0 driver optional) |
| M-15 | `reports` | F-19 (core) | Dashboard metrics, report pages, exports | `report_exports`, `report_definitions`, `reporting.*` aggregates | → all | Admin › Dashboard/Reports; Trainer › Reports | always on | **Full** (core metrics; placeholders for future modules) |
| M-16 | `notifications` | F-20 | In-app, email, preferences, announcements | `notifications`, `notification_preferences`, `announcements`, `email_templates` | → many | Notifications (all portals); Admin › Announcements | always on | **Full** (in-app + email) |
| M-17 | `files` | F-07 | File registry, presigned upload/download, storage drivers, video driver | `files` | `file.uploaded` | — | always on | **Full** |
| M-18 | `settings` | F-26 | Settings, branding, flags, navigation config, taxonomies, custom fields, integrations, content pages | `organizations`, `settings`, `branding_settings`, `feature_flags`, `navigation_config`, `taxonomies`, `taxonomy_terms`, `custom_field_definitions`, `custom_field_values`, `integration_configs`, `content_pages` | `settings.changed`, `branding.changed`, `flag.changed` | Admin › Settings | always on | **Full** |
| M-19 | `audit` | F-26 | Append-only audit log and viewer | `audit_logs` | → all mutations | Admin › Audit log | always on | **Full** |
| M-20 | `search` | F-25 | Full-text search across permitted entities | search indexes | → publish events | Utility bar | always on | **Basic** |
| M-21 | `health` | — | Liveness/readiness, queue and integration status | — | — | Admin › System health | always on | **Full** |
| M-22 | `placement` | F-17 | Companies, drives, applications (data model and role only in demo) | `companies`, `placement_drives`, `drive_applications`, `application_events`, `offers` | — | Hidden until enabled | `module.placement` (off) | **Data-only** |
| — | `projects`, `certificates`, `feedback`, `gamification`, `doubts`, `events`, `ai`, `labs` | F-15, F-16, F-18, F-22, F-27, F-28, F-23/24, F-12b–e | Future modules | — | — | — | off | **Future** |

### 11.2 Module contract (summary)

Every module ships: `manifest.ts` (as in §6.5), `*.module.ts` (Nest module wiring), `controllers/`, `services/`, `repositories/`, `events/`, `jobs/`, `dto/` (re-exporting shared Zod schemas), `migrations/` (Prisma migrations are global per app, but each migration is tagged with the module key in its name), `seeds/`, `README.md`, and tests. The web side ships `apps/web/src/modules/<key>/` with pages (re-exported into route groups), components and hooks. Module manifests are validated at boot; an invalid manifest fails startup with a clear message.

### 11.3 Lifecycle at boot

1. Load core module manifests, then overlay extension manifests for `CLIENT_KEY`.
2. Evaluate feature flags from the database (defaults from manifests); disabled modules are not registered.
3. Register permissions into the catalogue (idempotent), navigation items (merged with `navigation_config` overrides), routes, job handlers, settings sections (validated against each module's schema), and event subscriptions.
4. Run health checks for required integrations of enabled modules; report on the system-health page.
5. Expose `/me` with the effective navigation, flags and branding for the web app.

### 11.4 Extension points available to overlays (initial set)

`navigation.transform`, `dashboard.widgets` (add/remove widgets per portal), `student.customFields` (schema contributions), `enrollment.beforeCreate`, `attendance.rules`, `assessment.gradingHooks`, `reports.definitions`, `notifications.templates`, `settings.sections`, `auth.postLogin`. Each is a typed interface in `packages/module-sdk` with a test harness.

---

## 12. Demo Scope

### 12.1 Demo roles

| Role | In demo? | Reason |
|---|---|---|
| Super Admin | **Yes** | Shows settings, branding, flags, roles, audit and system health — the white-label story |
| Admin (Operations) | **Yes** | The main staff journey: onboarding, batches, content, timetable, reports |
| Trainer | **Yes** | Attendance, assignments, tests, grading, batch health |
| Student | **Yes** | The experience the customer images describe |
| Placement Coordinator | Seeded role, **no portal** | Placement module is future; keeping the role and tables shows readiness without half-built pages |
| Content Manager | Seeded permission bundle, **no separate portal** | Uses the admin content pages; demonstrates role configurability |
| Support Staff, Company, Parent | Not seeded | Future (master §7.1) |

### 12.2 Demo modules (fully implemented)

| Module | Purpose | Users | Pages (§14) | Main features | Required APIs (§18) | Database entities (§17) | Permissions (§13) | Navigation | Dependencies | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|
| **Authentication (M-01)** | Secure entry for every role | All | DP-P02…P07 | Email/password sign-in, invitation acceptance, forgot/reset, session list, sign out, role-based redirect | `/auth/*`, `/me` | `users`, `sessions`, `invitations`, `password_resets` | — (public + `auth:self`) | Auth pages; profile menu | None | All auth flows pass tests; throttling works; invitation email visible in Mailpit; redirect by role |
| **Roles & permissions (M-02)** | Configurable RBAC | Super Admin | DP-A03 | Role list, permission matrix editor, assign roles to users, scope display | `/roles/*`, `/users/{id}/roles` | `roles`, `permissions`, `role_permissions`, `user_roles` | `roles:manage`, `roles:read` | Admin › Settings › Roles | M-01 | Matrix tests pass for all demo roles; editing a bundle changes access within 60 s |
| **Users, students, trainers (M-03–M-05)** | People management | Admin | DP-A02, A04–A08 | Staff users CRUD, student list/detail/import/status/documents, trainer profiles and assignments | `/users/*`, `/students/*`, `/trainers/*` | `users`, `student_profiles`, `documents`, `resumes`, `trainer_profiles`, `batch_trainers` | `users:manage`, `students:manage`, `students:read_sensitive`, `trainers:manage` | Admin › Users/Students/Trainers | M-01, M-02, M-17 | Import of the demo sheet (60 rows) succeeds with error report for 3 bad rows; sensitive fields gated |
| **Batches (M-06)** | Cohorts and timetables | Admin, Trainer | DP-A09–A11, T03 | Programmes, batches, members, trainers, status, content publication tab, timetable tab | `/programs/*`, `/batches/*` | `programs`, `program_courses`, `batches`, `batch_members` | `batches:manage`, `batches:read` | Admin › Batches; Trainer › Batches | M-03–M-05 | Create batch → add students/trainers → publish content → status transitions; trainer sees only own batches |
| **Courses & lessons (M-07)** | Content delivery | Admin (author), Student | DP-A12–A14, S03–S05 | Course builder (outline, lesson types video/article/resources/practice), file/video upload, publication scopes, catalogue, course overview, player with curriculum, resources, mark complete | `/courses/*`, `/lessons/*`, `/files/*`, `/videos/*` | `courses`, `course_modules`, `lessons`, `lesson_resources`, `course_publications`, `files` | `courses:manage`, `courses:publish`, `courses:read` | Admin › Courses; Student › Courses | M-06, M-17 | AC-03.1–03.4 (master) pass with file-based video |
| **Progress (M-08)** | Single source of progress | System, Student, staff views | DP-S06 | Enrolments derived from publications, lesson progress, course/assignment/test progress, overall progress, activity feed | `/me/progress`, `/students/{id}/progress` | `enrollments`, `lesson_progress`, `activity_events` | `progress:read` (own/batch/all) | Student › Progress; embedded widgets | M-07, M-12, M-13 | Numbers agree across dashboard, course page, profile and reports |
| **Schedule (M-09)** | Live classes | Admin, Trainer, Student | DP-A11 (tab), T02, S07 | Series with recurrence, occurrences, join links, status, recording attach, reminders (email), month/agenda views | `/batches/{id}/timetable`, `/sessions/*`, `/me/schedule` | `session_series`, `live_sessions` | `sessions:manage`, `sessions:read` | Schedule item in all portals | M-06, M-16 | AC-04.1–04.3 pass; reminder emails visible in Mailpit |
| **Attendance (M-10)** | Roll-call and reporting | Trainer, Admin, Student | DP-T06, A15, S06 (widget) | Mark/correct with reason, defaults, thresholds, student calendar, admin management view | `/sessions/{id}/attendance`, `/me/attendance`, `/reports/attendance` | `attendance_records` | `attendance:mark`, `attendance:read`, `attendance:manage` | Trainer › Attendance; Admin › Attendance | M-09 | AC-05.1–05.3 pass |
| **Question bank (M-11)** | Reusable questions | Admin, Trainer (own) | DP-A18–A20, T11 | MCQ single/multi, true/false, descriptive, coding (statement, starter code, tests, limits), tags, difficulty, marks, versions, import XLSX/CSV, validation (coding via execution adapter) | `/questions/*` | `questions`, `question_options`, `coding_problems`, `test_cases`, `question_versions` | `questions:manage`, `questions:create_own` | Admin › Question bank; Trainer › Question bank | M-14 (validation), M-17 | Import with error report; coding question validated by reference solution in the available driver |
| **Assignments (M-12)** | Practice sets | Admin/Trainer, Student | DP-A16–A17, T07, S08–S10 | Wizard (questions → modules → settings → batches), unlock rules, attempts, marks, explanations, workspace per type, grading queue for descriptive, progress table | `/assignments/*`, `/questions/{id}/submissions`, `/submissions/*` | `assignments`, `assignment_modules`, `assignment_questions`, `assignment_publications`, `submissions`, `submission_results` | `assignments:manage`, `assignments:publish`, `assignments:grade`, `assignments:submit` | Assignments (all portals) | M-11, M-14, M-16 | AC-06.1–06.4 pass; coding submissions graded by browser driver marked *untrusted*, by Judge0 driver marked *trusted* |
| **Tests (M-13)** | Timed assessments | Admin/Trainer, Student | DP-A21–A23, T08–T09, S11–S14 | Builder (sections, questions, marks, shuffle, settings), schedule per batch, instructions, attempt engine (server timer, autosave, resume, palette, integrity events), auto-grading, manual grading, release, results/review, monitor | `/tests/*`, `/attempts/*` | `tests`, `test_sections`, `test_questions`, `test_schedules`, `test_attempts`, `test_answers` | `tests:manage`, `tests:schedule`, `tests:grade`, `tests:release`, `tests:attempt`, `tests:read` | Tests (all portals) | M-11, M-14, M-16 | AC-07.1–07.4 pass |
| **Practice (M-14)** | Coding-practice structure | Student | DP-S15–S16 | Problem list with filters, workspace (statement, editor, run with sample input, submit), verdict table, submissions history; execution adapter with `browser-sandbox` driver (JavaScript, Python via Pyodide) and optional `judge0` driver | `/practice/*`, `/execute` | `execution_runs`, uses M-11 tables | `practice:use` | Student › Practice | M-11 | Solve a JavaScript and a Python problem end to end in the browser driver; verdict shown; results stored with trust level; Judge0 path verified on a Linux host if available |
| **Reports (M-15)** | Admin dashboard and reports | Admin, Trainer (scoped) | DP-A01, A24–A26, T10 | Tiles: total/active students (7/30 days), batch-wise, course-wise, attendance %, completion %, assessment scores, assignment status; placeholders for future metrics; report pages with filters, charts, tables; CSV/XLSX export as jobs; definitions drawer | `/reports/*`, `/exports/*` | `report_exports`, `report_definitions`, `reporting.*` | `reports:read`, `reports:export` | Admin › Dashboard/Reports; Trainer › Reports | all | AC-01.1–01.3 pass; export row counts equal filtered totals |
| **Notifications (M-16)** | Communication | All | DP-S21, A27 | In-app centre, email via SMTP (Mailpit), preferences, announcements with audience and schedule, templates editable | `/me/notifications*`, `/announcements/*`, `/notifications/broadcast` | `notifications`, `notification_preferences`, `announcements`, `email_templates` | `notifications:read`, `announcements:manage` | Bell; Admin › Announcements | M-01 | AC-15.1–15.2 pass |
| **Profile (M-04 student side)** | Student self-service | Student | DP-S17–S20 | Sections (overview, personal, education, experience, projects list, skills), completeness, resumes (upload, default), documents with verification status | `/me/profile*`, `/me/resumes`, `/me/documents` | `student_profiles`, `resumes`, `documents` | `profile:read`, `profile:update` (own) | Student › Profile | M-17 | AC-12.1–12.3 pass |
| **Settings, branding, flags (M-18)** | White-label control | Super Admin | DP-A28–A34 | General, branding (logo, colours, fonts, favicon, login appearance), feature flags, navigation labels, taxonomies, custom fields, email templates, content pages, integrations (write-only) | `/settings/*`, `/branding`, `/flags`, `/navigation`, `/custom-fields`, `/templates`, `/content-pages` | as M-18 | `settings:manage`, `settings:read` | Admin › Settings | — | Changing branding re-themes the app without redeploy; disabling `module.tests` hides tests everywhere and blocks its API |
| **Audit & health (M-19, M-21)** | Trust and operations | Super Admin | DP-A35–A36 | Audit log viewer with filters/export; system health (DB, storage, email, queue, execution driver) | `/audit-logs`, `/admin/health` | `audit_logs` | `audit:read`, `settings:manage` | Admin › Settings | — | Every mutation endpoint produces an audit row (test) |
| **Search (M-20)** | Find things | All | utility | Command palette over courses, lessons, questions, students (staff) | `/search` | indexes | `search:use` | Utility bar | — | Only permitted items returned |

### 12.3 Deliberately out of the demo (future, per master roadmap)

SQL Lab, Web Lab, Debug Challenges, Playground with server execution (F-12b–e); Projects (F-15); Certificates (F-16); Placement portal (F-17 pages; tables and role seeded only); Feedback (F-18); Gamification (F-22); AI assistant and interviews (F-23/24); Doubts (F-27); Events (F-28); OTP login; QR attendance; hosted video providers; scheduled/PDF reports; portfolio pages. Their navigation entries exist as flags (off) so the demo can show "modules can be enabled per client".

### 12.4 Demo storyline

One institute ("Demo Institute"), one programme (Java Full-Stack), three batches (running, planned, completed), eight trainers, sixty students, six courses, one hundred and twenty questions, four assignments, three tests (one released, one live-today, one upcoming), two weeks of sessions and attendance, notifications and announcements; details in §21.

---

## 13. User Roles and Permissions

### 13.1 Demo roles and the permission catalogue

The catalogue is generated from module manifests; the demo subset (keys) is:

| Module | Permission keys |
|---|---|
| auth | `auth:self` (implicit for authenticated users) |
| rbac | `roles:read`, `roles:manage` |
| users | `users:read`, `users:manage`, `users:import` |
| students | `students:read`, `students:manage`, `students:read_sensitive`, `students:verify_documents` |
| trainers | `trainers:read`, `trainers:manage` |
| batches | `batches:read`, `batches:manage`, `programs:manage` |
| courses | `courses:read`, `courses:manage`, `courses:publish` |
| progress | `progress:read` |
| sessions | `sessions:read`, `sessions:manage`, `sessions:run` (mark live/complete, attach recording) |
| attendance | `attendance:read`, `attendance:mark`, `attendance:manage` (corrections beyond window, thresholds) |
| questions | `questions:read`, `questions:create_own`, `questions:manage`, `questions:import` |
| assignments | `assignments:read`, `assignments:submit`, `assignments:manage`, `assignments:publish`, `assignments:grade` |
| tests | `tests:read`, `tests:attempt`, `tests:manage`, `tests:schedule`, `tests:grade`, `tests:release`, `tests:monitor` |
| practice | `practice:use`, `practice:manage` |
| reports | `reports:read`, `reports:export` |
| notifications | `notifications:read`, `notifications:broadcast`, `announcements:manage` |
| profile | `profile:read`, `profile:update` |
| files | `files:upload`, `files:read` (contextual) |
| settings | `settings:read`, `settings:manage`, `branding:manage`, `flags:manage` |
| audit | `audit:read` |
| search | `search:use` |
| placement (seeded) | `placements:read`, `placements:manage`, `placements:apply` |

### 13.2 Demo role–permission matrix

Scope: **all** / **batch** (assigned batches) / **own**.

| Permission group | Super Admin | Admin | Trainer | Student | Placement Coordinator (seeded) | Content Manager (seeded) |
|---|---|---|---|---|---|---|
| roles:* | manage | read | — | — | — | — |
| users:* | manage, import | manage, import | — | — | — | — |
| students:* | manage, read_sensitive, verify_documents | manage, read_sensitive, verify_documents | read (batch) | — | read, read_sensitive, verify_documents | — |
| trainers:* | manage | manage | read (own) | — | read | — |
| batches/programs | manage | manage | read (batch) | — | read | — |
| courses | manage, publish | manage, publish | read (batch) | read (enrolled) | — | manage (no publish) |
| progress | read (all) | read (all) | read (batch) | read (own) | read (all) | — |
| sessions | manage, run | manage, run | read (batch), run (batch) | read (batch) | read | — |
| attendance | manage | manage | mark (batch), read (batch) | read (own) | read | — |
| questions | manage, import | manage, import | create_own, read | — | — | manage, import |
| assignments | manage, publish, grade | manage, publish, grade | manage (batch), publish (batch), grade (batch) | read, submit (own) | — | manage (no publish) |
| tests | manage, schedule, grade, release, monitor | same | manage (batch), schedule (batch), grade (batch), release (batch), monitor (batch) | read, attempt (own) | read results (all) | manage (no schedule) |
| practice | manage | manage | — | use | — | manage |
| reports | read, export (all) | read, export (all) | read, export (batch) | — | read, export (placement) | — |
| notifications/announcements | broadcast, manage | broadcast, manage | broadcast (batch) | read | broadcast (placement) | — |
| profile | — | — | — | read, update (own) | — | — |
| settings/branding/flags | manage | read | — | — | — | — |
| audit | read | read (own actions) | — | — | — | — |
| search | use | use | use | use | use | use |
| placements | manage (when enabled) | read | — | read, apply (when enabled) | manage | — |

### 13.3 Enforcement (unchanged from master §7.5)

Guards check permission and scope on every endpoint; scope filters are injected into queries; the web hides what the API forbids; every route declares a permission or is public (CI test); role bundles are editable by Super Admin within the catalogue; changes are audited and propagate within a minute (cache TTL).

### 13.4 Role configurability for clients

Clients may rename roles, change bundles, add roles composed from existing permissions, and restrict scopes; they cannot invent permissions (those come from modules). Role changes are data, so they survive template upgrades; a migration check warns if a permission a client role references was removed by an upgrade.

---
## 14. Complete Page Inventory

### 14.1 Standard states and behaviours (apply to every page unless overridden)

| State | Standard behaviour |
|---|---|
| Loading | Skeleton matching the final layout; tables show 5 skeleton rows; buttons disabled with spinner while an action runs |
| Empty | One sentence explaining what will appear, plus a primary action if the user may create the item; filters active → "No results for these filters" with a reset link |
| Error | Inline retry for recoverable API errors (with request ID); full-page error with reference for fatal errors; forms show field errors and a summary |
| Success | Toast naming the object and action; navigation to the created object's page for create actions; inline confirmation for saves |
| Offline | Top banner; submit actions disabled; drafts preserved (test attempts, editors) |
| Forbidden | "You don't have access" page with the portal home link; menu entries for forbidden pages are hidden |
| Not found | 404 page with search and home link |
| Mobile (≤ 768 px) | Bottom tab bar (students) or drawer (staff); tables become card lists; side panels become bottom sheets; editors and attempts full-screen |

Column legend for the tables below: **Entry → Exit** lists how users arrive and where they go next; **Components** lists forms (F), tables (T), filters (Fi) and other components; **API · Data** names endpoint groups (§18) and entities (§17); **Completion** is the page-level completion criterion in addition to the rule in §24.6.

### 14.2 Public and authentication pages

| ID | Page · Route | Role · Permission | Purpose | Entry → Exit | Components | Actions | API · Data | States & Mobile | Completion |
|---|---|---|---|---|---|---|---|---|---|
| DP-P01 | Landing `/` | Public | Branded entry; redirect signed-in users | URL → login or portal home | Logo, brand name/tagline (branding), sign-in button, footer links (content pages) | Sign in | `/branding/public` | Single column | Signed-in users never see it; branding from settings |
| DP-P02 | Sign in `/login` | Public | Authenticate | Landing, any protected deep link → role home or original deep link | F: email, password, remember me; links: forgot | Sign in | `POST /auth/login`; `users`, `sessions` | Generic error; throttle message with wait time; mobile full-screen | Wrong password generic; 5 failures throttle; deep link preserved |
| DP-P03 | Accept invitation `/invite/{token}` | Public (token) | First sign-in for invited users | Email link → role home | F: password, confirm, consent checkboxes; shows name/role | Activate | `POST /auth/invitations/{token}/accept`; `invitations` | Expired token → resend request | Token single-use; consent stored |
| DP-P04 | Forgot password `/forgot-password` | Public | Request reset | Login → login | F: email | Send | `POST /auth/password/forgot` | Always success text | No enumeration |
| DP-P05 | Reset password `/reset-password/{token}` | Public (token) | Set new password | Email link → login | F: password, confirm | Reset | `POST /auth/password/reset`; `password_resets`, `sessions` | Expired token message | All sessions revoked |
| DP-P06 | Access denied `/403` | Any | Explain forbidden access | Guard redirect → portal home | Message, home link, request ID | Go home | — | — | Shown for forbidden routes and API 403 on page load |
| DP-P07 | Not found `/404` | Any | Missing route/object | Any → home/search | Message, search, home | Search | — | — | — |
| DP-P08 | Error `/500` (error boundary) | Any | Unexpected failure | Any → retry/home | Message, reference ID, retry | Retry | — | — | Reference ID matches server log |
| DP-P09 | Content page `/pages/{slug}` | Public | Terms, privacy, help | Footer, consent links → back | Rich content | — | `GET /content-pages/{slug}`; `content_pages` | — | Editable by Super Admin |

### 14.3 Admin portal pages

| ID | Page · Route | Role · Permission | Purpose | Entry → Exit | Components | Actions | API · Data | States & Mobile | Completion |
|---|---|---|---|---|---|---|---|---|---|
| DP-A01 | Admin dashboard `/admin` | Admin, Super Admin · `reports:read` | The metrics from the customer image | Login (admin) → any tile's report page | Fi: date range, programme, batch, course, trainer; tiles (total, active 7/30, batch-wise, course-wise, attendance %, completion %, assessment scores, assignment status) with "explain" popovers; placeholders for future metrics (project, trainer performance, placement, company-wise, certificates, feedback) labelled "enable module"; attention list (low attendance, unmarked sessions, pending imports/verifications, failed jobs); charts (active students trend, attendance trend); export-all | Filter, drill down, export | `GET /reports/dashboard`; `reporting.*` | Tiles stack 2-per-row on mobile | AC-01.1–01.4 (master); "data as of" shown |
| DP-A02 | Users `/admin/users` | Admin · `users:manage` | Staff accounts | Sidebar → user detail (drawer) | T: name, email, roles, status, last login; Fi: role, status, q; F (drawer): invite user (name, email, roles) | Invite, edit roles, deactivate/reactivate, resend invitation, force sign-out | `/users/*`; `users`, `user_roles`, `invitations` | Empty: "Invite your first staff member" | Invitation email in Mailpit; deactivated user blocked |
| DP-A03 | Roles & permissions `/admin/settings/roles` | Super Admin · `roles:manage` | Bundles and matrix | Settings → back | T (matrix): permissions × roles with scope selectors; F: new role (name, description, clone from) | Toggle, set scope, create role, save | `/roles/*`, `/permissions`; `roles`, `permissions`, `role_permissions` | Warns before removing own access; desktop-first | Matrix save audited; guard cache refreshed |
| DP-A04 | Trainers `/admin/trainers` | Admin · `trainers:manage` | Trainer records | Sidebar → trainer detail | T: name, subjects, batches, status; Fi: subject, status, q | Create, edit, assign to batch | `/trainers/*`; `trainer_profiles`, `batch_trainers` | — | Assignment appears on batch and schedule |
| DP-A05 | Trainer detail `/admin/trainers/{id}` | Admin · `trainers:manage` | Profile and assignments | Trainers list → batches | F: profile (name, subjects, bio, photo); T: batch assignments; performance placeholder (future) | Save, assign/remove | `/trainers/{id}` | — | — |
| DP-A06 | Students `/admin/students` | Admin · `students:manage` | Student records | Sidebar → student detail / import | T: student code, name, batch(es), status, verification, last active, progress; Fi: batch, status, programme, verification, q; bulk bar (assign batch, message, export) | Create, import, bulk assign, export | `/students/*`; `student_profiles`, `batch_members` | Empty: import call to action | List scoped filters work; export equals filtered rows |
| DP-A07 | Student import `/admin/students/import` | Admin · `users:import` | Bulk onboarding | Students → students list | Wizard: template download, upload (CSV/XLSX), column mapping, validation preview (T: row errors), options (batch, send invites), progress | Upload, map, validate, import | `POST /students/import`, `GET /students/import/{jobId}` | Error report downloadable | AC-16.1 (master); idempotent re-import |
| DP-A08 | Student detail `/admin/students/{id}` | Admin · `students:manage` (+`students:read_sensitive`) | 360° record | Students list, search → batches, progress pages | Tabs: profile (F sections incl. custom fields), batches (T), attendance (calendar), progress, submissions (T), tests (T), documents (T with verify/reject + reason), resumes, notes, audit (T) | Edit, change status, verify documents, add note, transfer batch | `/students/{id}/*`; `student_profiles`, `documents`, `resumes`, `batch_members`, `audit_logs` | Sensitive tab hidden without permission; tabs → accordion on mobile | Every change audited; verification notifies student |
| DP-A09 | Programmes `/admin/programs` | Admin · `programs:manage` | Curriculum templates | Sidebar → programme detail (drawer) | T: name, code, duration, courses; F: programme (name, code, weeks, courses order) | Create, edit, archive | `/programs/*`; `programs`, `program_courses` | — | Batch creation offers programme courses |
| DP-A10 | Batches `/admin/batches` | Admin · `batches:manage` | Batch lifecycle | Sidebar → batch detail | T: code, name, programme, dates, mode, trainers, students, status; Fi: programme, status, trainer, date; F (dialog): new batch (programme, name/code, dates, mode, capacity) | Create, open | `/batches/*`; `batches` | — | Status counts on dashboard match |
| DP-A11 | Batch detail `/admin/batches/{id}` | Admin · `batches:manage` | Everything about a batch | Batches → students/courses/sessions | Tabs: Overview (stats, status actions); Students (T + add/remove/transfer dialogs, import into batch); Trainers (T + assign dialog with subject); Timetable (calendar + series editor F: subject, trainer, days, times, range, link, holidays); Attendance (T per session with %); Content (published courses/assignments/tests with publish dialogs); Reports (batch report links) | Add members, assign trainers, create series, reschedule/cancel occurrence, publish content, change status | `/batches/{id}/*`, `/sessions/*`, `/courses/{id}/publish`… | Conflict warnings; tabs → accordion | AC-04.1–04.2; transfer keeps history |
| DP-A12 | Courses `/admin/courses` | Admin · `courses:manage` | Course catalogue (staff) | Sidebar → builder | T: title, level, modules, lessons, duration, status, publications; Fi: status, level, subject, q | Create, open builder, duplicate, archive | `/courses/*`; `courses` | — | — |
| DP-A13 | Course builder `/admin/courses/{id}/edit` | Admin, Content Manager · `courses:manage` | Author content | Courses → publish | Outline tree (drag-drop modules/lessons; keyboard alternatives); lesson editor F (type; video upload with progress or storage/YouTube link via driver; article rich text; resources list with upload; practice question picker; completion rule; mandatory flag); course settings F (title, description, thumbnail, level, subject, tags, estimated hours); preview as student; autosave indicator | Add/reorder/delete, upload, save, preview | `PUT /courses/{id}/outline`, `/lessons/*`, `/files/uploads`, `/videos/*`; `course_modules`, `lessons`, `lesson_resources`, `files` | Upload progress and retry; desktop-first | AC-03.1; video "ready" required before publish |
| DP-A14 | Publish course `/admin/courses/{id}/publish` | Admin · `courses:publish` | Scope and version | Builder → courses | F: scope (all / programme / batches), version note; T: current publications | Publish, unpublish | `POST /courses/{id}/publish`; `course_publications` | — | Students in scope see the course within seconds |
| DP-A15 | Attendance management `/admin/attendance` | Admin · `attendance:manage` | Cross-batch attendance | Sidebar → session attendance | Fi: batch, date range, trainer, status; T: sessions with marked/unmarked, % present; per-session view (same as trainer marking with admin corrections) | Mark/correct, export, set thresholds (settings link) | `/sessions/*/attendance`, `/reports/attendance` | — | Unmarked sessions list accurate |
| DP-A16 | Assignments `/admin/assignments` | Admin · `assignments:manage` | Manage assignments | Sidebar → detail | T: title, level, modules, questions, publications, progress; Fi: status, level, batch; wizard dialog (new) | Create, publish, open | `/assignments/*` | — | — |
| DP-A17 | Assignment detail `/admin/assignments/{id}` | Admin · `assignments:manage` | Structure, publication, progress, grading | Assignments → grading | Tabs: Structure (modules/questions editor with picker from bank, unlock rules); Settings (F: attempts, explanation policy, due policy); Publications (T + publish dialog: batches, due date); Progress (T per student: solved, marks, last activity; Fi batch); Grading (queue of descriptive answers F: marks, comment) | Edit, publish, grade | `/assignments/{id}/*`, `/submissions/{id}/grade` | — | AC-06.2–06.4 |
| DP-A18 | Question bank `/admin/question-bank` | Admin · `questions:manage` | Browse questions | Sidebar → editor/import | T: title, type, subject, topic, difficulty, marks, status, version, usage; Fi: type, subject, topic, difficulty, status, author, q | New, import, open, publish, retire | `/questions/*`; `questions` | — | — |
| DP-A19 | Question editor `/admin/question-bank/{id}` (`/new`) | Admin, Content Manager, Trainer (own) · `questions:manage` or `questions:create_own` | Author any type | Bank → bank | Type selector; common F (title, body rich text, subject/topic taxonomy, difficulty, marks, negative marks, explanation, tags); type F: MCQ options (correct, explanation, shuffle), true/false, descriptive rubric; coding (languages, starter code, reference solution, T test cases: input, expected, sample/hidden, weight; limits); preview; validate (runs reference solution via available driver); version history | Save draft, validate, publish | `/questions/*`, `/questions/{id}/validate` | Validation results panel | Publish blocked until validation passes for coding |
| DP-A20 | Question import `/admin/question-bank/import` | Admin · `questions:import` | Bulk load objective questions | Bank → bank | Wizard: template, upload, mapping, preview with errors, import | Import | `POST /questions/import` | — | Error report per row |
| DP-A21 | Tests `/admin/tests` | Admin · `tests:manage` | Manage tests | Sidebar → builder | T: title, type, duration, questions, schedules, status; Fi: type, status, batch | Create, open, schedule | `/tests/*` | — | — |
| DP-A22 | Test builder `/admin/tests/{id}` | Admin · `tests:manage` | Structure and settings | Tests → schedule | Tabs: Sections (add sections, pick questions, marks/negative per question, shuffle); Settings (F: duration, attempts, integrity options, result policy, review policy); Schedules (T + F: batch, window start/end, max attempts); Results (T per student: score, rank, status; Fi batch; release button; export); Monitor (live counts, started/submitted, flags) | Save, schedule, release, export | `/tests/{id}/*` | — | AC-07.1–07.4 |
| DP-A23 | Test grading `/admin/tests/{id}/grading` | Admin · `tests:grade` | Manual grading | Builder → results | Queue of descriptive answers; F: marks, comment; navigation prev/next; progress | Grade | `PATCH /attempts/{id}/answers/{answerId}/grade` | — | Totals recalculated |
| DP-A24 | Reports index `/admin/reports` | Admin · `reports:read` | Report catalogue | Sidebar → report | Cards per report (students, attendance, progress, assessments, assignments) + future placeholders | Open | `/reports` | — | — |
| DP-A25 | Report page `/admin/reports/{name}` | Admin · `reports:read` | One report | Index → export | Fi bar (date, programme, batch, course, trainer); summary tiles; chart; T (server pagination, sort, column chooser); definitions drawer; export (CSV/XLSX) | Filter, sort, export | `GET /reports/{name}`, `POST /exports` | — | Export equals filtered view |
| DP-A26 | Exports `/admin/exports` | Admin · `reports:export` | Export job list | Toast → download | T: report, requester, status, rows, size, expires; download | Download | `/exports/*`; `report_exports` | — | Files expire (7 days) |
| DP-A27 | Announcements `/admin/announcements` | Admin · `announcements:manage` | Broadcasts | Sidebar → back | T: title, audience, window, channels; F: title, body, audience (all/programme/batch/role), start/end, channels (in-app, email) | Create, schedule, expire | `/announcements/*`; `announcements` | — | AC-15.2 |
| DP-A28 | Settings: General `/admin/settings/general` | Super Admin · `settings:manage` | Institute and academic defaults | Settings → back | F: name, contact, timezone (IST default), locale; academic defaults: attendance threshold, statuses counted, correction window, completion %, attempt limits, negative marking default, result release default | Save | `PATCH /settings`; `settings` | — | Applied without restart; audited |
| DP-A29 | Settings: Branding `/admin/settings/branding` | Super Admin · `branding:manage` | White-label appearance | Settings → preview | F: brand name, tagline, logo (light/dark), favicon, primary/accent colours (with contrast check), font choices (from allowed list or self-hosted upload), radius/density, login layout variant, background image, welcome text, email footer; live preview of login and dashboard | Save, preview | `PATCH /branding`; `branding_settings`, `files` | — | Theme changes reflected app-wide on next load without redeploy |
| DP-A30 | Settings: Feature flags `/admin/settings/feature-flags` | Super Admin · `flags:manage` | Enable/disable modules and options | Settings → back | T: flag, description, enabled, audience (roles/batches) | Toggle | `PATCH /flags/{key}`; `feature_flags` | — | Disabled module hidden and API blocked (test) |
| DP-A31 | Settings: Navigation `/admin/settings/navigation` | Super Admin · `settings:manage` | Labels, order, visibility per portal | Settings → back | Per-portal list with rename, reorder (drag or arrows), hide, icon | Save, reset to defaults | `PATCH /navigation`; `navigation_config` | — | Labels update in all portals |
| DP-A32 | Settings: Taxonomies & custom fields `/admin/settings/fields` | Super Admin · `settings:manage` | Categories and custom fields | Settings → back | T: taxonomies (subjects, levels, course categories, skills) with terms; T: custom field definitions per entity (label, type, required, options, visibility) | Add/edit/archive | `/taxonomies/*`, `/custom-fields/*` | — | Custom field appears on the entity's form and export |
| DP-A33 | Settings: Templates & content `/admin/settings/templates` | Super Admin · `settings:manage` | Email templates and content pages | Settings → back | T: templates with variables; editor with preview and test send; T: content pages with rich editor | Edit, test send, publish | `/templates/*`, `/content-pages/*` | — | Test email arrives in Mailpit |
| DP-A34 | Settings: Integrations `/admin/settings/integrations` | Super Admin · `settings:manage` | Providers (email, storage, video, execution, AI placeholders) | Settings → back | Provider cards with write-only secret fields, driver selection, test buttons, status | Save, test | `/integrations/*`; `integration_configs` | Secrets never displayed | Test probes real provider |
| DP-A35 | Audit log `/admin/settings/audit-log` | Super Admin · `audit:read` | Who did what | Settings → record | T: time, actor, action, resource, summary; Fi: actor, action, resource type, date; detail drawer with before/after | Filter, export | `/audit-logs`; `audit_logs` | — | Append-only |
| DP-A36 | System health `/admin/settings/system-health` | Super Admin · `settings:manage` | Operational status | Settings → jobs | Cards: database, storage, email, queue (depth, failed jobs, retry), execution driver, version; T: recent failed jobs | Retry job | `/admin/health`, `/admin/jobs/{id}/retry` | — | Failed job retry works |

### 14.4 Trainer portal pages

| ID | Page · Route | Role · Permission | Purpose | Entry → Exit | Components | Actions | API · Data | States & Mobile | Completion |
|---|---|---|---|---|---|---|---|---|---|
| DP-T01 | Trainer dashboard `/trainer` | Trainer · self | Day view | Login (trainer) → sessions, grading, doubts placeholder | Today's sessions (start/join, mark attendance); pending grading count; batch health cards (attendance %, assignment completion, last test average); at-risk students list; announcements | Start, mark, grade | `GET /trainer/dashboard` | Sessions first on mobile | Only own batches; counts match detail pages |
| DP-T02 | Schedule `/trainer/schedule` | Trainer · `sessions:read` (batch) | Teaching calendar | Dashboard → session | Week view default + agenda; session cards; conflict badges; F: attach recording (file/link); request change (note to admin) | Mark live/complete, attach recording | `/trainer/sessions`, `POST /sessions/{id}/status`, `/sessions/{id}/recording` | Agenda on mobile | Recording creates a lesson in the batch's course |
| DP-T03 | Batches `/trainer/batches` | Trainer · `batches:read` (batch) | Own batches | Sidebar → batch | Cards: batch, students, attendance %, progress, next session | Open | `/trainer/batches` | — | — |
| DP-T04 | Batch detail `/trainer/batches/{id}` | Trainer · `batches:read` (batch) | Roster and health | Batches → student | Tabs: Students (T: name, attendance %, progress, last active, avg score; Fi q, sort); Attendance (T per session); Assignments (T progress); Tests (T results); Content (published items) | Open student, export (batch) | `/trainer/batches/{id}/*` | Cards on mobile | Sort by any metric; export matches |
| DP-T05 | Student (batch scope) `/trainer/students/{id}` | Trainer · `students:read` (batch) | Student view without sensitive data | Batch → back | Summary, attendance calendar, progress, submissions (T), tests (T), notes (staff-private F) | Add note, notify student | `/trainer/students/{id}` | — | Sensitive fields absent |
| DP-T06 | Attendance marking `/trainer/sessions/{id}/attendance` | Trainer · `attendance:mark` (batch) | Roll-call | Dashboard/schedule → dashboard | List of students (default present), status chips, search, bulk actions, notes F; correction mode (reason F) within window | Mark, submit, correct | `PUT /sessions/{id}/attendance` | Large targets; one column | AC-05.1–05.3 |
| DP-T07 | Assignments `/trainer/assignments` (+ `/{id}`) | Trainer · `assignments:manage` (batch) | Publish and monitor to own batches | Sidebar → grading | Same as DP-A16/A17 limited to own batches | Create, publish, grade | `/assignments/*` | — | — |
| DP-T08 | Tests `/trainer/tests` (+ `/{id}`) | Trainer · `tests:manage` (batch) | Schedule, monitor, results | Sidebar → grading | Same as DP-A21/A22 limited to own batches | Create, schedule, release | `/tests/*` | — | Monitor refreshes every 10 s |
| DP-T09 | Grading `/trainer/tests/{id}/grading` | Trainer · `tests:grade` (batch) | Manual grading | Tests → results | Same as DP-A23 | Grade | — | — | — |
| DP-T10 | Reports `/trainer/reports` | Trainer · `reports:read` (batch) | Batch reports | Sidebar → export | Same report pages with forced batch scope | Filter, export | `/reports/*` | — | Scope enforced |
| DP-T11 | Question bank (own) `/trainer/question-bank` | Trainer · `questions:create_own` | Author own questions | Sidebar → editor | Same as DP-A18/A19 filtered to own | Create, edit own | `/questions/*` | — | Own questions usable in own assignments/tests |
| DP-T12 | Trainer profile `/trainer/profile` | Trainer · own | Profile | Menu → back | F: name, photo, subjects, bio; sessions list | Save | `/trainers/me` | — | — |

### 14.5 Student portal pages

| ID | Page · Route | Role · Permission | Purpose | Entry → Exit | Components | Actions | API · Data | States & Mobile | Completion |
|---|---|---|---|---|---|---|---|---|---|
| DP-S01 | Student dashboard `/dashboard` | Student · self | Daily starting point | Login (student) → session, lesson, assignment, test | Today band (sessions with join, deadlines); continue-learning cards; progress tiles (overall, courses, assignments, tests with explain); tasks due (T); announcements; attendance summary | Join, resume, open task | `GET /me/dashboard` | Stacked; today first | AC-02.1–02.3 |
| DP-S02 | My courses `/courses` | Student · `courses:read` | Enrolled catalogue | Sidebar → course | Tabs (All / In progress / Completed with counts); search; cards (thumbnail, modules, duration, progress, next lesson) | Open | `GET /me/courses` | Cards | Progress equals course page |
| DP-S03 | Course details `/courses/{courseId}` | Student · `courses:read` | Overview and curriculum | Courses → lesson | Header (progress ring, trainer, resume button); tabs Overview / Curriculum (accordion: lessons with type, duration, status, lock) / Resources | Start/resume, open lesson | `GET /courses/{id}`, `/courses/{id}/progress` | Accordion collapsed | Locked modules show rule |
| DP-S04 | Course player `/courses/{courseId}/lessons/{lessonId}` | Student · `courses:read` | Consume lesson | Course → next lesson / practice | Video player (signed URL, speed, resume, captions if provided) or article view; resources list; inline practice question link; up next; curriculum sidebar/drawer; mark complete | Play, complete, next, download | `GET /lessons/{id}`, `POST /lessons/{id}/progress`, `GET /files/{id}/url` | Full-width video; drawer on mobile | Resume ±10 s; auto-complete at configured % |
| DP-S05 | Lesson practice `/courses/{courseId}/lessons/{lessonId}/practice` | Student · `assignments:submit` | Inline practice question | Player → player | Question workspace (same component as DP-S10) | Submit | `/questions/{id}/submissions` | — | Completion feeds lesson progress |
| DP-S06 | Learning progress `/progress` | Student · `progress:read` (own) | Progress detail | Sidebar → course/assignment/test | Tiles; per-course progress list; assignment progress list; test history summary; attendance calendar (per subject filter) and %; activity feed | Open item | `GET /me/progress`, `/me/attendance` | — | Numbers agree with sources |
| DP-S07 | Schedule `/schedule` | Student · `sessions:read` | Calendar | Sidebar → join | Month/week/agenda; programme filter; session chips with time, trainer, join button (15 min before), recording link after | Join, open recording | `GET /me/schedule` | Agenda default on mobile | Times in IST; cancelled sessions marked |
| DP-S08 | Assignments `/assignments` | Student · `assignments:read` | Practice sets | Sidebar → assignment | Stats header (overall %, solved/total, marks); tabs; search; cards (level, modules, questions, marks, progress, due) | Open | `GET /me/assignments` | Cards | Overdue badge |
| DP-S09 | Assignment detail `/assignments/{id}` | Student · `assignments:read` | Modules and questions | Assignments → question | Header stats; module rail with lock state and rule; question list (title, type, difficulty, marks, attempts, time, status, bookmark); review mode | Open, review | `GET /assignments/{id}/me` | Segmented rail on mobile | Lock rule explained |
| DP-S10 | Question workspace `/assignments/{id}/q/{questionId}` | Student · `assignments:submit` | Answer a question | Assignment → next question | MCQ options; descriptive editor; coding editor (language, run with sample/custom input, submit, verdict table with trust badge); explanation after solve; prev/next; report issue | Submit, run, bookmark | `POST /questions/{id}/submissions`, `GET /submissions/{id}` (SSE) | Tabs Problem/Code/Output on mobile | Attempts, time, marks recorded; locked/over-limit blocked |
| DP-S11 | Tests `/tests` | Student · `tests:read` | Test list | Sidebar → instructions/result | Tabs Upcoming / Live / History (counts); Fi subject; cards (name, type, window, duration, status, result, review) | Start, view result | `GET /me/tests` | Cards | Only in-window startable |
| DP-S12 | Test instructions `/tests/{id}` | Student · `tests:attempt` | Pre-test | Tests → attempt | Instructions, sections, marks scheme, rules, connectivity check, start | Start | `POST /tests/{id}/attempts` | — | One active attempt |
| DP-S13 | Test attempt `/tests/{id}/attempt` | Student · `tests:attempt` (own) | Timed attempt | Instructions → result/submitted page | Server-synced timer; section tabs; palette; question pane (all types); autosave indicator; submit dialog; full-screen prompt; tab-switch counter | Answer, flag, submit | `PATCH /attempts/{id}/answers`, `POST /attempts/{id}/submit`, `GET /attempts/{id}/state` | Full-screen; palette as sheet | AC-07.1–07.4 |
| DP-S14 | Results `/tests/{id}/result` | Student · `tests:read` (own, released) | Score and review | Tests → review | Score card, section scores, rank (if enabled), per-question review (policy), time per question | Review | `GET /attempts/{id}/result` | Stacked | Hidden until release |
| DP-S15 | Coding practice `/practice` | Student · `practice:use` | Problem list | Sidebar → problem | Summary (solved, attempted); Fi: topic, difficulty, language, status; search; T/list (title, difficulty, points, status) | Open | `GET /practice/problems` | List | Filters in URL |
| DP-S16 | Practice workspace `/practice/{slug}` | Student · `practice:use` | Solve | List → next | Statement (markdown, examples, constraints); editor; language (JavaScript, Python in browser driver; more with Judge0); run/submit; results per sample test (hidden tests as pass/fail counts) with trust badge ("verified in browser" vs "verified by server"); submissions history | Run, submit, reset | `POST /practice/problems/{id}/submissions`, `/execute` | Tabbed on mobile | Solve JS and Python problems end to end |
| DP-S17 | Profile `/profile` | Student · `profile:read` | View profile | Menu → edit | Header (photo, completeness); tabs Overview / Personal / Education / Experience / Projects / Skills / Documents; verification status | Edit section | `GET /me/profile` | Accordion on mobile | Completeness correct |
| DP-S18 | Profile edit `/profile/edit/{section}` | Student · `profile:update` | Edit one section | Profile → profile | Section F (incl. custom fields), consent text for sensitive fields, save/cancel | Save | `PATCH /me/profile/{section}` | Full-screen form | Inline validation |
| DP-S19 | Resumes `/profile/resumes` | Student · `profile:update` | Manage resumes | Profile → back | Upload (PDF ≤ 2 MB), list, set default, remove | Upload, default | `/me/resumes` | List | AC-12.1 |
| DP-S20 | Documents `/profile/documents` | Student · `profile:update` | Verification documents | Profile → back | Upload per type; status (pending/verified/rejected + reason) | Upload | `/me/documents` | List | Rejection reason visible |
| DP-S21 | Notifications `/notifications` | Student · `notifications:read` | Centre | Bell → target | List (unread first); Fi type; mark read/all; preferences link | Open, mark read | `/me/notifications*` | List | Badge equals unread |
| DP-S22 | Notification preferences `/settings/notifications` | Any · own | Channels | Menu → back | Matrix category × channel | Save | `/me/notification-preferences` | — | Honoured by sender |
| DP-S23 | Search `/search?q=` | Any · `search:use` | Results | Palette → item | Grouped results | Open | `GET /search` | List | Permitted items only |
| Future | Projects `/projects`, Certificates `/certificates`, Placements `/placements`, Assistant `/assistant`, Bookmarks `/bookmarks`, Labs `/practice/sql|web|debug`, Playground `/playground` | — | **Future pages** (master P-C13–C22, C28, C30–C34) | — | Navigation entries exist but hidden by flags | — | — | — | Not in demo |

### 14.6 Page count

Public/auth 9, Admin 36, Trainer 12, Student 23 → **80 demo pages**, plus the future pages listed above.

---
## 15. Navigation and User Journeys

### 15.1 Navigation maps

**Student portal** (bottom tab bar on phones: Home · Courses · Practice · Tests · More)

| Menu item | Route | Leads to | Opens modal / page |
|---|---|---|---|
| Dashboard | `/dashboard` | Session join (external link), lesson player, assignment, test instructions, announcement detail (drawer) | Announcement: drawer |
| Schedule | `/schedule` | Join link; recording lesson | Session detail: bottom sheet |
| Courses | `/courses` → `/courses/{id}` → `/courses/{id}/lessons/{lid}` → `/…/practice` | Player, inline practice | Resource download: direct |
| Assignments | `/assignments` → `/assignments/{id}` → `/assignments/{id}/q/{qid}` | Workspace | Report issue: modal |
| Tests | `/tests` → `/tests/{id}` → `/tests/{id}/attempt` → `/tests/{id}/result` | Attempt (full-screen), result | Submit confirmation: modal |
| Practice | `/practice` → `/practice/{slug}` | Workspace | — |
| Progress | `/progress` | Course/assignment/test pages | — |
| Profile (menu) | `/profile` → `/profile/edit/{section}`, `/profile/resumes`, `/profile/documents` | — | Photo crop: modal |
| Notifications (bell) | dropdown → `/notifications` | Target page | — |
| Search (⌘K) | palette → item | — | Palette: modal |
| Settings (menu) | `/settings/notifications` | — | — |
| Sign out (menu) | `/logout` | `/login` | — |

**Trainer portal** (sidebar; drawer on phones)

| Menu item | Route | Leads to | Modals |
|---|---|---|---|
| Dashboard | `/trainer` | Attendance marking, grading, schedule | — |
| Schedule | `/trainer/schedule` | Session sheet → attendance marking; attach recording | Attach recording: modal; request change: modal |
| Batches | `/trainer/batches` → `/trainer/batches/{id}` → `/trainer/students/{id}` | Student view | Note: drawer |
| Assignments | `/trainer/assignments` → `/{id}` (tabs) | Grading queue | New assignment: wizard (page) |
| Tests | `/trainer/tests` → `/{id}` (tabs) → `/{id}/grading` | Monitor, results | Schedule: modal; release: confirm |
| Attendance | `/trainer/schedule` (today) → `/trainer/sessions/{id}/attendance` | — | Correction reason: inline |
| Reports | `/trainer/reports` → report page | Export | — |
| Question bank | `/trainer/question-bank` → editor | — | — |
| Profile | `/trainer/profile` | — | — |

**Admin portal** (sidebar; grouped: People · Learning · Assessment · Operations · Settings)

| Group | Items → routes |
|---|---|
| Home | Dashboard `/admin` |
| People | Users `/admin/users`; Students `/admin/students` (→ `/import`, `/{id}`); Trainers `/admin/trainers` (→ `/{id}`) |
| Learning | Programmes `/admin/programs`; Batches `/admin/batches` (→ `/{id}` tabs); Courses `/admin/courses` (→ `/{id}/edit`, `/{id}/publish`) |
| Assessment | Question bank `/admin/question-bank` (→ `/new`, `/{id}`, `/import`); Assignments `/admin/assignments` (→ `/{id}`); Tests `/admin/tests` (→ `/{id}`, `/{id}/grading`) |
| Operations | Attendance `/admin/attendance`; Reports `/admin/reports` (→ `/{name}`); Exports `/admin/exports`; Announcements `/admin/announcements` |
| Settings (Super Admin sections marked) | General; Branding*; Feature flags*; Navigation*; Fields & taxonomies*; Templates & content*; Integrations*; Roles*; Audit log*; System health* |

Modals in admin: invite user, new batch, add members, assign trainer, series editor (page section), publish dialogs, schedule test, release confirm, verify/reject document (reason), retry job.

### 15.2 Navigation behaviours

| Behaviour | Rule |
|---|---|
| Breadcrumbs | Staff portals show breadcrumbs from the portal home (e.g. Batches › JFS-2026-B1 › Timetable); student portal uses back links and page titles instead |
| Sidebar | Collapsible to icons with tooltips; state remembered per user (local storage); active item highlighted; groups collapsible |
| Mobile | Students: bottom tabs (5) + "More" sheet; staff: hamburger drawer; full-screen modes for player, workspace, attempt |
| Permission-based visibility | Navigation built from module manifests filtered by the user's effective permissions and flags; hidden items are also blocked by the API |
| Disabled modules | Not rendered; direct navigation shows a "This feature is not enabled" page (distinct from 403) |
| Deep links | Unauthenticated deep link → login → return to the link; wrong-role deep link → 403 with link to own portal |
| Unauthorized routes | Route guards (server-side layout check) plus API 403 handling; audit entry for repeated 403s (rate-limited) |
| Return paths | Create flows return to the created object; wizard cancel returns to the list; drawers keep list state (filters in URL) |
| Keyboard | ⌘/Ctrl+K search; `?` shows shortcuts; all menus focusable |

### 15.3 User journeys

Each journey is written to be logically complete from entry to a verifiable end state, including the API calls and events involved.

**J-01 Admin creates a student.** Admin signs in → Students → "New student" → form (name, email, mobile, programme/batch optional, custom fields) → save → `POST /students` creates user (invited) + student profile → invitation email queued (`user.invited` → notifications job) → email visible in Mailpit → student opens `/invite/{token}` → sets password, accepts consent → `POST /auth/invitations/{token}/accept` → session created → redirected to `/dashboard` (empty state guidance) → admin sees status "active" and audit entries. *Alternative*: bulk import (DP-A07) with validation report and invitations. *Failure branches*: duplicate email → 409 shown inline; email provider down → invitation "pending" with retry.

**J-02 Admin creates a batch.** Batches → "New batch" → choose programme, name/code, dates, mode, capacity → `POST /batches` → batch detail → Students tab → add from list or import → `POST /batches/{id}/members` (state: enrolled) → Trainers tab → assign trainer with subject → `PUT /batches/{id}/trainers` → Timetable tab → create series (Mon–Fri 10:00–11:30, 4 weeks, holidays) → `POST /batches/{id}/timetable` → occurrences generated (conflict check) → Content tab → publish programme courses to batch → `POST /courses/{id}/publish` (scope batch) → status "running" → students receive "batch started" notification and see courses and schedule. *End state*: dashboard batch-wise tile counts the batch; trainer dashboard shows sessions.

**J-03 Admin creates a course.** Courses → "New course" → settings (title, level, subject, thumbnail) → builder → add module → add video lesson (upload MP4 → presigned upload → `POST /files/uploads/{id}/complete` → video driver marks ready) → add article lesson (rich text) → add resources (PDF) → add practice lesson (pick coding question) → set completion rules → preview as student → publish (scope: programme) → `course.published` event → enrolments derived for students in scope → course appears in students' catalogue with "Ready to start".

**J-04 Trainer manages a batch.** Trainer signs in → dashboard shows today's session and batch health → Batches → batch detail → Students tab sorted by attendance → open a low-attendance student → add staff note → notify student (in-app + email) → Assignments tab: publish an existing assignment to the batch with a due date → Tests tab: schedule the weekly test for Friday → Content tab: confirm published courses → back to dashboard: pending grading count updated after students submit.

**J-05 Trainer marks attendance.** Session ends → dashboard "Mark attendance" → roll-call page (all present) → toggle 3 absent, 1 late with note → submit → `PUT /sessions/{id}/attendance` → `attendance.marked` event → progress/report aggregates update → students below threshold flagged on next weekly job → next day trainer corrects one record (reason required, within 48 h) → audit entry with before/after → admin attendance report shows corrected values.

**J-06 Trainer creates an assignment.** Assignments → "New" → wizard step 1 pick questions from bank (filter Java, Beginner) → step 2 group into modules with unlock rule (previous ≥ 60%) → step 3 settings (3 attempts, explanation after solve, marks) → step 4 publish to own batch with due date → `POST /assignments` + `POST /assignments/{id}/publish` → students notified → Progress tab shows 0/40 → after submissions, descriptive answers appear in Grading queue → trainer grades → marks visible to students.

**J-07 Student joins a course.** Student receives "new course available" notification → Courses list shows the course → opens course overview → curriculum shows module 1 unlocked → clicks "Start" → player opens lesson 1 → enrolment record exists (derived on first access or at publication) → progress 0% → course appears in "Continue learning" on dashboard after first lesson activity.

**J-08 Student watches a lesson.** Player → video plays from signed URL → position saved every 10 s (`POST /lessons/{id}/progress`) → at 90% watched, lesson auto-completes (`lesson.completed`) → "Up next" prompts the article lesson → student downloads a resource (presigned URL, audited for sensitive docs only) → module progress updates in sidebar → course progress on dashboard equals player value → closing and reopening resumes at the saved position.

**J-09 Student submits an assignment.** Assignments → assignment → module 1 → MCQ question → answer → `POST /questions/{id}/submissions` → graded instantly → explanation shown (policy) → next: coding question → run with sample input in browser driver → submit → results per test with "verified in browser" badge (or "verified by server" with Judge0) → marks recorded → module 1 reaches 60% → module 2 unlocks → descriptive question → submitted, status "awaiting grading" → trainer grades (J-06) → notification "graded" → assignment progress and marks update everywhere.

**J-10 Student takes a test.** Tests → Upcoming card becomes "Start" within window → instructions page (rules, sections, connectivity check) → Start → `POST /tests/{id}/attempts` → attempt page with server deadline → answers autosaved (`PATCH /attempts/{id}/answers`) → connection dropped for 1 minute → reload restores answers and timer → coding question run/submit via adapter → submit dialog → `POST /attempts/{id}/submit` → objective questions auto-graded, descriptive queued → "Submitted" confirmation; results hidden until release. *Failure branches*: deadline reached → auto-submit job; second tab → 409 "attempt already active".

**J-11 Student views results.** Trainer releases results (`POST /tests/{id}/release`) → `test.released` event → students notified → Tests › History card shows score → result page: total, section scores, rank (if enabled), per-question review per policy → student opens review of a wrong answer with explanation → progress page shows the test in history → admin assessment-scores tile includes the test.

**J-12 Admin views reports.** Admin dashboard with default filters → tile "Attendance" → attendance report (batch filter) → sorts by % → exports XLSX (`POST /exports`) → job runs (embedded worker) → notification with download link → file matches filtered rows → back to dashboard → change date range → tiles recompute (aggregates + live queries) → "data as of" stamp updated.

---

## 16. UI/UX and Design-System Plan

### 16.1 Design principles

Unchanged from master §11.1: today first; one shell, four portals; phone-first for students, desktop-first for staff; explain every number; low-bandwidth respect; accessible by default; calm and professional; consistent state feedback. Added for the template: **brand-neutral core** — no colour, font or copy is hard-coded; every visible brand element comes from tokens or settings.

### 16.2 Layout and grid

- App shell: sidebar 240 px (72 px collapsed) at ≥ 1024 px; top bar 56 px; content padding 24 px desktop / 16 px mobile; max content width 1280 px (tables), 960 px (reading), full width (editors, attempts).
- Grid: 12 columns, 24 px gutters desktop, 16 px mobile; dashboard tiles 3–4 per row desktop, 2 per row mobile.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px (`--space-1…8`).
- Density: comfortable default; compact toggle for staff tables (row height 36 px vs 44 px).

### 16.3 Typography

Roles: display (page titles), heading, body, label, code. Default faces: UI **IBM Plex Sans** (self-hosted), code **JetBrains Mono**; clients may choose from an allowed list (system stack, Inter, Manrope, Plex, Source Sans, Noto Sans for Indic scripts) or upload licensed fonts. Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 px; line height 1.5 body, 1.25 headings; tabular numerals in tables and timers.

### 16.4 Colour system and theme tokens

Token contract (CSS variables, defined for light and dark; branding sets the seed values and the system derives the rest with contrast checks):

| Token | Purpose | Derived from |
|---|---|---|
| `--brand-primary`, `--brand-primary-foreground` | Primary actions, active navigation, links, progress | Branding primary colour |
| `--brand-accent` | Highlights, badges | Branding accent (optional; defaults to primary) |
| `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted` | Neutrals tinted toward the primary | Generated from primary hue with fixed lightness steps |
| `--success`, `--warning`, `--danger`, `--info` (+ `-soft`, `-foreground`) | Semantic status only (never brand) | Fixed palette, contrast-checked against surfaces |
| `--radius-sm/md/lg`, `--density` | Shape and density | Branding radius/density choice |
| `--font-ui`, `--font-code` | Fonts | Branding font choice |
| `--chart-1…6` | Chart series | Generated from primary/accent with distinct hues |

Rules: minimum contrast 4.5:1 for text and 3:1 for UI components is validated when branding is saved (the form blocks failing combinations and suggests corrected values); dark theme is generated from the same seeds with adjusted lightness, never inverted; semantic colours are never overridden by brand colours.

### 16.5 Component standards

| Component | Standard |
|---|---|
| Buttons | Variants primary / secondary / ghost / destructive / link; sizes sm/md/lg; loading state; icon+label; one primary per view |
| Inputs | Label above; helper and error text; required marker; masks for phone/date; tag input for skills; select with search; file input with type/size hints and progress |
| Tables | Server pagination (25/50/100), sortable headers, column filters, column chooser, sticky header, row selection with bulk bar, empty and error states, export; cards on mobile |
| Cards | Consistent padding (16/24), one radius token, shadow only for elevated interactive cards; stat tiles with label, value, delta and explain popover |
| Modals / sheets | Modal for short confirmations and small forms; side sheet for details on desktop; bottom sheet on mobile; destructive actions need typed confirmation for irreversible operations; focus trap; Esc closes |
| Tabs | Underline tabs with counts; URL-synced; scrollable on mobile |
| Badges / chips | Status chips with semantic colour + icon + text; verdict chips (Accepted, Wrong answer, TLE, …); trust badge for practice results |
| Alerts | Inline alerts (info/success/warning/danger) with optional action; page-level banners (offline, staging environment) |
| Toasts | Bottom-right (desktop) / top (mobile), 5 s, max 3 stacked, dismissible, action link |
| Dropdowns / menus | Radix menus; keyboard navigable; icons + labels; destructive items separated |
| Sidebars / navigation | Grouped items, active state, collapse, tooltips when collapsed, permission-filtered, badge counts (pending grading, unread) |
| Charts | Recharts with token colours; axis labels; tooltips; table alternative toggle; empty state |
| Progress indicators | Linear bars (course, assignment), rings (overall, course completion), stepper (wizards), timers (large, accessible) |
| Empty states | Icon-free text + action; illustration optional per client (asset) |
| Loading skeletons | Layout-matching skeletons; never spinner-only for lists |
| Error states | Inline retry; form summary; full-page with reference ID |
| Mobile layouts | Bottom tabs; sheets; full-screen modes; 44 px targets; sticky primary actions |
| Accessibility | WCAG 2.2 AA; focus visible; skip links; labels; live regions (autosave, timer at 5 and 1 minutes); reduced motion; colour never the only signal; axe in CI |

### 16.6 Page templates (composites)

`ListPage` (header + filters + table/cards + bulk bar), `DetailPage` (header + tabs), `WizardPage` (steps + summary), `DashboardPage` (attention band + tiles + charts + lists), `PlayerPage` (media + sidebar/drawer), `WorkspacePage` (split panes / tabs), `AttemptPage` (full-screen with palette), `SettingsPage` (sections with save bar), `AuthPage` (branded single column).

### 16.7 White-label theming mechanism

1. Branding settings (DP-A29) store seeds: brand name, logos (light/dark), favicon, primary/accent, fonts, radius, density, login variant, background, welcome text.
2. The API exposes `GET /branding/public` (cached, ETag) with computed tokens for light and dark.
3. The web app injects tokens as CSS variables in the root layout on the server (no flash), loads the chosen font (self-hosted files from storage or system stack), and sets `<title>`, favicon and manifest from branding.
4. Components use tokens only; a lint rule forbids hard-coded colours in `apps/web` and `packages/ui`.
5. Email templates use the same seeds through a small inline-CSS token set.
6. Changing branding therefore re-themes every page, email and the login screen without code changes or redeploys; a preview endpoint renders the login and dashboard with unsaved seeds.

---
## 17. Database Architecture

### 17.1 Conventions (as master §14.1, plus template additions)

UUID v7 primary keys; `created_at`, `updated_at`, `created_by`, `updated_by` on every mutable table; `deleted_at` soft delete on user-facing entities (users, students, trainers, batches, courses, questions, assignments, tests, drives); explicit `status` columns backed by PostgreSQL enums; foreign keys with `ON DELETE RESTRICT` (cascades only for pure child rows such as options and test cases); every foreign key indexed; JSONB payloads carry `schema_version`; all timestamps `timestamptz` in UTC; plain PostgreSQL features only so the same migrations run on Neon, Supabase, RDS or a container.

### 17.2 Client/tenant strategy

| Option | Description | Isolation | Complexity | Cost per client | Fit for demo | Fit for white-label |
|---|---|---|---|---|---|---|
| A. Single-client architecture (no tenant concept) | One code base, one database, institute identity hard-coded | Strong by deployment | Lowest | One deployment | Fits | Poor: customisation by code edits |
| **B. Configuration-based reusable deployment (one instance + one database per client)** | Same template deployed per client; all client specifics in configuration tables and an overlay; an `organizations` row anchors settings | **Strong** (separate databases, separate storage prefixes/buckets, separate secrets) | Low | One small deployment (can share a host with Compose projects) | **Fits** | **Good**: no forks, isolated data, independent upgrades |
| C. Multi-tenant shared database with `organization_id` | One deployment serves many clients; every scoped table carries `organization_id`; row-level filtering | Logical only (bugs can leak data) | High (every query, index, job, export, search, file path) | Lowest per client | Not needed | Only for a hosted SaaS model with many small clients |
| D. Separate database per client behind one deployment | One app, connection switched per request by tenant | Strong data isolation, shared runtime | Medium–high (connection routing, migrations × N) | Medium | Not needed | Possible later |

**Recommendation: Option B** for the demo and the first white-label deployments. **Tenant-ready conventions** so C or D can be adopted later without rewriting: an `organizations` table with exactly one row now; no table stores institute identity except through `organizations`; all settings/branding/flags/navigation/custom fields reference `organization_id`; storage keys and search indexes are prefixed by organisation key; a `TenantContext` service exists (returns the single organisation now) and is the only place that would change when a resolver-by-host is added; no unique constraints that would break with multiple organisations (e.g. `users.email` unique is acceptable now and would become `(organization_id, email)` in a migration).

### 17.3 Core entities for the template (demo subset)

Master §14.2 remains the full catalogue. The demo implements the following (grouped by module); fields listed are the important ones.

| Entity | Key fields | Foreign keys | Unique / indexes | Status field | Soft delete | Audited |
|---|---|---|---|---|---|---|
| `organizations` | key, name, timezone, locale, settings_version | — | unique(key) | active | no | yes |
| `users` | email, mobile, password_hash, name, avatar_file_id, email_verified_at, last_login_at | avatar → files | unique(email); unique(mobile) nullable; idx(status) | invited/active/suspended/deactivated | yes | yes |
| `invitations` | user_id, token_hash, expires_at, accepted_at, role_keys[] | user | unique(token_hash) | pending/accepted/expired | no | yes |
| `password_resets` | user_id, token_hash, expires_at, used_at | user | unique(token_hash) | — | no | yes |
| `sessions` | user_id, refresh_token_hash, device_label, ip, user_agent, expires_at, revoked_at | user | idx(user_id), idx(expires_at) | — | no | login/logout events |
| `roles` | key, name, description, is_system | organization | unique(org, key) | — | no | yes |
| `permissions` | key, resource, action, module_key, description | — | unique(key) | — | no | seeded |
| `role_permissions` | role_id, permission_id, scope | role, permission | pk(role, permission) | — | no | yes |
| `user_roles` | user_id, role_id, granted_by | user, role | pk(user, role) | — | no | yes |
| `student_profiles` | user_id, student_code, personal JSONB, education JSONB[], experience JSONB[], links JSONB, summary, skills_declared text[], completeness_score, verification_status, custom JSONB | user | unique(user_id); unique(student_code); idx(status); GIN(personal) | prospect/enrolled/active/completed/alumni/dropped | via user | yes (sensitive gated) |
| `documents` | student_id, type, file_id, status, reviewed_by, reason | student, file, user | idx(student_id, type) | pending/verified/rejected | no | yes |
| `resumes` | student_id, file_id, title, is_default, source | student, file | idx(student_id); partial unique(student_id) where is_default | — | no | yes |
| `trainer_profiles` | user_id, subjects text[], bio | user | unique(user_id) | — | via user | yes |
| `programs` | code, name, duration_weeks, description | organization | unique(code) | active/archived | yes | yes |
| `program_courses` | program_id, course_id, position | program, course | unique(program_id, position) | — | no | — |
| `batches` | program_id, code, name, mode, start_date, end_date, capacity, custom JSONB | program | unique(code); idx(status, start_date) | planned/running/completed/archived | yes | yes |
| `batch_members` | batch_id, student_id, joined_at, left_at, reason, is_active | batch, student | unique(batch_id, student_id, joined_at); partial idx active | — | no | yes |
| `batch_trainers` | batch_id, trainer_id, subject, role | batch, trainer | unique(batch_id, trainer_id, subject) | — | no | yes |
| `courses` | title, slug, description, thumbnail_file_id, level_term_id, subject_term_id, tags text[], estimated_minutes, current_version, owner_id, custom JSONB | taxonomy terms, file, user | unique(slug); tsvector idx | draft/published/archived | yes | publish |
| `course_modules` | course_id, title, position, unlock_rule JSONB | course | unique(course_id, position) | — | no | content versions |
| `lessons` | module_id, title, type, position, duration_seconds, content JSONB, video_ref JSONB (driver, key), question_id, session_id, completion_rule, is_mandatory | module, question, session | unique(module_id, position); idx(type) | — | no | content versions |
| `lesson_resources` | lesson_id, file_id, url, title, position | lesson, file | idx(lesson_id) | — | no | — |
| `course_publications` | course_id, scope_type, scope_id, version, published_by, published_at, unpublished_at | course | unique active(course, scope_type, scope_id) | — | no | yes |
| `enrollments` | student_id, course_id, source, enrolled_at, completed_at, progress_pct | student, course | unique(student_id, course_id) | active/completed | no | — |
| `lesson_progress` | student_id, lesson_id, status, position_seconds, watched_pct, completed_at, last_accessed_at | student, lesson | unique(student_id, lesson_id); idx(student_id, last_accessed_at) | — | no | — |
| `activity_events` | user_id, type, entity_type, entity_id, payload JSONB, occurred_at, idempotency_key | user | idx(user_id, occurred_at); unique(idempotency_key) | — | append-only | — |
| `session_series` | batch_id, subject, trainer_id, rrule, starts_time, ends_time, from_date, until_date, join_url, provider, skip_dates[] | batch, trainer | idx(batch_id) | active/ended | no | yes |
| `live_sessions` | series_id, batch_id, trainer_id, subject, title, starts_at, ends_at, join_url, provider, recording_lesson_id, type | series, batch, trainer, lesson | idx(batch_id, starts_at); idx(trainer_id, starts_at) | scheduled/live/completed/cancelled | no | yes |
| `attendance_records` | session_id, student_id, status, marked_by, marked_at, source, corrected_from JSONB, reason | session, student, user | unique(session_id, student_id); idx(student_id) | present/absent/late/excused/holiday | no | yes |
| `questions` | type, title, body, payload JSONB, difficulty, marks, negative_marks, subject_term_id, topic_term_id, tags text[], explanation, version, author_id | terms, user | idx(type, status, subject, difficulty); GIN(tags); tsvector | draft/review/published/retired | yes | publish/version |
| `question_versions` | question_id, version, snapshot JSONB, created_by | question | unique(question_id, version) | — | no | — |
| `question_options` | question_id, text, is_correct, position, explanation | question (cascade) | unique(question_id, position) | — | no | — |
| `coding_problems` | question_id, languages JSONB (starter, reference), time_limit_ms, memory_limit_mb, sample_io JSONB, points | question (cascade) | unique(question_id) | — | no | yes |
| `test_cases` | problem_id, input, expected_output, is_sample, weight, position, comparator | problem (cascade) | idx(problem_id, position) | — | no | yes |
| `assignments` | title, description, level_term_id, settings JSONB, author_id | term, user | idx(status) | draft/published/archived | yes | yes |
| `assignment_modules` | assignment_id, title, position, unlock_rule JSONB | assignment | unique(assignment_id, position) | — | no | — |
| `assignment_questions` | module_id, question_id, question_version, position, marks_override | module, question | unique(module_id, position) | — | no | — |
| `assignment_publications` | assignment_id, batch_id, published_by, published_at, due_at | assignment, batch | unique(assignment_id, batch_id) | — | no | yes |
| `submissions` | student_id, question_id, question_version, context_type, context_id, attempt_no, answer JSONB, verdict, score, max_score, time_spent_seconds, trust (trusted/untrusted), idempotency_key, execution_run_id | student, question, execution_run | idx(student_id, question_id); idx(context_type, context_id); unique(idempotency_key) | pending/running/graded/awaiting_manual/error | immutable | — |
| `submission_results` | submission_id, test_case_id, verdict, time_ms, memory_kb, stdout_excerpt, stderr_excerpt | submission (cascade), test case | idx(submission_id) | — | immutable | — |
| `execution_runs` | driver, language, source_hash, stdin_hash, status, result JSONB, requested_by | user | idx(requested_by, created_at) | queued/running/done/failed | no | — |
| `tests` | title, type, duration_minutes, settings JSONB, author_id | user | idx(type, status) | draft/published/archived | yes | yes |
| `test_sections` | test_id, title, position, duration_minutes | test (cascade) | unique(test_id, position) | — | no | — |
| `test_questions` | section_id, question_id, question_version, position, marks, negative_marks | section (cascade), question | unique(section_id, position) | — | no | — |
| `test_schedules` | test_id, batch_id, window_start, window_end, max_attempts, results_released_at, released_by | test, batch | idx(batch_id, window_start) | scheduled/live/closed/released | no | yes |
| `test_attempts` | schedule_id, student_id, attempt_no, started_at, deadline_at, submitted_at, auto_submitted, score, max_score, rank, integrity JSONB | schedule, student | unique(schedule_id, student_id, attempt_no); partial unique active per student | in_progress/submitted/graded/released | no | submit/grade |
| `test_answers` | attempt_id, test_question_id, answer JSONB, submission_id, is_correct, score, graded_by, graded_at, flagged | attempt (cascade), test question, submission | unique(attempt_id, test_question_id) | — | no | manual grading |
| `notifications` | user_id, type, title, body, link, data JSONB, read_at | user | idx(user_id, read_at, created_at) | — | no | — |
| `notification_preferences` | user_id, category, in_app, email | user | unique(user_id, category) | — | no | — |
| `announcements` | title, body, audience JSONB, starts_at, ends_at, channels[] | organization | idx(starts_at, ends_at) | scheduled/active/expired | yes | yes |
| `email_templates` | key, subject, body_html, body_text, variables[], is_custom | organization | unique(org, key) | — | no | yes |
| `files` | owner_type, owner_id, driver, bucket, key, mime, size, checksum, visibility, retention_until, uploaded_by | user | idx(owner_type, owner_id) | pending/ready/failed | no | sensitive downloads |
| `report_exports` | requested_by, report, params JSONB, format, file_id, row_count, expires_at | user, file | idx(requested_by, created_at) | queued/running/done/failed | no | yes |
| `report_definitions` | key, name, source (sql template or builder JSON), columns JSONB, filters JSONB, permission | organization | unique(org, key) | active/disabled | no | yes |
| `settings` | key, value JSONB, updated_by | organization | unique(org, key) | — | no | yes |
| `branding_settings` | organization_id, seeds JSONB (name, logos, colours, fonts, radius, density, login, dashboard, email), computed_tokens JSONB, version | organization, files | unique(org) | — | no | yes |
| `feature_flags` | key, enabled, audience JSONB, description | organization | unique(org, key) | — | no | yes |
| `navigation_config` | portal, items JSONB (key, label, order, hidden, icon) | organization | unique(org, portal) | — | no | yes |
| `taxonomies` / `taxonomy_terms` | key, name; term: taxonomy_id, key, label, parent_id, position | organization | unique(taxonomy, key) | active/archived | no | yes |
| `custom_field_definitions` | entity_type, key, label, type, options JSONB, required, visibility, position | organization | unique(org, entity_type, key) | active/archived | no | yes |
| `custom_field_values` | (stored in the owning entity's `custom` JSONB column, validated against definitions) | — | GIN on `custom` where queried | — | — | via owner |
| `integration_configs` | provider, driver, config JSONB (non-secret), secret_ciphertext, status, last_tested_at | organization | unique(org, provider) | — | no | yes (secrets excluded) |
| `content_pages` | slug, title, body JSONB, visibility | organization | unique(org, slug) | draft/published | yes | yes |
| `audit_logs` | actor_id, action, resource_type, resource_id, before JSONB, after JSONB, ip, user_agent, request_id, occurred_at | user | idx(resource_type, resource_id); idx(actor_id, occurred_at) | — | append-only | — |
| Placement (seeded, hidden): `companies`, `placement_drives`, `drive_applications`, `application_events`, `offers` | as master §14.2 | — | — | — | — | — |
| pg-boss schema `pgboss.*` | managed by pg-boss | — | — | — | — | — |
| `reporting.agg_*` | batch/course/day aggregates refreshed by jobs | — | pk(date, batch_id…) | — | — | — |

### 17.4 Entity relationship overview (demo subset)

```
organizations 1─* settings / branding_settings / feature_flags / navigation_config / taxonomies / custom_field_definitions / email_templates / content_pages / integration_configs
users 1─1 student_profiles 1─* batch_members *─1 batches *─1 programs 1─* program_courses *─1 courses
users 1─1 trainer_profiles 1─* batch_trainers *─1 batches
users *─* roles (user_roles); roles *─* permissions (role_permissions); users 1─* sessions / invitations / password_resets / notifications / audit_logs / activity_events
courses 1─* course_modules 1─* lessons 1─* lesson_resources *─1 files; courses 1─* course_publications
student_profiles 1─* enrollments *─1 courses; student_profiles 1─* lesson_progress *─1 lessons
batches 1─* session_series 1─* live_sessions 1─* attendance_records *─1 student_profiles; live_sessions 0─1 lessons (recording)
questions 1─* question_options; questions 1─0..1 coding_problems 1─* test_cases; questions 1─* question_versions
assignments 1─* assignment_modules 1─* assignment_questions *─1 questions; assignments 1─* assignment_publications *─1 batches
student_profiles 1─* submissions 1─* submission_results; submissions 0─1 execution_runs
tests 1─* test_sections 1─* test_questions *─1 questions; tests 1─* test_schedules *─1 batches; test_schedules 1─* test_attempts 1─* test_answers 0─1 submissions
student_profiles 1─* documents / resumes *─1 files
report_definitions; report_exports *─1 files
```

### 17.5 Migration, seed and data policies

- Migrations: Prisma Migrate; one migration per change; expand/contract for renames; CI applies all migrations to a fresh database, then seeds, then runs tests; destructive migrations require a label and review; overlay migrations run after core.
- Seeds: `base` (idempotent; roles, permissions from manifests, default settings, taxonomies, email templates, navigation defaults, organization row) and `demo` (idempotent by natural keys; §21); `clients/<client>/seeds` for client data.
- Retention as master §14.4; demo/staging databases hold synthetic data only.
- Expected demo volumes: ≈ 100 users, 60 students, 6 courses, 120 lessons, 120 questions, 4 assignments, 3 tests, 60 sessions, 3,000 attendance records, 2,000 submissions, 500 notifications — trivially small; indexes are still created as designed for production.

---

## 18. API Architecture

### 18.1 Conventions

As master §15.1 (versioned `/api/v1`, REST, JSON, ISO dates, offset pagination for tables and cursor for feeds, whitelisted sorting, problem+json errors, idempotency keys, rate limits, OpenAPI 3.1, SSE/WebSocket for real-time, health endpoints). Template additions: `GET /branding/public` and `GET /me` return branding tokens, effective navigation, flags and permissions so the web app can render a client-specific shell from one call; all list endpoints accept `q`, `page`, `pageSize`, `sort`, and typed filters; every mutation writes an audit record (column "Audit" below); permission names are the guard keys from §13.

Column legend: **Req** request shape, **Res** response shape, **Val** validation highlights, **Err** notable error cases beyond the standard 400/401/403/404/429, **P/F/S** pagination/filter/sort, **Audit** yes/no.

### 18.2 Authentication

| Method · Path | Purpose | Auth · Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| POST `/auth/login` | Sign in | public | email, password, rememberMe | user summary, accessToken, expiresIn (+ refresh cookie) | email format; password 1–128 | 401 invalid_credentials; 423 locked; 429 throttled | — | yes (login event) |
| POST `/auth/refresh` | Rotate tokens | refresh cookie | — | accessToken, expiresIn (+ new cookie) | — | 401 invalid/reused → session family revoked | — | yes on reuse |
| POST `/auth/logout` | End session | authenticated | — | 204 | — | — | — | yes |
| POST `/auth/logout-all` | End all sessions | authenticated | — | 204 | — | — | — | yes |
| GET `/auth/sessions` | List devices | authenticated | — | sessions[] | — | — | — | no |
| DELETE `/auth/sessions/{id}` | Revoke one | authenticated (own) | — | 204 | — | 404 | — | yes |
| POST `/auth/invitations/{token}/accept` | Activate account | public (token) | password, consents | user summary + tokens | policy; consents required | 410 expired; 409 already accepted | — | yes |
| POST `/auth/password/forgot` | Request reset | public | email | 202 always | email format | — | — | yes (no email leak) |
| POST `/auth/password/reset` | Set password | public (token) | token, password | 204 | policy | 410 expired; 409 used | — | yes |
| GET `/me` | Identity, roles, permissions, flags, navigation, branding tokens | authenticated | — | me object | — | — | — | no |

### 18.3 Users, roles, permissions

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/users` | List staff | users:read | — | page of users | — | — | page; filters role,status,q; sort name,lastLoginAt | no |
| POST `/users` | Invite user | users:manage | name, email, roleKeys[] | user (invited) | unique email; roles exist | 409 duplicate | — | yes |
| GET `/users/{id}` | Detail | users:read | — | user with roles, sessions count | — | — | — | no |
| PATCH `/users/{id}` | Edit | users:manage | name, mobile | user | — | 409 duplicate mobile | — | yes |
| POST `/users/{id}/deactivate` · `/reactivate` | Status | users:manage | reason | user | not self | 409 state | — | yes |
| PUT `/users/{id}/roles` | Assign roles | users:manage (Super Admin for Super Admin role) | roleKeys[] | user | last Super Admin protected | 409 | — | yes |
| POST `/users/{id}/invitations/resend` | Resend | users:manage | — | 202 | invited only | 409 | — | yes |
| GET `/roles` | Roles | roles:read | — | roles[] with permission counts | — | — | — | no |
| POST `/roles` | Create role | roles:manage | key, name, cloneFrom? | role | unique key | 409 | — | yes |
| GET `/roles/{id}/permissions` | Bundle | roles:read | — | [{permissionKey, scope}] | — | — | — | no |
| PUT `/roles/{id}/permissions` | Replace bundle | roles:manage | [{permissionKey, scope}] | role | keys in catalogue; scope valid; cannot strip own Super Admin | 422 | — | yes |
| GET `/permissions` | Catalogue | roles:read | — | permissions[] grouped by module | — | — | — | no |

### 18.4 Students and trainers

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/students` | List | students:read (scope) | — | page (code, name, batches, status, verification, progress, lastActive) | — | — | page; filters batchId, status, programId, verification, q; sort | no |
| POST `/students` | Create + invite | students:manage | name, email, mobile?, batchId?, custom{} | student | unique email; custom fields per definitions | 409 | — | yes |
| POST `/students/import` | Bulk import (job) | users:import | multipart file, batchId?, sendInvites, dryRun | 202 {jobId} | ≤ 5 MB, ≤ 5,000 rows | 413; 409 running | — | yes |
| GET `/students/import/{jobId}` | Job status | users:import | — | status, counts, errors[], reportFileId | — | — | — | no |
| GET `/students/{id}` | Detail | students:read (scope); sensitive fields need students:read_sensitive | — | student (fields filtered by permission) | — | — | — | no |
| PATCH `/students/{id}` | Edit | students:manage | profile sections, custom{} | student | section schemas | 422 | — | yes |
| POST `/students/{id}/status` | Transition | students:manage | status, reason | student | state machine | 409 | — | yes |
| GET `/students/{id}/progress` · `/attendance` · `/submissions` · `/tests` | Sub-resources | students:read (scope) | — | respective lists | — | — | page | no |
| GET `/students/{id}/documents` | Documents | students:read_sensitive | — | documents[] | — | — | — | no |
| POST `/students/{id}/documents/{docId}/verify` | Verify/reject | students:verify_documents | decision, reason? | document | reason on reject | 409 | — | yes |
| POST `/students/{id}/notes` | Staff note | students:read (scope) | text | note | ≤ 2,000 chars | — | — | yes |
| GET/POST `/trainers`, GET/PATCH `/trainers/{id}`, PUT `/trainers/{id}/batches` | Trainer management | trainers:manage / trainers:read | profile fields; assignments[] | trainer | unique per batch/subject | 409 | page; filters subject,status,q | yes |
| GET/PATCH `/trainers/me` | Own profile | authenticated trainer | — | trainer | — | — | — | yes |

### 18.5 Programmes, batches, sessions, attendance

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET/POST `/programs`, GET/PATCH `/programs/{id}` | Programme CRUD | programs:manage / batches:read | name, code, weeks, courseIds[] | program | unique code | 409 | page | yes |
| GET `/batches` | List | batches:read (scope) | — | page | — | — | page; filters programId,status,trainerId,from,to; sort | no |
| POST `/batches` | Create | batches:manage | programId, code, name, mode, startDate, endDate, capacity, custom{} | batch | dates; unique code | 409 | — | yes |
| GET `/batches/{id}` | Detail with stats | batches:read (scope) | — | batch, counts, trainers, health | — | — | — | no |
| PATCH `/batches/{id}` | Edit | batches:manage | fields | batch | — | — | — | yes |
| POST `/batches/{id}/status` | Transition | batches:manage | status, force?, reason? | batch | unmarked sessions warning | 409 | — | yes |
| GET/POST `/batches/{id}/members` | Roster / add | batches:read / batches:manage | studentIds[] | members | capacity; not already active | 409 | page | yes |
| DELETE `/batches/{id}/members/{studentId}` | Leave | batches:manage | reason | 204 | — | — | — | yes |
| POST `/batches/{id}/members/transfer` | Transfer | batches:manage | studentId, toBatchId, reason | member records | target running/planned | 409 | — | yes |
| PUT `/batches/{id}/trainers` | Assign | batches:manage | [{trainerId, subject, role}] | assignments | unique per subject | 409 | — | yes |
| GET `/batches/{id}/timetable` | Series + occurrences | sessions:read (scope) | from, to | series[], sessions[] | — | — | range | no |
| POST `/batches/{id}/timetable` | Create series | sessions:manage (scope) | subject, trainerId, startsAt, endsAt, recurrence, until, joinUrl, provider, skipDates[] | seriesId, occurrences, conflicts[] | end > start; trainer assigned; until ≤ batch end + 30 d | 409 conflicts | — | yes |
| GET `/batches/{id}/publications` | Published content | batches:read (scope) | — | courses[], assignments[], tests[] | — | — | — | no |
| GET `/sessions` | List | sessions:read (scope) | — | page | — | — | filters batchId,trainerId,from,to,status | no |
| PATCH `/sessions/{id}` | Reschedule/edit one | sessions:manage (scope) | startsAt, endsAt, joinUrl, notes | session | conflicts | 409 | — | yes |
| POST `/sessions/{id}/status` | live/completed/cancelled | sessions:run (scope) | status, reason? | session | transitions | 409 | — | yes |
| POST `/sessions/{id}/recording` | Attach recording | sessions:run (scope) | fileId or url, courseId? | lesson created | file ready | 422 | — | yes |
| GET `/sessions/{id}/attendance` | Records | attendance:read (scope) | — | records[] with defaults | — | — | — | no |
| PUT `/sessions/{id}/attendance` | Mark/correct | attendance:mark (scope); corrections after window need attendance:manage | records[{studentId,status,note?}], reason? | {marked, corrected} | session completed; status enum; reason on correction | 409 window closed; 422 not completed | — | yes |
| GET `/me/schedule` | Student/trainer calendar | authenticated | from, to | sessions[] with join eligibility | — | — | range | no |
| GET `/me/attendance` | Own attendance | authenticated student | from, to, subject? | records[], percentage | — | — | range | no |
| GET `/reports/attendance` | Report | reports:read (scope) | filters | rows, summary | — | — | page; filters; sort | no |

### 18.6 Courses, lessons, enrolments, progress, files

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/courses` | Staff list | courses:manage | — | page | — | — | filters status, level, subject, q | no |
| POST `/courses` | Create | courses:manage | title, description, level, subject, tags, thumbnailFileId | course | title 3–120 | — | — | yes |
| GET `/courses/{id}` | Detail (student view when enrolled; staff view otherwise) | courses:read (enrolled) or courses:manage | — | course + outline + (progress for students) | — | 403 if not in scope | — | no |
| PATCH `/courses/{id}` | Settings | courses:manage | fields | course | — | — | — | yes |
| PUT `/courses/{id}/outline` | Replace outline | courses:manage | modules[{id?, title, position, unlockRule, lessons[...]}] | outline | depth; positions unique; content per type | 422 | — | yes (version) |
| POST `/courses/{id}/publish` · `/unpublish` | Scope publication | courses:publish | scopeType, scopeId?, note | publication | ≥ 1 lesson; videos ready | 422 | — | yes |
| GET `/lessons/{id}` | Lesson content (student) | courses:read (enrolled) | — | lesson (content, resources, playback token) | — | 423 locked | — | no |
| POST `/lessons/{id}/progress` | Position/watched | courses:read (enrolled) | positionSeconds, watchedPct, idempotencyKey | progress | ≤ duration | — | — | no |
| POST `/lessons/{id}/complete` | Manual complete | courses:read (enrolled) | — | progress | rule allows manual | 409 | — | no |
| GET `/me/courses` | Student catalogue | authenticated student | status? | courses with progress | — | — | filters status, q | no |
| GET `/me/progress` | Progress overview | authenticated | — | overall, courses[], assignments[], tests[], attendance summary, activity[] | — | — | — | no |
| POST `/files/uploads` | Presign | files:upload (context) | context, filename, mime, size | uploadId, url (or multipart parts), fileId | mime/size per context | 413; 415 | — | no |
| POST `/files/uploads/{id}/complete` | Finalise | files:upload | parts? | file (ready after sniff) | checksum | 422 | — | yes (sensitive) |
| GET `/files/{id}/url` | Presigned download | files:read (context) | — | url, expiresAt | — | 403 | — | yes (sensitive) |
| DELETE `/files/{id}` | Remove | owner or manage | — | 204 | not referenced | 409 | — | yes |
| POST `/videos` | Register video (driver) | courses:manage | fileId or externalRef | video ref, status | — | — | — | yes |
| GET `/videos/{id}/playback` | Signed playback | courses:read (enrolled) | — | url/token, expiresAt | — | 403 | — | no |

### 18.7 Questions, assignments, submissions, practice

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/questions` | Bank | questions:read | — | page | — | — | filters type,subject,topic,difficulty,status,author,q; sort | no |
| POST `/questions` | Create draft | questions:manage or questions:create_own | type, title, body, payload, difficulty, marks, tags… | question | per-type schema | 422 | — | yes |
| GET `/questions/{id}` | Detail (staff; hidden data included) | questions:read | — | question | — | — | — | no |
| PATCH `/questions/{id}` | Edit (new version if published) | questions:manage / own | fields | question | — | 409 retired | — | yes |
| POST `/questions/{id}/validate` | Run reference solution | questions:manage / own | — | validation report | coding only | 422 | — | no |
| POST `/questions/{id}/publish` · `/retire` | Lifecycle | questions:manage | — | question | validation passed | 409 | — | yes |
| GET `/questions/{id}/versions` | History | questions:read | — | versions[] | — | — | — | no |
| POST `/questions/import` | Bulk (job) | questions:import | multipart, mapping, dryRun | 202 {jobId} | ≤ 5 MB | 413 | — | yes |
| GET/POST `/assignments`, GET/PATCH `/assignments/{id}` | CRUD | assignments:manage (scope) | title, description, level, settings | assignment | — | — | page; filters | yes |
| PUT `/assignments/{id}/structure` | Modules and questions | assignments:manage | modules[{title, unlockRule, questions[{questionId, marksOverride}]}] | structure | questions published | 422 | — | yes |
| POST `/assignments/{id}/publish` | Publish to batches | assignments:publish (scope) | batchIds[], dueAt? | publications | batches in scope | 409 | — | yes |
| GET `/assignments/{id}/me` | Student view | assignments:read (published to student) | — | modules with lock state, questions with attempt stats | — | 403 | — | no |
| GET `/assignments/{id}/progress` | Staff progress | assignments:manage (scope) | batchId | rows per student | — | — | page; sort | no |
| GET `/me/assignments` | Student list | authenticated student | — | assignments with progress | — | — | filters status,q | no |
| POST `/questions/{id}/submissions` | Submit/run | assignments:submit / tests:attempt / practice:use (own) | context{type,id,attemptId?}, mode, answer, Idempotency-Key | 200 graded (objective) or 202 pending (coding) | per-type answer; attempt limit; lock; quota | 409 locked/limit; 422 language; 429 quota | — | no (submission is the record) |
| GET `/submissions/{id}` | State/results | own or staff scope | — | submission with results (hidden tests summarised) | — | — | — | no |
| GET `/submissions/{id}/events` | SSE status | own | — | events | — | — | — | no |
| POST `/submissions/{id}/grade` | Manual grade | assignments:grade (scope) | score, feedback | submission | ≤ max | 409 not manual | — | yes |
| GET `/practice/problems` | Catalogue | practice:use | — | page (title, difficulty, points, status) | — | — | filters topic,difficulty,language,status,q | no |
| GET `/practice/problems/{slug}` | Problem | practice:use | — | statement, samples, starter code, languages available per driver | — | — | — | no |
| POST `/practice/problems/{id}/submissions` | Run/submit | practice:use | mode, language, source, stdin?, clientResults? (browser driver) | submission (trust marked) | source ≤ 64 KB; quota | 429 | — | no |
| POST `/execute` | Free run (future playground; used by validation now) | practice:use / questions:manage | language, source, stdin | run result | quotas | 429 | — | no |
| GET `/languages` | Available languages per driver | authenticated | — | languages[] with driver capabilities | — | — | — | no |

### 18.8 Tests and attempts

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET/POST `/tests`, GET/PATCH `/tests/{id}` | CRUD | tests:manage (scope) | title, type, duration, settings | test | — | — | page; filters | yes |
| PUT `/tests/{id}/structure` | Sections/questions | tests:manage | sections[{title, duration?, questions[{questionId, marks, negative}]}] | structure | published questions | 422 | — | yes |
| POST `/tests/{id}/schedules` | Schedule | tests:schedule (scope) | batchId, windowStart, windowEnd, maxAttempts | schedule | window valid; batch in scope | 409 overlap | — | yes |
| PATCH `/schedules/{id}` | Edit window | tests:schedule | fields | schedule | not started | 409 | — | yes |
| GET `/me/tests` | Student list | authenticated student | — | upcoming/live/history with status | — | — | filters | no |
| POST `/tests/{id}/attempts` | Start | tests:attempt | scheduleId | attempt (deadline, serverTime, sections) | in window; attempts left | 409 active exists (returns it); 422 outside window | — | yes |
| GET `/attempts/{id}/state` | Resume | own | — | answers, flags, deadline, serverTime | — | 410 ended | — | no |
| GET `/attempts/{id}/sections/{sid}/questions` | Questions (no answers) | own, in progress | — | questions[] | — | 409 | — | no |
| PATCH `/attempts/{id}/answers` | Autosave | own, in progress | answers[] | saved count, serverTime | — | 410 deadline passed (30 s grace) | — | no |
| POST `/attempts/{id}/events` | Integrity events | own | events[] | 204 | — | — | — | no |
| POST `/attempts/{id}/submit` | Submit | own | — | attempt (submitted) | — | 409 already | — | yes |
| GET `/attempts/{id}/result` | Result | own (released) or staff scope | — | score, sections, rank, review (policy) | — | 403 not released | — | no |
| GET `/tests/{id}/monitor` | Live monitor | tests:monitor (scope) | scheduleId | counts, per-student status, flags | — | — | — | no |
| GET `/tests/{id}/results` | Results table | tests:manage (scope) | scheduleId | rows | — | — | page; sort | no |
| PATCH `/attempts/{id}/answers/{answerId}/grade` | Manual grade | tests:grade (scope) | score, comment | answer, attempt totals | ≤ marks | 409 | — | yes |
| POST `/tests/{id}/release` | Release results | tests:release (scope) | scheduleId | schedule | grading complete or force | 409 | — | yes |

### 18.9 Reports, notifications, announcements

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/reports/dashboard` | Admin metrics | reports:read (scope) | from, to, programId, batchId, courseId, trainerId | metrics, definitions, asOf | ranges ≤ 24 months | — | — | no |
| GET `/reports` | Report catalogue (incl. client definitions) | reports:read | — | reports[] | — | — | — | no |
| GET `/reports/{name}` | Report data | reports:read (scope) | filters | summary, chart series, rows | — | — | page; filters; sort | no |
| POST `/exports` | Export job | reports:export (scope) | report, params, format | 202 {exportId} | caps | 429 too many | — | yes |
| GET `/exports`, GET `/exports/{id}`, GET `/exports/{id}/download` | Jobs and download | reports:export | — | list / status / presigned url | — | 410 expired | page | yes (download) |
| GET `/me/notifications` | List | authenticated | — | page (unread first) | — | — | cursor; filters type,unread | no |
| PATCH `/me/notifications/{id}/read` · POST `/me/notifications/read-all` | Mark read | authenticated | — | 204 | — | — | — | no |
| GET/PUT `/me/notification-preferences` | Preferences | authenticated | matrix | matrix | categories exist | — | — | no |
| POST `/notifications/broadcast` | Staff message | notifications:broadcast (scope) | audience, title, body, channels | 202 count | audience in scope | 422 | — | yes |
| GET/POST `/announcements`, PATCH/DELETE `/announcements/{id}` | Announcements | announcements:manage | title, body, audience, startsAt, endsAt, channels | announcement | window valid | — | page | yes |
| GET `/me/dashboard` | Student home aggregate | authenticated student | — | today, continue, progress, tasks, announcements, attendance | — | — | — | no |
| GET `/trainer/dashboard` | Trainer home | authenticated trainer | — | sessions, grading counts, batch health, at-risk | — | — | — | no |

### 18.10 Settings, branding, feature flags, navigation, fields, templates, audit, health, search

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/settings` | All settings (typed) | settings:read | — | sections | — | — | — | no |
| PATCH `/settings` | Update | settings:manage | partial sections | settings | per-section Zod schemas (attendance, assessment, academic, locale, legal) | 422 | — | yes |
| GET `/branding/public` | Public branding + tokens | public (cached, ETag) | — | name, logos, favicon, tokens{light,dark}, login, fonts | — | — | — | no |
| GET `/branding` · PATCH `/branding` | Manage seeds | branding:manage | seeds | branding + computed tokens | colour format; contrast ≥ 4.5:1; asset types | 422 contrast | — | yes |
| POST `/branding/preview` | Render preview tokens | branding:manage | seeds | tokens | — | — | — | no |
| GET `/flags` · PATCH `/flags/{key}` | Feature flags | flags:manage (read via /me for all) | enabled, audience | flag | key exists (module manifests) | 404 | — | yes |
| GET `/navigation/{portal}` · PATCH `/navigation/{portal}` | Labels/order/visibility | settings:manage | items[] | config | keys exist | 422 | — | yes |
| GET/POST `/taxonomies`, GET/POST/PATCH `/taxonomies/{key}/terms` | Taxonomies | settings:manage (read for all) | key, label, parent, position | terms | unique key | 409 | — | yes |
| GET/POST/PATCH `/custom-fields` | Definitions | settings:manage | entityType, key, label, type, options, required, visibility | definition | unique per entity; type enum | 409 | — | yes |
| GET/PATCH `/templates/{key}`, POST `/templates/{key}/test` | Email templates | settings:manage | subject, bodyHtml, bodyText; test recipient | template / 202 | variables valid | 422 | — | yes |
| GET/POST/PATCH `/content-pages`, GET `/content-pages/{slug}` (public) | Content pages | settings:manage / public | slug, title, body, visibility | page | unique slug | 409 | — | yes |
| GET/PATCH `/integrations/{provider}`, POST `/integrations/{provider}/test` | Providers | settings:manage | driver, config, secret (write-only) | config without secret / test result | driver supported | 422 | — | yes (no secret) |
| GET `/audit-logs` | Audit viewer | audit:read | — | page | — | — | page; filters actor, action, resourceType, from, to; sort occurredAt | no |
| GET `/admin/health` | Health cards | settings:manage | — | db, storage, email, queue{depth, failed}, execution driver, version | — | — | — | no |
| POST `/admin/jobs/{id}/retry` | Retry failed job | settings:manage | — | 202 | — | 404 | — | yes |
| GET `/health/live` · `/health/ready` | Probes | public (internal) | — | 200/503 | — | — | — | no |
| GET `/search` | Search | search:use | q, types[] | grouped results (permitted only) | 2 ≤ len ≤ 100 | — | limit | no |

### 18.11 Contract governance

OpenAPI generated from decorators; the web client regenerated in CI; contract tests validate every documented response; additive changes only within `/v1`; deprecations announced in the changelog; client overlays may add endpoints under `/api/v1/ext/<client>/...` and must not modify core routes.

---
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
## 22. White-Label Strategy

### 22.1 Configuration layers (lowest to highest precedence)

1. **Template defaults** — module manifests and `packages/ui` tokens.
2. **Client overlay files** — `clients/<client>/*.json` seeded into the database on first deploy (branding, settings, flags, navigation, custom fields, templates); assets and seeds.
3. **Database configuration** — editable by Super Admin in the UI at runtime (branding, settings, flags, navigation, custom fields, templates, taxonomies, roles).
4. **Deployment configuration** — environment variables (client key, URLs, drivers, secrets) and `infra/` sizing.
5. **Extension modules** — code in the overlay that registers through the module contract (only when configuration cannot express the need).

### 22.2 What stays common across clients

The three apps and all core modules; the permission catalogue; the API contract; the design system's component behaviour and accessibility; the database schema (core tables); migrations; security controls; the queue/adapters; tests. Clients never edit these; they configure or extend.

### 22.3 What can be customised (summary of §3.4)

Branding and theme; login and dashboard appearance; navigation labels/order/visibility; enabled modules and options; taxonomies (categories, levels, subjects, skills); roles and bundles; custom fields; academic rules (attendance, assessment, completion); templates (email, notification, certificates later); content pages; integrations and drivers; client-specific reports (definitions or extension); workflows via extension points; seeds and demo content; deployment size and region.

### 22.4 Data isolation

One database, one storage bucket (or prefix), one set of secrets and one deployment per client. Backups, exports and erasure requests are therefore naturally per client. A client's overlay lives in the shared repository under `clients/<client>/` (or in a private client repository consumed as a package if separation of client code is contractually required).

### 22.5 Version management and upgrade strategy

- The template is versioned with **semantic versioning**; every release has a changelog listing schema migrations, manifest changes, token changes and SDK changes.
- Each client deployment pins a template version and records its overlay version; a **compatibility matrix** in `docs/runbooks/upgrade.md` states which SDK versions an overlay may target.
- Upgrade runbook: (1) backup; (2) deploy new images to staging for the client; (3) run core migrations, then overlay migrations; (4) run configuration validation (settings schemas, flags, navigation keys, custom-field definitions, role permission references); (5) run the client's smoke tests (Playwright journeys with client data); (6) promote; (7) rollback = previous image tag + backward-compatible migrations.
- Breaking SDK changes are announced one minor version ahead with deprecation warnings in logs.

### 22.6 Client onboarding checklist (per new client)

Create overlay from `clients/_template`; fill branding/settings/flags/navigation/custom fields; add assets; adjust seeds; provision environment (domain, TLS, database, storage, email); set environment variables; deploy; run base seed and client seed; create Super Admin; verify the configuration validator passes; run the demo script with client branding; hand over credentials through a secure channel.

---

## 23. Testing and Quality Plan

### 23.1 Pyramid for the demo

| Level | Coverage target | Tooling | When |
|---|---|---|---|
| Unit | Rules and formulas (progress, attendance %, unlock, grading, eligibility placeholders, token derivation/contrast) | Vitest | Every commit (pre-push) |
| Integration | Repositories and services against PostgreSQL (Testcontainers or Compose DB), queue jobs, seeds, migrations | Vitest | Every PR |
| API/contract | Every endpoint in §18 with seed data; OpenAPI conformance; permission matrix (generated from the catalogue × roles) | Supertest, openapi validator | Every PR |
| Component | Design-system components and forms with states; axe | Vitest + Testing Library | Every PR |
| End-to-end | J-01…J-12 as Playwright specs (desktop + mobile emulation); smoke subset on PR, full nightly and before demos | Playwright | PR (smoke) / nightly |
| Security | `pnpm audit`, CodeQL, auth abuse tests, response-shape tests (no answer keys/hidden tests to students), CSP header tests; ZAP baseline on staging monthly | CI + manual | PR / monthly |
| Accessibility | axe in component and E2E tests; manual keyboard/screen-reader pass on player, workspace, attempt | axe, manual | Per phase |
| Performance (light) | k6 smoke: lists p95 < 500 ms locally, autosave endpoint under 100 concurrent students | k6 | Phase 4 and 6 |

### 23.2 CI pipeline (GitHub Actions, Linux runners only to conserve free minutes)

`ci.yml` on PR: install (cached) → lint + type-check → unit → integration/API (PostgreSQL service container) → build web/api images → migrate-check (fresh DB, migrations, seeds) → OpenAPI diff → Playwright smoke (Chromium) → bundle-size check. Estimated 12–18 minutes; ≈ 40 PR runs/month fit the 2,000-minute allowance with headroom; nightly full E2E runs on a schedule.

### 23.3 Definition of Done (feature) and Page Completion Rule

A feature is done when: code reviewed; unit/integration/API tests added and green; permission tests updated; OpenAPI and client regenerated; migrations reviewed; accessibility checks pass; module README and runbooks updated; flags/settings documented; demoed on staging; acceptance criteria verified.

A **page** is complete only when all of the following are true (from the brief, adopted verbatim as the checklist stored in `docs/runbooks/page-checklist.md`): UI implemented; responsive design implemented; navigation works; APIs connected; database operations work; validation works; permissions work; loading states exist; empty states exist; error states exist; success states exist; forms work; tables and filters work; related pages are connected; the complete user journey works; relevant tests pass; the page is included in the demo walkthrough. Pages that do not meet this are labelled **temporary wireframe** in the UI (a visible badge in non-production) and in the progress log.

### 23.4 Quality gates per phase

Each phase (§24) ends with: all tests green; no open P1/P2 defects; page checklist complete for the phase's pages; demo script updated; ADRs for decisions taken; progress log entry; review meeting with sign-off.

---

## 24. Implementation Roadmap

### 24.1 Sequence (dependency-aware; durations for two engineers)

| Phase | Objectives | Deliverables | Depends on | Exit criteria | Duration |
|---|---|---|---|---|---|
| **Phase 0 — Architecture and decisions** | Final requirements review; scope confirmation; technology confirmation; architecture, database, UI/UX and navigation approval | This document revised; §28 signed; then Step 9 artefacts: repository structure, database schema draft, API contracts (OpenAPI skeleton), page checklist, backlog with IDs, local setup instructions | Client review | Approval recorded; backlog accepted | 1–2 weeks (client-driven) |
| **Phase 1 — Foundation** | Runnable skeleton | Monorepo; Compose stack; env validation; Prisma baseline (organizations, users, roles, permissions, settings, branding, flags, navigation, audit, files); authentication; RBAC guards; module registry; shared UI system with tokens and theme injection; portal layouts and navigation renderer; error handling; logging; base seed; CLI (create-admin); CI pipeline; ADR-001…006; runbooks skeleton | Phase 0 | New developer runs the stack in < 1 hour; login works for four roles; branding changes re-theme; route-table test passes | 2–3 weeks |
| **Phase 2 — Admin foundation** | People and batches | Users, students (with import, documents, custom fields), trainers, programmes, batches (members, trainers, status), basic admin dashboard (student counts), notifications (in-app + email), announcements, audit viewer, search (basic) | Phase 1 | J-01 and J-02 pass end to end; import of demo sheet; audit rows present | 2 weeks |
| **Phase 3 — Learning foundation** | Content and classes | Courses/modules/lessons builder, file registry and uploads, video driver (storage-file), publications, catalogue, course details, player, progress service, schedule (series/occurrences/reminders), student dashboard and progress page | Phase 2 | J-03, J-07, J-08 pass; recording attach creates lesson; progress consistent | 3 weeks |
| **Phase 4 — Assessments** | Practice and tests | Question bank (MCQ, true/false, descriptive, coding) with import and validation; execution adapter with browser-sandbox driver (Judge0 driver behind flag); assignments (structure, unlock, submissions, grading queue); tests (builder, schedules, attempt engine, grading, release, results, monitor); practice catalogue and workspace | Phase 3 | J-06, J-09, J-10, J-11 pass; browser driver runs JS and Python; response-shape security tests pass | 3–4 weeks |
| **Phase 5 — Attendance and reporting** | Operations and metrics | Attendance marking/corrections/thresholds; admin attendance view; report pages (students, attendance, progress, assessments, assignments) with filters/charts/tables; exports (CSV/XLSX jobs); dashboard tiles complete with definitions and placeholders for future metrics; trainer reports | Phase 4 | J-05, J-12 pass; export equals filtered rows; metric fixture tests pass | 2 weeks |
| **Phase 6 — Demo completion** | A complete, connected demo | Responsive refinement (mobile passes on all student pages); navigation validation (all links, deep links, 403/404); permission testing (matrix, scopes); end-to-end journeys J-01…J-12 green on desktop and mobile; seeded demo data and `demo:reset`/`demo:advance`; empty/error/success states audit; documentation (README, runbooks, module pages, demo script); staging deployment (Option A or B) with monitoring; page checklist complete for all 80 pages | Phase 5 | Demo script executed end to end on staging by someone other than the author; all pages pass the checklist | 2 weeks |
| **Future phases** (master Standard/Advanced) | As master §19 | Judge0-based trusted execution and labs (SQL/Web/Debug/Playground); Projects; Certificates; Placement portal; Feedback; Gamification; Doubts; Events; OTP and QR; hosted video; PDF/scheduled reports; AI assistant and interviews; advanced analytics; integrations | Demo approved; client decisions and budgets | Per master phase criteria | Per master |

Total for Phases 1–6: **12–16 weeks with two engineers** (≈ 20–26 weeks for one). Phase 0 depends on review speed.

### 24.2 Why this order

Authentication, RBAC and the theme/navigation system come first because every later page depends on them and because white-labeling must be proven early (Phase 1 exit criterion). Admin data precedes learning content because batches scope everything. Assessments follow content because assignments and tests embed practice items into courses. Reporting is last among features because it reads from every module. Demo completion is a phase of its own so that "connected application" quality is not sacrificed to feature count.

### 24.3 Backlog format (Step 9)

Each backlog item: ID (`BL-nnn`), phase, module, page/journey references (DP-/J-), acceptance criteria, tests required, flags/settings touched, estimate, dependencies. The page checklist is attached to every page item.

---
## 25. Risks and Mitigation

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| DR-01 | Free VM (Oracle) unobtainable due to capacity, or reclaimed as idle; free-tier limits change | High | Medium | Keep Option B ready; deployment is vendor-agnostic Docker; scheduled light activity on the VM within terms; re-verify limits monthly |
| DR-02 | Vercel Hobby or UptimeRobot non-commercial terms conflict with a client demo | Medium | Low | Prefer Cloudflare Workers/VM and Uptime Kuma; document terms |
| DR-03 | Next.js bundle exceeds Workers free-plan size | Medium | Low | Measure early (Phase 1); fallback to VM or Vercel (personal) |
| DR-04 | Render free API sleeps during a demo | High | Low | Warm the service before demos; state it; prefer Option A for client demos |
| DR-05 | Browser-sandbox execution misunderstood as production-grade grading | Medium | Medium | Trust badges, docs, and the roadmap item for Judge0 |
| DR-06 | pg-boss load on PostgreSQL at scale | Low | Low | Scale target small; BullMQ driver documented; queue interface |
| DR-07 | Scope creep from the master catalogue into the demo | High | High | Demo scope table (§12) and flags; changes through backlog and §28 |
| DR-08 | White-label overlay misuse (clients editing core) | Medium | High | Lint rules, SDK boundaries, CI check that `apps/` and `packages/` are unchanged in client branches, upgrade validator |
| DR-09 | Design-token theming producing inaccessible colour combinations | Medium | Medium | Contrast validation on save; derived neutrals; dark theme generated with checks |
| DR-10 | Test attempt engine correctness under concurrency | Medium | High | Server-authoritative design; fake-clock tests; k6 smoke |
| DR-11 | Sample videos and content quality for demos | Medium | Medium | Curate open-licensed sample media early; client content is client's responsibility |
| DR-12 | Single-developer bus factor | Medium | High | Documentation, ADRs, runbooks, conventional structure, tests |
| DR-13 | Framework/ORM major changes during build (Prisma 8 GA, Next.js updates) | Medium | Medium | Pin versions at Phase 1; upgrade only between phases with ADR |
| DR-14 | Free email tiers throttle demo invitations | Low | Low | Mailpit for demos; Resend only when real inboxes matter |
| DR-15 | Demo data leaks real details by accident | Low | High | Synthetic data only; review seeds; no client data in staging |

---

## 26. Cost and Feasibility Analysis

### 26.1 Local demo

| Item | Tool | Cost |
|---|---|---|
| Development tools | VS Code, Node, pnpm, Git | 0 |
| Database | PostgreSQL in Docker | 0 |
| Docker | Docker Engine; Docker Desktop free under its personal/small-business terms (or Rancher/Podman Desktop) | 0 |
| Storage | MinIO in Docker | 0 |
| Email testing | Mailpit | 0 |
| Testing tools | Vitest, Playwright, Testcontainers, k6, axe | 0 |
| Code execution | Browser sandbox (Pyodide/JS); Judge0 CE optional on Linux | 0 |
| **Total** | | **0 (developer time only)** |

### 26.2 Free staging (within limits; demo-grade only)

| Layer | Option A (VM) | Option B (free tiers) | Cost |
|---|---|---|---|
| Frontend | Container on VM | Cloudflare Workers free (or Vercel Hobby, personal use) | 0 |
| Backend | Container on VM | Render free (sleeps) | 0 |
| Database | PostgreSQL container (+ dumps to R2) or Neon free | Neon free (0.5 GB) | 0 |
| Storage | MinIO or R2 free | R2 free (10 GB) | 0 |
| CI/CD | GitHub Actions (2,000 min/month private; public repos free) | same | 0 |
| Monitoring | Uptime Kuma + Sentry Developer | UptimeRobot (personal) + Sentry Developer | 0 |
| Domain/subdomain | DuckDNS subdomain + Let's Encrypt | Vendor subdomains | 0 (real domain is client-owned, ≈ USD 10–15/year) |
| Email | Mailpit or Resend free (3,000/month) | Resend free | 0 |
| **Total** | | | **0 within limits**; risks in §9 |

### 26.3 Future production (client-owned; indicative, from master §20.2, verify at procurement)

| Item | Indicative monthly cost | Notes |
|---|---|---|
| Hosting (app VM + execution VM) | USD 50–120 | Or PaaS at 2–4× |
| Managed PostgreSQL | USD 15–80 | PITR backups |
| Object storage | ≈ USD 8 per 500 GB | R2, free egress |
| Video hosting | USD 40–120 (per-GB model) or far more on per-minute delivery pricing | Depends on viewing hours |
| Email | USD 0–20 | Resend Pro at 50k |
| SMS/OTP | Provider-specific + DLT registration | Optional |
| AI (if enabled) | Budget-driven; see master §20.2 sensitivity (≈ USD 750–5,250 for 300k messages/month depending on model and caching) | Quotas control spend |
| Code execution | USD 0 beyond execution VM (self-hosted) or Judge0 Cloud €27–107 | Optional |
| Backups | Included in managed DB; storage for dumps | — |
| Monitoring | USD 0–30 | Sentry Team USD 26 if needed |
| Domain | ≈ USD 10–15/year | — |
| Maintenance | Developer retainer (separate agreement) | — |
| **Typical total without AI and SMS** | **≈ USD 100–300/month** | Master §20.2 |

### 26.4 Separation of cost types

| Type | Examples | Owner |
|---|---|---|
| Developer effort | Phases 0–6 (12–16 weeks for two engineers), future phases | Per engagement agreement |
| Infrastructure cost | Hosting, database, storage, backups, monitoring | Client (production); free tiers in staging |
| Third-party recurring cost | Video, email, SMS, AI, execution cloud | Client |
| Client-owned cost | Domain, accounts, licences (Zoom/Meet), design assets | Client |
| Optional feature cost | AI, labs execution VM, proctoring, payments | Client, only when enabled |

Free-tier staging is not a guarantee of production readiness; production must follow master §18.

---

## 27. Open Questions

Demo-specific questions (answers change the demo plan):

| ID | Question | Proposed default | Needed by |
|---|---|---|---|
| DQ-01 | Which staging option do you prefer, A (free VM, fuller fidelity, you or the developer operate it) or B (free-tier combination, zero operations, sleeping API)? | A if an Oracle Always Free instance can be created; otherwise B | Phase 1 |
| DQ-02 | Do you accept the browser-sandbox execution prototype (JavaScript and Python only, untrusted results) for the demo, with Judge0 as a later step? | Yes | Phase 4 |
| DQ-03 | Is the pg-boss (no Redis) default acceptable for the template, with Redis/BullMQ as a documented scale option? | Yes | Phase 1 |
| DQ-04 | Do you want Placement Coordinator and Content Manager visible as roles in the demo (seeded, no portal), or hidden entirely? | Visible (shows configurability) | Phase 2 |
| DQ-05 | Should the demo brand be a neutral fictional institute ("Demo Institute") or your own brand? | Neutral; a second overlay can show your brand in minutes | Phase 1 |
| DQ-06 | Demo video source: small open-licensed sample clips in storage, or your own short recordings? | Sample clips | Phase 3 |
| DQ-07 | Which sample subjects/programme should the demo use (Java Full-Stack proposed)? | Java Full-Stack | Phase 2 |
| DQ-08 | Is a public GitHub repository acceptable (unlimited free CI minutes) or must it be private (2,000 minutes/month)? | Private with lean pipelines | Phase 1 |
| DQ-09 | Who owns the staging accounts (GitHub, Oracle/Cloudflare/Render/Neon, Sentry)? | Developer for demo stage; client-owned from first client deployment | Phase 1 |
| DQ-10 | Which client overlay mechanism do you prefer: overlays inside the template repository or one private repository per client? | Inside the template repository until the first paying client | Phase 1 |

Master questions still relevant to the demo (defaults as in master §21 unless answered): Q-01 product name, Q-02 brand assets, Q-05 metric definitions, Q-08 programme/course model, Q-09 login method (email/password in demo), Q-12 attendance method (roll-call), Q-14 languages (JavaScript, Python in browser; more with Judge0), Q-19 integrity level (basic), Q-21 profile fields, Q-23 gamification (off).

---

## 28. Architecture Approval Checklist

| # | Decision | Recommended option | Reason | Alternatives | Decision required | Impact if changed later |
|---|---|---|---|---|---|---|
| D-01 | Architecture | Monorepo with modular monolith (web, api, worker) + client overlay | Best fit for small team, reuse, free tiers (§5) | Plain monolith; microservices | Approve architecture | High: structure of every module |
| D-02 | Frontend stack | Next.js 16, TypeScript, Tailwind 4, shadcn/ui, TanStack Query/Table, RHF + Zod, Recharts, TipTap, CodeMirror 6 | Master choice; SSR for phones; owned components | Vite SPA; MUI/Ant | Approve | High: UI rewrite |
| D-03 | Backend stack | NestJS 12, TypeScript, REST + OpenAPI, Zod, pino | Module contract fit; guards; docs | Fastify/Hono; Django | Approve | High: API rewrite |
| D-04 | Database | PostgreSQL 16+ with Prisma 7 | Integrity, JSONB, portability | MySQL; Drizzle | Approve | High: data layer |
| D-05 | Authentication approach | Own email/password + invitations + rotating refresh tokens; OTP/2FA later behind flags | No SaaS cost; invite-first institutes | Auth.js; Keycloak; Clerk | Approve | Medium: auth module swap |
| D-06 | User roles (demo) | Super Admin, Admin, Trainer, Student; Placement Coordinator and Content Manager seeded without portals | Complete demo without half-built portals | Include placement portal now | Approve | Low: roles are data |
| D-07 | Demo scope | Fourteen modules in §12.2; future modules flagged off | Connected application within 12–16 weeks | Larger scope | Approve | Medium: timeline |
| D-08 | Queue/cache driver | Queue interface with pg-boss default; Redis/BullMQ as scale option; in-memory/PostgreSQL cache and rate-limit stores | Free tiers, one less service | Redis from day one | Approve (refinement R-1) | Low: driver swap |
| D-09 | Coding execution scope | Execution adapter: browser-sandbox (JS, Python) in demo, Judge0 driver optional; trusted grading later | Safety and zero cost | Judge0 required for demo (needs Linux host) | Approve (refinement R-3) | Low: driver swap |
| D-10 | Video strategy | Storage-file driver (MP4/HLS in S3-compatible storage, signed URLs) for demo; hosted providers later | Zero cost, adapter | YouTube unlisted; Bunny now | Approve (refinement R-2) | Low: driver swap |
| D-11 | File-storage strategy | File registry + S3 driver (MinIO local, R2 staging); disk driver for tiny installs | Portable, free tiers | Local disk only | Approve | Low |
| D-12 | Branding / white-label strategy | Configuration layers (§22.1): DB-driven branding/settings/flags/navigation/custom fields/templates; theme tokens; overlay for assets/seeds/extensions; one deployment per client | No forks; isolation | Multi-tenant SaaS now | Approve (refinement R-4) | Medium: tenant migration later is planned |
| D-13 | Local environment | Docker Compose (postgres, minio, mailpit; profiles tools/judge0) + host-run apps with hot reload | Fast, reproducible | All-in-containers dev | Approve | Low |
| D-14 | Free staging environment | Option A (free VM + Compose) preferred; Option B (Workers + Render + Neon + R2 + Resend) fallback; both demo-grade | Fidelity vs zero-ops | Paid PaaS | Choose A or B | Low: same images |
| D-15 | Repository structure | §20 tree | Reuse, overlay, testing | Multi-repo | Approve | Medium |
| D-16 | Database design | §17 (single-tenant per deployment, tenant-ready; demo subset of master §14) | Isolation now, evolution later | Shared multi-tenant | Approve | Medium |
| D-17 | API structure | §18 (`/api/v1`, conventions, groups) | Contract-first | GraphQL/tRPC | Approve | High |
| D-18 | Page inventory | §14 (80 demo pages; future pages flagged) | Matches customer expectations | Fewer/more pages | Approve | Medium |
| D-19 | Navigation | §15 maps and behaviours; configurable labels/order | Reference-consistent, configurable | Fixed navigation | Approve | Low |
| D-20 | UI/UX system | §16 tokens, components, templates; contrast-validated theming | White-label without rewrites | Per-client styling | Approve | Medium |
| D-21 | Security baseline | §19 from Phase 1; execution never in API | Cheaper to build in | Later hardening | Approve | High if deferred |
| D-22 | Testing approach | §23 pyramid, CI, Definition of Done, page checklist | Quality gate for "complete pages" | Lighter testing | Approve | Medium |
| D-23 | Implementation sequence | §24 Phases 0–6 then master phases | Dependency order | Reordered phases | Approve | Medium |

Additional confirmations: DQ-01…DQ-10 (§27), the cost boundary statement (§10.3), and the preservation statement (§2).

---

## 29. Recommended Next Steps

1. Review this document and the master together; comment per section (Step 5).
2. Answer DQ-01…DQ-10 and confirm or amend D-01…D-23 (Step 6 revision follows).
3. Approve the final architecture decision document (Step 7–8). Nothing is locked before that.
4. Only after approval (Step 9): prepare the final repository structure, Prisma schema draft, OpenAPI skeleton, page implementation checklist, development backlog (`BL-` items for Phases 1–6) and local setup instructions.
5. Only after a separate explicit instruction: begin Phase 1 coding.

Parallel client-side tasks that need no code: decide the demo brand (DQ-05); choose staging option and create the accounts (DQ-01, DQ-09); collect or approve sample media (DQ-06); confirm the sample programme (DQ-07); read the cost boundary statement (§10.3).

---

## Appendix A. Sources verified for this document (September 2026)

- Render free tier: https://render.com/docs/free (750 instance-hours; 15-minute spin-down; free PostgreSQL 1 GB expiring after 30 days; no free workers/cron)
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby (included usage; non-commercial fair use; 100 deployments/day; 300 s functions)
- Supabase pricing: https://supabase.com/pricing (2 projects; 500 MB; 1 GB storage; 5 GB egress; pause after 7 days)
- Upstash Redis pricing: https://upstash.com/pricing/redis (500K commands/month; 256 MB; 10 GB)
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/ (100,000 requests/day; 10 ms CPU; 128 MB; static assets limits) and OpenNext Cloudflare adapter notes on the 3 MiB free-plan Worker size: https://opennext.js.org/cloudflare
- Koyeb pricing: https://www.koyeb.com/pricing (no free tier; Pro USD 29/month)
- Oracle Cloud Always Free changes (2 OCPU/12 GB from 15 June 2026; idle reclamation rule): https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/ and https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Railway pricing: https://docs.railway.com/pricing/plans (USD 5 trial credit; Hobby USD 5/month)
- Fly.io discontinued free allowance: https://fly.io/docs/about/discontinued-plans/
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions (2,000 minutes, 500 MB; public repositories free)
- Sentry pricing: https://sentry.io/pricing/ (Developer: 5K errors, 5M spans, 50 replays, 1 user, 30 days)
- Netlify Free plan credits: https://www.netlify.com/blog/introducing-netlify-free-plan/ (300 credits/month)
- UptimeRobot free plan (50 monitors, 5-minute interval, non-commercial): vendor and comparison pages listed in search results
- Brevo free (300 emails/day) and Mailtrap free (4,000 emails/month, 150/day): vendor and review pages listed in search results
- Docker Desktop licensing: https://docs.docker.com/subscription/desktop-license/ (free for individuals, education, non-commercial OSS, and businesses under 250 employees and USD 10 million revenue)
- Judge0 host requirements (Ubuntu 22.04 with cgroup v1 boot parameter): https://github.com/judge0/judge0 and its CHANGELOG
- Google Cloud Always Free e2-micro (us-west1/us-central1/us-east1) and AWS Free plan (credits, 6 months): https://cloud.google.com/free/docs/compute-getting-started and https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/
- pg-boss: https://github.com/timgit/pg-boss (PostgreSQL SKIP LOCKED queue; v12 line, September 2026)
- OpenNext Cloudflare adapter and Next.js 16 support: https://opennext.js.org/cloudflare and https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Pyodide (CPython on WebAssembly; sandboxed iframe at opaque origin; ≈ 15 MB core download): https://pyodide.org/ and https://github.com/pyodide/pyodide
- Neon, Cloudflare R2, Resend, Razorpay, Anthropic pricing and framework versions: as verified for the master report (Appendix C there)

*End of document.*
