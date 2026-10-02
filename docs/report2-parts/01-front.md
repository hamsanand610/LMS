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
