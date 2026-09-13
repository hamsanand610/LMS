## 21. Open Questions and Decisions Required

Questions marked **Blocking** must be answered before Phase 1 starts; others are needed before the phase indicated. Each has a proposed default that will be used if the client prefers to defer.

| ID | Question | Why it matters | Proposed default | Needed by | Blocking |
|---|---|---|---|---|---|
| Q-01 | What is the product name (and public domain)? | Branding in UI, emails, certificates, routes | Working codename "LMS" | PH-1 | Yes |
| Q-02 | Brand assets: logo, colours, typography? | Design tokens, certificate design | Neutral palette with one accent until provided | PH-1 | Yes |
| Q-03 | Expected volumes and service levels: students per year, concurrent users, availability target, support hours? | Sizing, SLA, cost | ≤ 5,000 students, 500 concurrent, 99.5% | PH-1 | Yes |
| Q-04 | Hosting region and vendor preference; existing accounts (AWS/DO/Hetzner/Cloudflare)? | Latency, data residency, cost | India/Singapore region on DigitalOcean or AWS Lightsail + managed PostgreSQL; Cloudflare | PH-1 | Yes |
| Q-05 | Definitions: "student" (enrolled only?), "active student" (7/30 days), "course completion" (100% mandatory lessons?), "assignment done" (100%?) | Admin metrics correctness | As proposed in §4.2 and card R-01 | PH-5 | No |
| Q-06 | Will trainers and a placement team actually use the platform, and who are they? | Trainer and placement portals scope | Yes to both | PH-3 / PH-8 | Yes |
| Q-07 | Are payments, fee tracking or invoices in scope? | Adds a module and gateway | Out of scope | PH-0 | Yes |
| Q-08 | Programme/course structure: do batches follow a fixed programme of courses, or are courses assigned ad hoc? | Data model | Programme templates with per-batch overrides | PH-3 | No |
| Q-09 | Login method for students: email/password, mobile OTP, or both? Staff two-factor? | Auth design, SMS costs, DLT | Email/password (MVP), OTP (Standard), staff 2FA (Standard) | PH-2 | Yes |
| Q-10 | What are "webinars and workshops" and "interview progress" in your operation? | CR-S03/S04 modelling | Events module (Standard); mock interview attendance | PH-8 | No |
| Q-11 | Which live-class tool (Zoom, Google Meet, other)? Is API integration (auto-create meetings, join logs, cloud recordings) wanted? | Schedule design, attendance automation, cost | Links only in MVP; API integration optional later | PH-4 | No |
| Q-12 | Attendance method: trainer roll-call, QR in classroom, automatic from online joins? Are classes offline, online or both? | Attendance design | Roll-call (MVP), QR (Standard) | PH-4 | No |
| Q-13 | Where are existing videos today, how many hours, expected monthly viewing hours, and is a paid video host acceptable? | Video cost and migration | Bunny Stream; migrate library in PH-4 | PH-4 | Yes |
| Q-14 | Programming languages for coding questions at launch? | Runtime catalogue, tests | Java, Python, JavaScript, C, C++, SQL | PH-6a | No |
| Q-15 | SQL dialect for SQL Lab: MySQL-specific syntax required, or is SQLite/PostgreSQL-compatible SQL acceptable? | SQL runner design | SQLite first; MySQL runner if required | PH-6b | No |
| Q-16 | Trainer performance: formula, weights, and who may see it? | Sensitive HR metric | Composite (attendance, scores, feedback, punctuality); Admin only | PH-7 | No |
| Q-17 | Student feedback: anonymous by default? Frequency? | Feedback design | Anonymous, weekly per batch | PH-8a | No |
| Q-18 | Certificate design, signatory, issuance rules, QR verification? | Certificates | Course completion at 100% mandatory lessons + test average ≥ 50%; QR verification | PH-8a | No |
| Q-19 | Test integrity level: basic (timer, shuffling, tab-switch logging) or stricter (lockdown, proctoring)? | Assessment design | Basic; proctoring out of scope | PH-5 | No |
| Q-20 | AI features: approved? Monthly budget? Model preference (quality vs cost)? Text-only interviews acceptable? | Advanced scope and cost | Approved for Advanced tier, flag-gated, budget to be set | PH-9 | No |
| Q-21 | Student profile fields: which are mandatory, which sensitive fields are needed (guardian contact, permanent address, social links)? | Privacy, form design | Minimal mandatory set; sensitive fields optional | PH-3 | No |
| Q-22 | Report and PDF branding, required charts, scheduled report recipients? | Reports | Institute logo header; standard charts | PH-7 | No |
| Q-23 | Gamification: streaks, points and leaderboards wanted? Public or opt-in leaderboards? | Engagement design | Yes, opt-in display names | PH-7 | No |
| Q-24 | Course discussions and ratings wanted? | Course features | Standard tier | PH-8a | No |
| Q-25 | Are there offline classrooms needing QR/in-person attendance? | Attendance | Yes (Standard) | PH-6b | No |
| Q-26 | Existing question banks, tests and company kits: formats and volumes for migration? | Import tools | XLSX/CSV/JSON importers | PH-5 | No |
| Q-27 | Expected peak concurrent code submissions and test takers? | Execution sizing | 50 submissions, 200 test takers | PH-6a | No |
| Q-28 | Placement eligibility rules used today (passing year, degree, attendance, scores, backlogs)? | Rule engine | Rules as proposed in F-17 | PH-8b | No |
| Q-29 | Should hiring companies get any portal access? | Future scope | No | Future | No |
| Q-30 | Can sensitive personal fields be minimised (drop Instagram, native city, guardian contact unless needed)? | Privacy | Minimise | PH-3 | No |
| Q-31 | Self-registration or invite-only accounts? | Auth and onboarding | Invite-only | PH-2 | Yes |

Blocking questions: Q-01, Q-02, Q-03, Q-04, Q-06, Q-07, Q-09, Q-13, Q-31 (plus renaming confirmation C-01).

---

## 22. CLAUDE DEVELOPMENT OPERATING RULES

These rules govern all AI-assisted development on this project. They are binding for Claude (and any other assistant) and are to be copied into the repository as `docs/CLAUDE_OPERATING_RULES.md` and referenced from `CLAUDE.md` when the project structure is created (Step 8).

### 22.1 Process rules

1. **Do not start coding before the approved architecture is available.** Development begins only after the client approves this report (§24) and the Phase 8 deliverables (structure, conventions, backlog).
2. **Do not invent requirements.** Implement only items that exist in the approved backlog with an ID. If something seems missing, raise it as a question or a proposed backlog item; do not build it speculatively.
3. **Do not silently change the technology stack.** Any deviation from §12 requires an Architecture Decision Record (ADR) approved by the lead and, for cost-bearing changes, by the client.
4. **Do not modify unrelated modules.** A task touches the files it needs; incidental refactors go into a separate, clearly labelled change.
5. **Do not introduce unnecessary dependencies.** Prefer platform features and existing packages; a new dependency needs a one-line justification in the PR, a licence check and a maintenance assessment.
6. **Follow the approved folder structure** (Step 8 deliverable). New modules follow the module template.
7. **Follow consistent naming conventions**: kebab-case files, PascalCase components/classes, camelCase variables/functions, snake_case database columns, `resource:action` permissions, `PH-`/`F-`/`CR-` identifiers in commit and PR titles.
8. **Use environment variables for secrets and configuration.** Validate them at boot; document every variable in `.env.example`.
9. **Never hardcode credentials, API keys, tokens or personal data** in code, tests, fixtures, logs, documentation or commit messages.
10. **Follow secure coding practices** (§16): validate input, encode output, parameterise queries, least privilege, no `eval`, no disabling security controls to make something work.
11. **Keep frontend, backend and database responsibilities clear.** The frontend never accesses the database or storage directly; business rules live in API services; the database enforces integrity with constraints; workers run background work.
12. **Write maintainable, modular code**: small functions, explicit types, no cross-module repository imports, domain events for cross-module effects, comments only where intent is not obvious.
13. **Validate all inputs** at every boundary (HTTP, jobs, imports, webhooks, environment) with shared Zod schemas.
14. **Implement proper error handling**: typed domain errors, problem+json responses, no swallowed exceptions, no stack traces to clients, user-facing messages that say what to do next.
15. **Add tests for important functionality** before marking work complete: unit for rules, integration for data access, API for endpoints (including permission allow/deny), E2E for user journeys.
16. **Respect role-based access control**: every endpoint declares a permission and scope; every new permission is added to the catalogue, matrix and tests.
17. **Do not mark incomplete functionality as complete.** Partial work is reported as partial with what remains; no "TODO" hidden behind a green checkbox.
18. **Report blockers clearly and early**: missing decision, failing environment, unclear requirement, external dependency — state what is blocked, why, and what is needed.
19. **Ask for clarification when requirements are ambiguous** instead of guessing; when a guess is unavoidable to keep moving, state it explicitly as an assumption in the PR and progress log.
20. **Maintain a development progress log** (`docs/PROGRESS_LOG.md`): date, phase, items completed with IDs, tests run, blockers, next steps. Update it at the end of every working session.
21. **Record architectural decisions** as ADRs (`docs/adr/NNNN-title.md`: context, decision, alternatives, consequences, status).
22. **Keep database migrations version-controlled** (Prisma Migrate), reviewed, backward-compatible (expand/contract), and never edited after being applied to a shared environment.
23. **Do not perform destructive database operations without approval**: no dropping tables/columns, truncations, mass deletes or resets on shared environments without explicit written approval and a verified backup.
24. **Do not change approved scope without confirmation**: additions, removals and re-tiering go through the backlog with client confirmation.
25. **Complete one approved phase at a time**: do not start a later phase before its dependencies are completed, tested and approved.

### 22.2 Additional rules for reliable AI-assisted development

26. **Verify before asserting.** Do not claim that a page was inspected, a test passed, a command succeeded or a library API exists unless it was actually observed in this session. Quote outputs.
27. **Pin and check versions.** Use the versions recorded in the lockfile and `docs/STACK.md`; check the installed version before using an API; do not rely on memory for library signatures — read the installed package's types or docs.
28. **Run the checks before declaring done**: lint, type-check, unit/integration tests for touched modules, and the relevant E2E smoke; include the command output summary in the PR/progress log.
29. **Never disable or weaken tests, linters, type checks or security rules** to get a green build; fix the cause or raise a blocker.
30. **Keep changes small and reviewable**: one backlog item per PR where possible; PR description lists IDs, what changed, how it was tested, and any assumptions.
31. **Use the shared schema package** for validation and types; do not duplicate schemas in web or API.
32. **Regenerate the API client** after OpenAPI changes and commit it in the same PR.
33. **Timezones**: store UTC, display IST (Asia/Kolkata) via shared utilities; never use local machine time in business logic.
34. **Accessibility is part of done**: keyboard operability, labels, contrast and focus states for every new UI.
35. **Feature flags for anything optional or costly** (AI, gamification, OTP, labs): default off in production until approved.
36. **Do not log personal data or secrets**; use structured logs with IDs.
37. **No production data on local machines**; use seed data and factories.
38. **Document as you go**: every module has a `README.md` (purpose, entities, endpoints, jobs, flags, permissions); every runbook is updated when operations change.
39. **Idempotent and retry-safe jobs**: every background job can be re-run without side effects.
40. **Security checklist per PR**: input validation, permission declared, sensitive data handling, no new secrets, dependency review.
41. **Respect the three environments**: never point local tooling at production; production changes only through the pipeline.
42. **When a phase gate is reached, stop and report**: summarise deliverables, test evidence, open issues, and request approval before continuing.
43. **Do not copy code or content from the reference portal or other proprietary sources.** Use only the functional patterns documented here.
44. **Prefer explicit over clever**: readable code and obvious data flows over abstractions that only the author understands.
45. **Update this report and the backlog when reality changes**: if a decision or discovery invalidates a section, propose the amendment rather than working around it silently.

---

## 23. Final Recommendations

1. **Approve scope by tier, not by wish-list.** Confirm the MVP list (§6.8) and treat Standard and Advanced as separate, budgeted releases.
2. **Answer the nine blocking questions** (§21) and confirm the renaming of the practice modules before Phase 1.
3. **Start client-side prerequisites now**: provider accounts, brand assets, content inventory, pilot batch selection, and SMS DLT registration if OTP is wanted.
4. **Adopt the single-language TypeScript stack** (§12) and the modular-monolith architecture with two isolated processes (worker and execution). Resist microservices and vendor-locked backends.
5. **Isolate code execution from day one** on a separate VM with self-hosted Judge0; keep Judge0 Cloud as a documented fallback.
6. **Gate AI behind flags, quotas and budgets**, evaluate answer quality on a small set before enabling for all students, and choose the model per mode with cost visibility.
7. **Choose a per-GB video host** (Bunny Stream) unless viewing volumes are small; estimate viewing hours before committing.
8. **Use managed PostgreSQL** with point-in-time recovery; rehearse restores.
9. **Invest in import tools and content workflows early** (Phase 5); content readiness is the most common cause of launch delay.
10. **Run a pilot batch on the MVP** for at least one full week before general rollout, and keep two weeks of hypercare.
11. **Keep this report as the living project context**: update §4, §6, §19 and §21 at each phase gate; enforce §22 in every session.

---

## 24. Approval Checklist

| # | Item | Decision / signature | Date |
|---|---|---|---|
| 1 | Requirements inventory (§4.2–4.3) reviewed; interpretations accepted or corrected | ☐ Approved ☐ Changes requested | |
| 2 | Duplicates, conflicts and assumptions (§4.6–4.7) resolved | ☐ | |
| 3 | Reference portal analysis (§5) accepted as guidance | ☐ | |
| 4 | Product vision, boundaries and tiers (§6) approved; MVP feature list confirmed | ☐ | |
| 5 | Roles and permission matrix (§7) approved; trainer and placement usage confirmed (Q-06) | ☐ | |
| 6 | Page inventory and navigation (§8) approved as the basis for wireframes | ☐ | |
| 7 | Feature specifications (§9) approved for MVP features | ☐ | |
| 8 | Coding lab architecture (§10) approved, including isolated self-hosted execution and language list | ☐ | |
| 9 | UI/UX strategy (§11) approved; brand assets supplied or neutral default accepted | ☐ | |
| 10 | Technology stack (§12) approved; hosting and provider choices confirmed (Q-04, Q-13) | ☐ | |
| 11 | System architecture (§13) approved | ☐ | |
| 12 | Preliminary database design (§14) accepted as a starting point | ☐ | |
| 13 | API conventions (§15) approved | ☐ | |
| 14 | Security plan (§16) approved; privacy/legal review scheduled | ☐ | |
| 15 | Testing strategy (§17) and Definition of Done approved | ☐ | |
| 16 | Deployment and operations plan (§18) approved | ☐ | |
| 17 | Roadmap and phase gates (§19) approved; timeline understood as an estimate | ☐ | |
| 18 | Cost and risk analysis (§20) acknowledged; AI and video budgets set | ☐ | |
| 19 | Open questions (§21) answered or defaults accepted | ☐ | |
| 20 | Claude Development Operating Rules (§22) adopted | ☐ | |
| 21 | Practice module names confirmed (replacing CodeKata/WebKata/SQLKata/FixTheCode/IDE) | ☐ | |
| 22 | Authorisation to proceed to Step 8 (project structure, conventions, backlog) | ☐ | |

---

## Appendix A. Glossary

| Term | Meaning |
|---|---|
| Batch | A cohort of students following a programme together with fixed dates, trainers and timetable |
| Programme | A curriculum template (set of courses, duration, certificate) instantiated as batches |
| Course / Module / Lesson | Content hierarchy; lessons are video, reading, resources, practice or live recordings |
| Assignment | A practice set of question-bank items organised in modules, published to batches |
| Test | A timed, scheduled assessment with results and analytics |
| Practice / Lab | Self-directed problem solving: Code Practice, Debug Challenges, SQL Lab, Web Lab, Playground |
| Execution service | The isolated system (Judge0) that compiles and runs student code |
| Drive | A placement opportunity from a company with eligibility rules, rounds and deadline |
| Kit | A company-specific preparation bundle (documents, videos, question sets) |
| Employability / readiness score | A transparent composite of progress, scores, attendance and profile completeness (to be defined if adopted) |
| DPDP | India's Digital Personal Data Protection Act, 2023 |
| DLT | Telecom registration required in India to send commercial SMS (templates and sender IDs) |
| ADR | Architecture Decision Record |
| MoSCoW | Must / Should / Could / Won't (Not Planned) prioritisation |

## Appendix B. Requirement traceability matrix

| Requirement | Feature(s) | Key pages | Phase |
|---|---|---|---|
| CR-A01–A04 | F-03, F-05, F-19 | P-E01, P-E03, P-E07, P-E17 | PH-3, PH-5 |
| CR-A05 | F-13, F-19 | P-D04, P-E17, P-C01 | PH-4, PH-5 |
| CR-A06 | F-14, F-19 | P-E01, P-E17 | PH-4, PH-5 |
| CR-A07 | F-11, F-19 | P-E11, P-E17 | PH-5 |
| CR-A08 | F-10, F-19 | P-E10, P-E17 | PH-5 |
| CR-A09 | F-15, F-19 | P-E12, P-E17 | PH-8a |
| CR-A10 | F-04, F-19 | P-E05, P-E17 | PH-7 |
| CR-A11, A12 | F-17, F-19 | P-F01, P-F07, P-E17 | PH-8b |
| CR-A13 | F-16, F-19 | P-E13, P-E17 | PH-8a |
| CR-A14 | F-18, F-19 | P-E14, P-E17 | PH-8a |
| CR-A15 | F-19 | P-E17, P-E18 | PH-5 (XLSX), PH-7 (PDF, scheduled) |
| CR-S01, S02, S32 | F-14 | P-C01, P-C23 | PH-4 |
| CR-S03 | F-28 | P-C34, P-C01 | PH-8a |
| CR-S04 | F-15, F-17, F-24 | P-C01, P-C17 | PH-8 |
| CR-S05 | F-08 | P-C02, P-C01 | PH-4 |
| CR-S06, S08, S09 | F-06, F-07 | P-C03–C05 | PH-4 |
| CR-S07 | F-08 | P-C02, P-D02 | PH-4 (links), PH-9 (API) |
| CR-S10 | F-16 | P-C22, P-A02 | PH-8a |
| CR-S11 | F-12, F-12a | P-C13–C15, P-C08 | PH-6a |
| CR-S12 | F-12e | P-C14 (web), P-G03 | PH-6b |
| CR-S13 | F-12d | P-C14 (sql), P-G02 | PH-6b |
| CR-S14 | F-12b | P-C14 (debug) | PH-6b |
| CR-S15 | F-12c | P-C16 | PH-6b |
| CR-S16, S19, S31 | F-15, F-21 | P-C17, P-C23 | PH-8a |
| CR-S17 | F-09, F-10 | P-C06–C08, P-E09, P-E10 | PH-5 |
| CR-S18 | F-09, F-11 | P-C09–C12, P-E11 | PH-5 |
| CR-S20, S28 | F-24 | P-C31 | PH-9 |
| CR-S21, S33 | F-21 | P-C25 | PH-3 (upload), PH-8b (generate) |
| CR-S22 | F-21 | P-A04 | PH-9 |
| CR-S23, S24 | F-17 | P-C18–C21 | PH-8b |
| CR-S25, S26, S27 | F-23, F-27 | P-C30, P-C32, P-D09 | PH-8a (doubts), PH-9 (AI) |
| CR-S29, S30 | F-21 | P-C23, P-C24 | PH-3 |
| IR-01, IR-02 | F-01, F-02 | P-B01–B07 | PH-2 |
| IR-03–IR-05 | F-03–F-05 | P-E02–E07 | PH-3 |
| IR-06–IR-09 | F-06–F-08, F-13 | P-E08, P-D02, P-D04 | PH-4 |
| IR-10–IR-13 | F-09–F-12 | P-E09–E11, P-G01 | PH-5, PH-6a |
| IR-14–IR-17 | F-15–F-18 | P-E12–E14, P-F01–F07 | PH-8 |
| IR-18–IR-25 | F-20, F-25, F-07, F-26, F-19, F-22 | P-C27, P-C29, P-I01–I09 | PH-2–PH-7 |

## Appendix C. Sources

Reference and client materials: client ZIP (four screenshots, §3.1); reference portal pages inspected (§3.2).

Public web sources consulted (September 2026):

- Tap Academy public site — https://thetapacademy.com/ and https://thetapacademy.com/placements/
- Reference portal — https://tai.thetapacademy.com/ (login page public; student pages via the existing authenticated session)
- HCL GUVI product pages — https://www.guvi.in/code-kata/ , https://www.guvi.in/webkata/ , https://www.guvi.in/sqlkata/ , https://www.guvi.in/ide/ , https://www.guvi.in/faq/
- Judge0 — https://github.com/judge0/judge0 (GPL-3.0, isolate, 90+ languages) and https://judge0.com/ (cloud plans: Pro €27, Ultra €54, Mega €107 per month; €0.001 per extra submission)
- Piston — https://github.com/engineer-man/piston (MIT; isolate in Docker; public API non-commercial)
- Cloudflare Stream pricing — https://developers.cloudflare.com/stream/pricing/ (USD 5 per 1,000 minutes stored; USD 1 per 1,000 minutes delivered)
- Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing/ (USD 0.015/GB-month; Class A USD 4.50/M; Class B USD 0.36/M; free egress; 10 GB free)
- Bunny Stream pricing (via search results; confirm on vendor page) — https://bunny.net/stream/
- Resend pricing — https://resend.com/pricing (free 3,000/month, 100/day; Pro USD 20/month for 50,000)
- Razorpay pricing — https://razorpay.com/pricing/ (2% domestic; up to 3% international; no setup/AMC; 18% GST on fees)
- Neon pricing — https://neon.com/pricing (Free 0.5 GB/project, 100 CU-hours; Launch USD 0.106/CU-hour, USD 0.35/GB-month)
- Hetzner Cloud pricing (via search results: CX23 €5.49, CX33 €8.49, CX43 €15.99 as of June 2026; shared plans reported unavailable for new orders in September 2026) — https://www.hetzner.com/cloud/
- Next.js releases — https://nextjs.org/blog (16.x active LTS; 15.5.x maintenance LTS)
- NestJS releases — https://github.com/nestjs/nest/releases (v12, August 2026)
- Prisma ORM — https://www.prisma.io/blog/announcing-prisma-orm-7-0-0 and https://www.prisma.io/changelog
- Drizzle ORM releases — https://orm.drizzle.team/docs/latest-releases (1.0 release candidate)
- Anthropic model pricing — price table cached in the Claude API reference used during this session (June 2026): Opus 5 USD 5/25, Sonnet 5 USD 2/10, Haiku 4.5 USD 1/5 per million input/output tokens; verify at https://docs.anthropic.com/ before procurement

*End of report.*
