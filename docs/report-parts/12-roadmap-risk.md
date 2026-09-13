## 19. Development Roadmap

### 19.1 Principles

- Phases are sequential gates: a phase starts only when its dependencies are complete, tested and approved (Rule 25, §22).
- Each phase ends with a demo on staging, a written test report, updated documentation and a sign-off.
- Three releases are planned: **MVP** (after Phase 6a plus a hardening sprint), **Standard** (after Phase 8), **Advanced** (after Phase 9). Phase 10 (hardening and launch) is executed before each release.
- Durations assume a team of 2–3 engineers (one full-stack lead, one full-stack, optionally one front-end/QA) and prompt client decisions. They are planning ranges, not commitments.

### 19.2 Phase plan

| Phase | Objectives | Features / deliverables | Dependencies | Risks | Testing | Completion criteria | Duration |
|---|---|---|---|---|---|---|---|
| **PH-0 Requirements and architecture approval** | Agree scope, decisions, stack and rules | This report revised; answers to §21; approved feature tiers; product name and brand assets; provider accounts decided | Client review | Delayed decisions delay everything | — | Approval checklist (§24) signed | 1–2 weeks (client-driven) |
| **PH-1 Project setup and foundation** | Working skeleton with CI/CD, Docker, conventions | Monorepo; `apps/web`, `apps/api`, `apps/worker`, `packages/*`; Docker Compose (Postgres, Redis, MinIO, Mailpit, Judge0 placeholder); Prisma baseline; health endpoints; design tokens and base components (shell, table, form, states); OpenAPI generation and client; GitHub Actions (lint, test, build, deploy to staging); staging environment; seed framework; `docs/` structure with ADRs, progress log, runbooks skeleton; coding standards | PH-0 | Over-engineering the foundation; environment access delays | Pipeline runs green end to end; smoke E2E on staging | New developer can run the stack locally in < 1 hour; staging reachable; ADR-001…005 written (stack, auth, RBAC, storage, execution) | 2 weeks |
| **PH-2 Authentication and roles** | Secure identity and permissions | F-01 (email/password, invitations, reset, sessions), F-02 (roles, permissions, guards, scope), F-26 basics (settings table, feature flags, audit interceptor), user menu, theme | PH-1 | Subtle auth bugs | Auth flow tests; permission matrix tests; security tests (throttling, token reuse) | AC-16.2, AC-16.3 pass; every route declares permission | 2 weeks |
| **PH-3 Admin and student management** | Onboard people and batches | F-03 (users, students, import, verification), F-04, F-05 (programmes, batches, members, trainers), F-20 (in-app + email notifications, announcements), F-25 (basic search), admin shell and tables, trainer shell | PH-2 | Import edge cases; data model churn | Import fixtures; state machines; E2E admin flows | AC-16.1; a batch with trainers and 200 students can be created in under 30 minutes | 2–3 weeks |
| **PH-4 Course and learning management** | Deliver content and classes | F-06 (builder, catalogue, player, publications), F-07 (file registry, presigned uploads), video provider adapter, F-08 (series, occurrences, reminders, calendar), F-13 (roll-call attendance, corrections), F-14 (activity events, progress), student dashboard and schedule | PH-3; video provider account | Video integration; timezone bugs; progress consistency | Player E2E; recurrence tests; attendance formula tests; load test on lesson progress writes | AC-03.x, AC-04.x, AC-05.x, AC-02.x pass | 3–4 weeks |
| **PH-5 Assignments and assessments** | Practice and testing without code execution | F-09 (MCQ/true-false/fill/descriptive authoring, import, versions; coding/SQL/web authoring UI prepared), F-10 (assignments, modules, unlocking, submissions, grading queue), F-11 (tests, schedules, attempt engine, autosave, results, release, monitor), F-19 core metrics (students, active, batch-wise, course-wise, attendance, completion, scores, assignment status) with XLSX/CSV export | PH-4 | Attempt engine correctness under load; grading edge cases | Timer/concurrency tests; grading fixtures; load test 200 concurrent test takers; metric fixture tests | AC-06.x, AC-07.x, AC-01.1–01.3 pass | 3–4 weeks |
| **PH-6a Coding practice (MVP)** | Secure code execution and coding questions | Execution VM with Judge0; F-12 service (queue, worker, quotas, verdicts, SSE); F-12a Code Practice (problem list/workspace, points); coding questions inside assignments and tests; execution monitoring; security test suite; runbook | PH-5; execution VM | Sandbox setup on host; performance; abuse | Language matrix; limit/abuse suite; 50-concurrent load; E2E solve flows | AC-08.1–08.3 pass; security suite green; MVP release gate (PH-10 mini) | 3 weeks |
| **MVP hardening and release (PH-10 pass 1)** | Launch the MVP | Security scan, load tests, UAT with a pilot batch, docs, training for admins/trainers, production setup, backups verified, go-live, 2-week hypercare | PH-6a | Pilot feedback volume | Full regression; UAT scripts | Pilot batch runs one full week on production without P1 incidents | 2 weeks |
| **PH-6b Labs (Standard)** | Remaining practice modes | F-12b Debug Challenges, F-12c Playground, F-12d SQL Lab (SQLite via Judge0; MySQL runner if required), F-12e Web Lab (sandboxed iframe + checks), authoring editors P-G02/G03 | PH-6a | SQL dialect decision; iframe sandbox hardening | Lab-specific suites | AC-08.4; SQL comparison fixtures | 2–3 weeks |
| **PH-7 Progress, gamification and reports** | Complete the admin dashboard and engagement loop | F-19 full (all 15 metrics incl. projects/placement/certificates/feedback placeholders until their modules land; PDF exports; scheduled reports; definitions), F-22 (points, streaks, leaderboards, badges), F-14 derived skills, trainer performance report, report pages for trainers/placement scope | PH-6a | Aggregation performance; metric definition disputes | Metric fixtures; PDF snapshot tests; performance tests | AC-01.4; all metrics documented; leaderboard opt-out works | 2–3 weeks |
| **PH-8a Projects, certificates, feedback, doubts, events** | Standard learning extras | F-15, F-16, F-18, F-27, F-28; CR-S03/S04 dashboard widgets | PH-7 | Certificate design approval | Feature suites | AC-09.x, AC-10.x, AC-13.x pass | 2–3 weeks |
| **PH-8b Placement and career** | Placement module | F-17 (companies, drives, eligibility, pipeline, offers, kits, readiness, reports), F-21 resume generator, student drives board/tracker, placement dashboard | PH-8a; placement team decisions (Q-06, Q-28) | Eligibility rule complexity; process fit with the placement team | Rule engine fixtures; pipeline E2E; report reconciliation | AC-11.x, AC-12.x pass; Standard release gate (PH-10 pass 2) | 3 weeks |
| **PH-9 Additional integrations and AI (Advanced)** | Optional integrations and AI features | OTP login (after DLT), QR attendance, Zoom/Meet API (optional), SMS/WhatsApp adapters, calendar sync, F-23 AI assistant, F-24 mock interviews, public portfolio, advanced analytics, test-integrity extras | PH-8; AI budget and provider keys; DLT registration | AI quality and cost; provider approvals (DLT can take weeks) | Prompt regression suite; cost tests; integration sandboxes | AC-14.x pass; cost dashboard; client accepts quality on evaluation set; Advanced release gate (PH-10 pass 3) | 3–5 weeks |
| **PH-10 Testing, hardening and deployment** | Release readiness (run before each release) | Full regression, security scan (ZAP, dependency, sandbox suite), load test, accessibility audit, UAT, documentation freeze, release notes, production deployment, monitoring review, backup/restore drill, hypercare | Preceding phase | Late-found defects | All suites | Release checklist complete; sign-off | 1–2 weeks per release |

### 19.3 Timeline summary

| Release | Phases | Cumulative duration (2–3 engineers) |
|---|---|---|
| MVP | PH-1 → PH-6a + hardening | 14–18 weeks |
| Standard | + PH-6b, PH-7, PH-8a, PH-8b + hardening | + 8–12 weeks (22–30 total) |
| Advanced | + PH-9 + hardening | + 6–10 weeks (28–40 total) |

Client-side prerequisites that can start immediately during PH-0: provider accounts (domain, Cloudflare, video hosting, email), hosting account, brand assets, SMS DLT registration (if OTP is wanted), content inventory (videos, question banks, company kits), pilot batch selection, and answers to §21.

---

## 20. Complexity, Cost and Risk Analysis

### 20.1 Technical complexity by feature

| Complexity | Features | Notes |
|---|---|---|
| **Low** | F-04 trainer management, F-25 basic search, F-28 events, bookmarks, announcements, certificate verification page | Standard CRUD on the foundation |
| **Medium** | F-01 auth, F-02 RBAC, F-03 users/import, F-05 batches, F-07 files, F-08 schedule, F-13 attendance, F-14 progress, F-15 projects, F-16 certificates, F-18 feedback, F-20 notifications, F-21 profile/resumes, F-22 gamification, F-26 admin, F-27 doubts | Well-understood patterns; complexity is in rules and edge cases |
| **High** | F-06 courses (builder + video + progress), F-09 question bank (all types, versions, validation), F-10 assignments, F-11 tests (attempt engine), F-17 placement (rules, pipeline), F-19 reports (definitions, aggregates, exports), F-12d SQL Lab, F-12e Web Lab, F-23 AI assistant | Multi-module interactions, concurrency, or integration |
| **Very high** | F-12 execution service and F-12a coding practice (infrastructure, security, performance), F-24 AI mock interviews (quality evaluation) | Specialist infrastructure and evaluation work |

### 20.2 Development effort versus external service costs

**Development effort** is the engineering time in §19 (planning ranges). **External service costs** are recurring third-party fees, listed below with the figures verified in September 2026 (Appendix C). All are to be re-verified at procurement; taxes (GST) are excluded.

| Service | Assumed usage (5,000 students, 500 concurrent) | Indicative monthly cost | Source basis |
|---|---|---|---|
| App VM (4 vCPU / 8 GB) | 1 | USD 25–60 | Vendor list prices; Hetzner shared plans were €8.49–€15.99 before becoming unavailable in Sept 2026; DigitalOcean/AWS Lightsail comparable |
| Execution VM (4 vCPU / 8 GB) | 1 | USD 25–60 | Same |
| Managed PostgreSQL | Small instance, ~20 GB | USD 15–80 | Neon: USD 0.106/CU-hour + USD 0.35/GB-month (Launch); DigitalOcean managed from ~USD 15 |
| Object storage (R2) | 500 GB resources/docs/exports | ≈ USD 8 (+ operations) | USD 0.015/GB-month, egress free |
| Video hosting | 500 h library, 50,000 viewing hours/month (≈ 3 M minutes) | Bunny Stream: roughly USD 40–120 (storage by GB + delivery ≈ USD 0.005/GB); Cloudflare Stream: ≈ USD 150 storage (30,000 min × USD 5/1,000) + ≈ USD 3,000 delivery (3 M min × USD 1/1,000) | Cloudflare Stream delivery pricing makes it expensive at high viewing volumes; Bunny's per-GB model suits long recordings. **Volume assumptions must be confirmed [Q-13].** |
| Email | 50,000/month | USD 0–20 | Resend free 3,000/month; Pro USD 20 for 50,000 |
| SMS OTP (optional) | 20,000 OTPs/month | Provider-specific (Indian SMS typically fractions of a rupee per message; DLT registration required) — **verify** | Not verified |
| Code execution | Self-hosted Judge0 | USD 0 beyond the execution VM; Judge0 Cloud alternative €27–107/month for 2,000–10,000 submissions/day | judge0.com |
| Error monitoring / uptime | Sentry developer/team tier, Uptime Kuma self-hosted | USD 0–30 | Vendor tiers |
| Cloudflare (DNS, proxy, WAF basics, Turnstile) | Free plan | USD 0 | — |
| Domain and certificates | 1 domain; TLS via Let's Encrypt | ≈ USD 1–2 (annual fee amortised) | — |
| AI features (Advanced) | See sensitivity table | USD 0 with flag off; otherwise budget-driven | Anthropic price table |
| **Total without AI and SMS** | | **≈ USD 100–300/month** (Bunny Stream) or **≈ USD 250–3,300/month** (Cloudflare Stream at high viewing volume) | |

**AI cost sensitivity (illustrative).** Assumptions: 1,000 active students, 10 assistant messages per student per day, ~1,500 input tokens and ~400 output tokens per message, 30 days → 300,000 messages/month.

| Model | Price (input / output per million tokens) | Cost per message | Monthly cost | With ~50% cached input (prompt caching) |
|---|---|---|---|---|
| `claude-opus-5` (default, highest quality) | USD 5 / USD 25 | ≈ USD 0.0175 | ≈ USD 5,250 | ≈ USD 3,800 |
| `claude-sonnet-5` | USD 2 / USD 10 | ≈ USD 0.007 | ≈ USD 2,100 | ≈ USD 1,500 |
| `claude-haiku-4-5` (simple modes only) | USD 1 / USD 5 | ≈ USD 0.0035 | ≈ USD 1,050 | ≈ USD 750 |

Quotas (messages/day/student) and per-batch enablement are the budget controls; the client sets the monthly ceiling and the model per mode after an evaluation of answer quality **[Q-20]**. Mock interviews cost more per session (longer contexts) and should be quota-limited (e.g. 2 per student per week).

### 20.3 Risk register

| ID | Category | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | Scope | Requirements are a wish-list; scope creep during build | High | High | Approved tiers and change-control (Rule 24); backlog with IDs; phase gates | Client + lead |
| R-02 | Scope | Trainer/placement workflows assumed without client input | Medium | High | Q-06 and Q-28 before PH-3/PH-8; prototype reviews with the actual staff | Client |
| R-03 | Development | Test attempt engine correctness under concurrency | Medium | High | Server-authoritative design, fake-clock tests, load tests in PH-5 | Lead |
| R-04 | Infrastructure | Judge0 host setup (kernel/cgroup requirements) and performance | Medium | High | Provision execution VM early in PH-6a; follow vendor install notes; fallback to Judge0 Cloud | Lead/DevOps |
| R-05 | Security | Sandbox escape or resource abuse | Low | Critical | Isolated VM, no credentials, limits, quotas, security suite, patching | Lead |
| R-06 | Security | Personal data exposure (guardian contacts, documents) | Medium | High | Field gating, encryption, minimisation (Q-30), audit, DPDP review | Lead + client legal |
| R-07 | Integration | Video provider limits or cost surprises at high viewing volumes | Medium | Medium | Adapter abstraction; volume estimate (Q-13); monitor delivery minutes; choose per-GB pricing | Client + lead |
| R-08 | Integration | SMS OTP delayed by DLT registration | High | Low | Email/password first; OTP as Standard; start registration early | Client |
| R-09 | Cost | AI usage exceeds budget | Medium | Medium | Flags, quotas, budget alerts, model per mode, caching | Client + lead |
| R-10 | Maintenance | Small team bus factor | Medium | High | Documentation, ADRs, runbooks, conventional structure, tests | Lead |
| R-11 | Development | Content authoring effort underestimated (videos, questions, kits are the client's work) | High | High | Content inventory in PH-0; import tools early (PH-5); content freeze dates per batch | Client |
| R-12 | Infrastructure | Backup/restore never tested | Medium | Critical | Weekly automated restore drill in staging; runbook | DevOps |
| R-13 | Development | Framework major upgrades (Next.js, NestJS, Prisma) mid-project | Medium | Medium | Pin versions in PH-1; upgrade only at phase boundaries with ADR | Lead |
| R-14 | Scope | Reference-portal features assumed necessary (e.g. employability score) | Medium | Low | Explicit tiering; client confirms per feature | Client |
| R-15 | Cost | Hosting vendor availability/pricing changes (e.g. Hetzner shared plans unavailable in Sept 2026) | Medium | Low | Vendor-agnostic Docker deployment; two candidate vendors | DevOps |
| R-16 | Security | Answer-key leakage through API responses | Low | High | Separate student DTOs; automated response-shape tests | Lead |
| R-17 | Development | Trademarked feature names reused | Low | Medium | Rename now (C-01) | Client |

---
