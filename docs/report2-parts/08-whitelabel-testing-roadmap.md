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
