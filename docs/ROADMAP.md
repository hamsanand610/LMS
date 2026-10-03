# SI Academy — Active Roadmap

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status        | **CURRENT / ACTIVE — the controlling implementation plan**                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Set by        | The client, 2 October 2026 ("Master product direction reset — roadmap lock and architecture alignment")                                                                                                                                                                                                                                                                                                                                                                                                                |
| Recorded      | 2 October 2026, in Phase 0; the client reviewed and locked it the same day                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Current phase | **None in progress. Phase 5 — Cross-module enterprise integration: not started; it needs the client's explicit approval.** Phases 3 and 4, combined by the client — Trainer and staff completion, Admin and operations completion: complete and approved on 3 October 2026 with ADR-0023 (`docs/phases/PHASE-03-04-trainer-and-admin.md`). Phase 2 — Complete student experience: complete and approved on 3 October 2026 with ADR-0022 (`docs/phases/PHASE-02-learner-experience.md`). Phase 1: complete and approved |
| Next phase    | Phase 5 — Cross-module integration: not started; it begins only on the client's explicit approval                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Supersedes    | The roadmap in `docs/ARCHITECTURE_DEMO_TEMPLATE_PLAN.md` §24 and the phase plan in `docs/PLANNING_REPORT.md` §19. Both documents are kept as historical records                                                                                                                                                                                                                                                                                                                                                        |

What the product is: `docs/product/PRODUCT_DIRECTION.md`. Where each phase starts from (what is built,
partial or missing, with evidence): `docs/product/IMPLEMENTATION_ROADMAP.md`. The architecture:
`docs/architecture/OVERVIEW.md`, and for the AI layer `docs/architecture/AI_ARCHITECTURE.md`.

## Release path

```
PHASE 0 ─▶ LABS & PLAYGROUND ─▶ STUDENT COMPLETION ─▶ TRAINER COMPLETION ─▶ ADMIN COMPLETION
        ─▶ CROSS-MODULE INTEGRATION ─▶ SECURITY + CODE HARDENING ─▶ AI FOUNDATION ─▶ RAG
        ─▶ AI LEARNING AGENT ─▶ AI EVALUATION + SECURITY ─▶ ADVANCED AI ─▶ PERFORMANCE / POE REFINEMENT
        ─▶ FULL AUDIT ─▶ FULL REGRESSION ─▶ STAGING ─▶ FINAL UAT ─▶ PRODUCTION
```

## How this roadmap is used

1. **Order.** Phases run in the order above. A phase starts only when the previous phase's gate has
   passed and the client has approved it (operating rules 25 and 42). Gates are not skipped.
2. **Blocking issues.** No later phase starts while a release-blocking issue from an earlier phase
   is open.
3. **Phase plan.** Each phase opens with a phase plan, `docs/phases/PHASE-NN-<name>.md`: the items it
   delivers, each with an ID (for example `LAB-01`), acceptance criteria, the tests that prove them,
   and the ADRs the phase needs first. Once the client approves the plan, its item list is the
   approved backlog for that phase (operating rule 2).
4. **Gate report.** Each phase closes with a gate report: deliverables, test evidence, open issues.
   Then work stops until the client approves (operating rule 42).
5. **Deviation control.** If a better technical approach turns up, the roadmap is not changed
   silently. The proposal states the deviation, why it is necessary, the phases it affects and its
   risks, and the change waits for the client's explicit approval. The earlier demo / white-label
   roadmap does not return unless the client says so.
6. **Technology.** A technology enters only with a legitimate role in the product, recorded in an
   ADR (operating rules 3 and 5), never to decorate the stack.
7. **Security.** Security is never weakened to make a test pass (operating rule 29).

**Gate evidence expected in every phase** (operating rules 15, 16, 28, 34, 38, 40): lint, type-check
and unit tests; API tests including permission allow and deny for every new endpoint; browser
journeys for every new user flow; accessibility of every new screen; the security checklist; module
READMEs, runbooks and the progress log updated.

## Phases

### Phase 0 — Product and architecture realignment

**Status: complete — approved and locked by the client on 2 October 2026.** No application code
was changed.

Review the client's direction, the architecture, the ADRs, the implementation and the earlier
plans; mark the earlier plans historical; record this roadmap as the controlling plan; write the
product direction, the architecture overview and the AI architecture plan; compare the
implementation with the roadmap; identify real blockers.

**Gate:** the client approves this update.

### Phase 1 — Labs and Playground

Code Playground · SQL Lab · Web Lab · Debugging Challenges · practical exercises · lab authoring ·
trainer lab management · student lab workflows · execution integration · results · submission
history · progress integration · security boundaries.

Built on the existing secure execution architecture: every learner run goes learner → API → sandbox
runner → one locked-down container per job (ADR-0016). No learner code runs in the API process or
unsafely in the browser. Labs sit behind a module flag that stays off in production until approved
(operating rule 35).

Decisions the phase plan settles first, as ADRs:

- **Web Lab model.** How a learner's HTML, CSS and JavaScript is previewed and checked without
  running it in the platform's own origin. The web app's content security policy forbids frames
  today (`frame-src 'none'`), and ADR-0016 rules out judging code in the browser.
- **SQL Lab engine.** SQL runs on SQLite in the sandbox today (`infra/sandbox/sqlrun.py`). Whether
  the lab teaches that dialect only, or adds another engine in the sandbox.
- **Playground limits.** Free-form runs (no problem attached) need their own quotas and history.

**Gate (from the client's direction):** student flow complete; trainer authoring complete; admin
control complete; API authorisation complete; security tests pass; E2E tests pass; regression
passes; documentation updated.

### Phase 2 — Complete student experience

Audit and complete the whole learner experience: dashboard, courses, lessons, schedule, attendance,
assignments, tests, coding, SQL, web, debugging, playground, progress, streaks and gamification
where applicable, doubts, projects, certificates, documents and resources, notifications, profile,
placement and career features.

**Gate:** every major student journey works end to end, proved by browser journeys.

### Phase 3 — Complete trainer experience

Trainer dashboard, assigned batches, students, courses, lessons, attendance, assignments, questions,
tests, labs, submission review, grading and review, doubts, announcements, student progress,
performance analytics, reports.

**Gate:** the trainer is a genuine operational role; every trainer workflow works end to end.

**Status: complete — approved by the client on 3 October 2026**, built together with Phase 4
(`docs/phases/PHASE-03-04-trainer-and-admin.md`).

### Phase 4 — Complete admin and operations

Users, students, trainers, programmes, batches, enrolments, courses, content, questions,
assignments, tests, labs, attendance, reports, exports, documents, notifications, placement and
career administration, branding and settings, feature flags, audit logs, system health, privacy and
security operations.

**Gate:** every operation uses server-side authorisation, proved by the permission matrix tests.

**Status: complete — approved by the client on 3 October 2026**, built together with Phase 3.

### Phase 5 — Cross-module enterprise integration

Stop treating modules independently; verify complete journeys and remove broken cross-module
assumptions:

- **Student:** enrolment → batch → course → lesson → practice → assignment → coding → lab → test →
  progress → certificate / placement.
- **Trainer:** batch → students → course → attendance → assignment → grading → doubts → analytics.
- **Admin:** organisation → users → programmes → batches → trainers → students → courses →
  assessments → reports → system controls.

**Gate:** the three journeys pass end to end.

### Phase 6 — Code quality and security hardening

**Mandatory gate before any AI work.**

Code review: TypeScript quality, module boundaries, duplicate logic, shared types, validation, API
contracts, error handling, logging, secrets, environment configuration, dependency security.

Security audit: authentication, authorisation, RBAC, object-level authorisation, CSRF, XSS, SQL
injection, file uploads, storage access, session and token handling, rate limits, sandbox
isolation, hidden-test protection, audit logs, tenant and scope boundaries where applicable.

**Gate:** both reviews green; no security control weakened.

### Phase 7 — AI foundation

Only after Phase 6 is green. AI module, AI provider abstraction, model configuration, AI settings,
AI feature flags, conversation and message models, usage tracking, cost tracking, quotas,
streaming, context assembly, retrieval layer, embeddings, vector storage and search, LangChain
orchestration, LangGraph workflows, LangSmith observability and evaluation where appropriate. AI
secrets stay on the server.

The phase plan opens with the ADRs listed in `docs/architecture/AI_ARCHITECTURE.md` §9 (provider and
models, where orchestration runs, vector storage, embeddings, observability and data handling,
quotas and costs).

**Gate:** the foundation works end to end behind flags that stay off in production; secrets never
reach a browser; usage and cost are recorded for every call.

### Phase 8 — RAG knowledge system

LMS-specific knowledge ingestion from course descriptions, lessons, notes, documentation,
assignment problem statements, approved learning resources and trainer-created knowledge.

Pipeline: source → clean → chunk → metadata → embedding → vector storage → retrieval → reranking or
selection where justified → context assembly → model. Metadata carries what authorisation and
course / topic filtering need.

**Gate:** retrieval never returns knowledge the current user is not authorised to see, proved by
tests per role and scope.

### Phase 9 — AI Learning Agent

Real learning-agent workflows. Initial capabilities: explain a lesson; clarify doubts; explain
failed submissions; give coding hints; explain SQL mistakes; help debug; quiz the learner; generate
contextual practice; recommend relevant learning material; identify weak-topic patterns; guide
learning progression; escalate unresolved doubts to trainers.

Agent tools are explicit and controlled; no arbitrary, unrestricted tool execution.

**Gate:** every capability works against real LMS context through controlled tools, without hidden
tests, hidden answers, private trainer material or another learner's data in any prompt or reply.

### Phase 10 — AI evaluation and security

A real evaluation suite: factual correctness, grounding, relevance, hallucination, retrieval
quality, context selection, response consistency, coding guidance quality, SQL guidance quality,
learner usefulness.

Security tests: prompt injection, system prompt extraction, hidden test leakage, answer leakage,
cross-user data leakage, unauthorised retrieval, quota bypass, cost abuse, malicious uploaded
content, agent tool abuse. LangSmith or an equivalent for observability where appropriate.

**Gate:** AI is not complete because an API responds; it is complete when the evaluation and the
red-team suite pass their thresholds.

### Phase 11 — AI mock interview and advanced AI

After the AI Learning Agent is stable: interview set-up, role and topic selection, difficulty,
adaptive questions, follow-ups, timed sessions, structured evaluation, improvement recommendations,
history, quotas. Behind feature flags until quality is proven.

### Phase 12 — Performance and POE refinement

Performance: database queries, N+1 detection, API latency, frontend rendering, bundle size, caching,
background jobs, execution throughput, AI latency, streaming, storage.

UX: responsive behaviour, accessibility, loading, empty and error states, mobile, tablet, desktop,
visual consistency.

Remove stale demo language, placeholders, dead code, duplicate flows, incomplete UI and inconsistent
terminology (the register is in `docs/product/IMPLEMENTATION_ROADMAP.md` §5).

### Phase 13 — Complete testing and full audit

Unit, integration, API E2E, browser E2E, permission matrix, regression, security, sandbox,
load / concurrency, property and invariant tests where valuable, AI evaluation, AI security /
red-team, storage, export and report tests, accessibility checks.

Audit: student, trainer, admin, super admin, API, database, storage, execution, AI,
infrastructure.

**Gate:** no known release-blocking defect remains.

### Phase 14 — Staging release

Only after every earlier phase has passed. Before deploying: staging environment configuration,
secrets, database, migrations, storage, API, web, runner, sandbox, AI provider, vector storage,
monitoring, HTTPS and proxy.

Then: deploy; run migrations; verify health; verify authentication; verify every role; verify
learning flows; verify code execution; verify labs; verify AI; verify storage from a real browser;
run the regression; run the security smoke tests; run the final UAT. Only then is the product
declared staging-ready. Production follows the final UAT.

## Decisions and dependencies already known

| Phase | Item                                                                                                                                                                                                | Kind                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1     | Web Lab preview and checking model; SQL Lab engine; playground quotas                                                                                                                               | ADRs in the phase plan |
| 6     | Findings already on record (`docs/product/IMPLEMENTATION_ROADMAP.md` §4)                                                                                                                            | hardening input        |
| 7     | AI provider and models; where orchestration runs; vector storage (pgvector needs a PostgreSQL image with the extension); embeddings; LangSmith                                                      | ADRs                   |
| 7     | An AI provider account and API keys (and a LangSmith account, if chosen), supplied by the client as server-side secrets                                                                             | external dependency    |
| 6, 14 | Signed storage links on staging point at an address only containers resolve (progress log, session 16). Decide before Phase 6 closes, because it may need an application change; verify in Phase 14 | client decision, open  |

## Relationship to earlier work

The original plans (13 September 2026) framed the product as a reusable white-label template with a
local demo. Under them the team delivered **foundation phases 1–5** (13–15 September), a Phase 6
("demo completion") whose journeys and tooling exist but which was never formally closed, and then
four client briefs: **Task 1** (UI redesign), **Task 2** (SI Academy learner ecosystem), **Task 3**
(visual refinement) and **Task 4** (assignments, the sandbox runner, the first CI runs). All of it
stays: this roadmap evolves that architecture rather than replacing it. The old Phase 6's open items
are absorbed here — the journeys into Phases 2–5, the page checklist into Phases 12–13, staging into
Phase 14.

To keep the two numbering schemes apart, the progress log calls these phases **"Roadmap Phase N"**,
and the earlier ones "foundation phase N" or "Task N".
