# Phase 7 — AI foundation

| Field    | Value                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **Complete** — slices 7A (3 October 2026), 7B, 7C, 7D, 7E and 7F (4 October 2026) built; the Phase 7 gate passed on 4 October 2026 (7F) and awaits the client's approval                                                                                   |
| Scope    | The client's Phase 7A and 7B briefs of 3 October 2026, after the AI platform reconnaissance of the same day, and the Phase 7C, 7D, 7E and 7F briefs of 4 October 2026                                                                                      |
| Roadmap  | `docs/ROADMAP.md`, Phase 7 (AI foundation; it starts only after Phase 6's gate, which passed on 3 October 2026)                                                                                                                                            |
| ADRs     | ADR-0024 (provider and models), 0025 (orchestration), 0026 (vector storage readiness), 0027 (embeddings), 0028 (observability), 0029 (quotas and budgets), 0030 (streaming and retention), 0031 (where AI is allowed), 0032 (the Phase 7 answer cache, 7D) |
| Boundary | Phase 8 starts only after the Phase 7 gate. Phase 8 owns retrieval (RAG), embeddings and pgvector. Phase 9 owns agent behaviour, tools and controlled long-term memory                                                                                     |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **7A** | **Built** (3 October 2026). The ADRs, this plan, the shared AI contracts, the AI permissions and flags, the `ai` module skeleton (manifest, gateway boundary, policy and availability, provider interface with `none` and `fake`), AI configuration, secret redaction, the `/ai` web route boundary                      |
| **7B** | **Built** (4 October 2026). The Gemini adapter (no learner data on a free tier, ADR-0024), per-task model routing, provider health and fallback, contract tests shared with `fake`                                                                                                                                       |
| **7C** | **Built** (4 October 2026). Conversations and messages (owner-scoped, append-only), the policy layer, SSE streaming, usage accounting, quotas, one generation per user, AI audit events                                                                                                                                  |
| **7D** | **Built** (4 October 2026). The institute's AI settings, AI jobs (titles, summaries, usage roll-ups, budget alerts, retention), privacy export and erasure, the semantic-cache foundation (exact match, ADR-0032)                                                                                                        |
| **7E** | **Built** (4 October 2026). The `/ai` workspace, the global launcher and the assistant beside a course or lesson, a lab's AI Hint after a failed attempt, the AI settings and usage pages, navigation that needs both `module.ai` and its option flag; course, lesson and lab context built on the server — no retrieval |
| **7F** | **Built** (4 October 2026). The Phase 7 gate: the foundation audited and hardened as a whole — authorization, flags, provider isolation, streaming, quotas, the cache, privacy, contextual AI and lab hints; the hint rule reconciled; J-01 made deterministic; pgvector readiness settled (ADR-0026)                    |

## Slice 7A — items (the approved backlog, operating rule 2)

| ID       | Item                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| AI-7A-01 | ADR-0024 to ADR-0031 and this plan                                                                                                    |
| AI-7A-02 | Shared contracts: `packages/shared/src/schemas/ai.ts`                                                                                 |
| AI-7A-03 | Permissions `ai:chat`, `ai:hints`, `ai:usage_read`, `ai:manage` and their default bundles (ADR-0009 watermark: new keys)              |
| AI-7A-04 | Flags `module.ai` (off), `ai.assistant`, `ai.workspace`, `ai.lab_hints`, `ai.semantic_cache` (off; none opens AI without `module.ai`) |
| AI-7A-05 | The `ai` module: manifest, gateway routes, availability and policy, provider interface, `none` and `fake` providers                   |
| AI-7A-06 | Configuration `AI_PROVIDER` and `AI_MODEL`; `fake` refused outside local; `DATA_ENCRYPTION_KEY` in the examples and staging           |
| AI-7A-07 | Explicit log redaction paths for provider credentials                                                                                 |
| AI-7A-08 | The `/ai` web route boundary behind `module.ai`, `ai.workspace` and `ai:chat`                                                         |
| AI-7A-09 | Tests: contracts, route and role boundaries, providers, flags, configuration, redaction                                               |

## Slice 7B — items (the client's Phase 7B brief, 3 October 2026)

| ID       | Item                                                                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-7B-01 | The Gemini adapter: `generateContent` and `streamGenerateContent` of the stable `v1` API over the platform's fetch, `store: false`, the key in its header only, no redirects; the wire format stays in `providers/`                                      |
| AI-7B-02 | Results and failures in SI Academy's terms: finish reasons, usage with thinking counted as output, `AiProviderError` kinds answered as `ai_unavailable`, `ai_busy` or `ai_timeout`                                                                       |
| AI-7B-03 | The model registry (an allow-list) and the routing configuration (`AI_MODEL`, `AI_TASK_MODELS`, `AI_FALLBACK_MODEL`, `AI_DATA_CLASSES`, `AI_MODEL_COSTS`), checked at start-up                                                                           |
| AI-7B-04 | `ModelRouter`: per-task routing, data-class approval, input and output limits, a deadline (`AI_TIMEOUT_MS`) and cancellation, the same-provider fallback, one log line per call                                                                          |
| AI-7B-05 | A circuit per model, in the process                                                                                                                                                                                                                      |
| AI-7B-06 | Configuration: `GEMINI_API_KEY`, `GEMINI_BASE_URL` and the start-up refusals; the example files and the staging compose file                                                                                                                             |
| AI-7B-07 | Wiring: only the configured provider is built, reachable only through the router; the Super Admin's status gains the service state                                                                                                                       |
| AI-7B-08 | Tests: Gemini's requests, answers, failures, streams and secrets on a stand-in for fetch; the provider contract shared with the fake; registry, router, circuits and configuration; an end-to-end run with Gemini configured. No test reaches a provider |

## Slice 7C — items (the client's Phase 7C brief, 4 October 2026)

| ID       | Item                                                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-7C-01 | The tables `ai_conversations`, `ai_messages`, `ai_requests`, `ai_usage_daily` (additive migration `20261007090000_phase7c_ai_conversations`), with the generation gate as a partial unique index                                                |
| AI-7C-02 | Conversations owner-only (anybody else's is not found; no staff view), append-only messages, soft delete, lab-hint subjects checked with the lab drafts' rule                                                                                   |
| AI-7C-03 | The data class of each request (restricted: a credential in the message; personal: a lab hint; course: a course or lesson subject, from 7E; public: a general question), enforced before anything is written                                    |
| AI-7C-04 | The message route with server-sent events (`meta`, `delta`, `notice`, `error`, `usage`, `done`, `ping`; `sources` reserved), cancellation when the reader leaves, the router's deadline; the problem filter closes a response already under way |
| AI-7C-05 | One answer at a time per person, in the database, with recovery of an answer a stopped process left behind                                                                                                                                      |
| AI-7C-06 | Usage: the ledger per call, daily totals per person, estimated cost from `AI_MODEL_COSTS`; quotas checked before any call (daily questions and tokens, an optional monthly budget), failing closed                                              |
| AI-7C-07 | Minimal context: the surface's instructions, the most recent completed messages (at most 10, 16,000 characters) and the question                                                                                                                |
| AI-7C-08 | Audit of governance events, metadata only; privacy export and erasure of AI data                                                                                                                                                                |
| AI-7C-09 | The web stream client (`apps/web/src/lib/api/stream.ts`) and a minimal page to ask on `/ai`; the full workspace is 7E's                                                                                                                         |
| AI-7C-10 | Tests: unit, end to end with a scripted provider, the Gemini adapter end to end against a stand-in for its API, and a browser spec. No test reaches a provider                                                                                  |

## Slice 7D — items (the client's Phase 7D brief, 4 October 2026)

| ID       | Item                                                                                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-7D-01 | The institute's AI settings: the `ai` row of the settings table, validated by the shared schema and the router's rules, the Super Admin's alone (`GET`/`PATCH /ai/admin/settings`), audited; the allowances, routing and retention follow them                      |
| AI-7D-02 | Additive migration `20261008090000_phase7d_ai_lifecycle`: the title's source and claim, the notes' watermark and claim, an answer's cache entry, the ledger's day and question mark (backfilled), the table `ai_cache_entries`                                      |
| AI-7D-03 | Background jobs on the platform's queue, each taking its work by a claim in the database: `ai.title`, `ai.summarize`, `ai.cache.write` (queued after the stream ends), `ai.usage.rollup`, `ai.budget.alert`, `ai.retention.sweep` (scheduled); payloads of ids only |
| AI-7D-04 | Titles and notes through the router alone, within the owner's allowance and the budget, counted as calls and never as questions; the notes in the context after the instructions, as learner-side context, never instructions or authority                          |
| AI-7D-05 | The usage roll-up of closed days from the ledger, budget alerts once a month per level, the budget enforced before every call, usage figures (`GET /ai/usage`, `ai:usage_read`)                                                                                     |
| AI-7D-06 | Retention: deleted conversations at the next sweep; messages and conversations after 90 days; the ledger after 730; daily totals kept; cached answers once they can no longer be reused; nothing being written touched                                              |
| AI-7D-07 | The Phase 7 answer cache (ADR-0032): normalised exact keys, shared and user scopes, what is never cached, reach re-checked on every hit, invalidation by expiry, model, prompt, knowledge and the Super Admin's purge                                               |
| AI-7D-08 | Privacy: the notes and the person's own cached answers in the export, removed by erasure; shared answers hold nothing of anyone                                                                                                                                     |
| AI-7D-09 | Tests: unit (normalisation, keys, routing by the settings, the roll-up's days, the budget, prompts, context), end to end (`test/ai-lifecycle.e2e-spec.ts`), and the 7C and Gemini specs brought to the background work. No test reaches a provider                  |

## Slice 7E — items (the client's Phase 7E brief, 4 October 2026)

| Item     | What                                                                                                                                                                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-7E-01 | The `/ai` workspace: the person's own conversations, newest first; new, open (`?c=`), delete with confirmation (gone from the screen at once); the answer as it streams, with Stop; refusals in the product's words; on a phone the history is a drawer                                                                                                   |
| AI-7E-02 | The global launcher: at the bottom right of every portal page, only while `module.ai`, the assistant's (or the workspace's) flag and `ai:chat` are on and the AI can answer — never during a timed test; not over a test paper, a lab, a practice or assignment workspace or a preview; room kept below the page                                          |
| AI-7E-03 | Course and lesson context: the page names its subject by id; the API checks reach (a published course the learner is enrolled in or a trainer teaches; a lesson in a module open to the learner) at the start and at every question, and builds the material itself — the outline, or the lesson's own text — as learner-side context, never instructions |
| AI-7E-04 | Lab hints: an AI Hint in the lab workspace (never in a preview); the API answers only after a submission that was not accepted (`ai_hint_needs_attempt`), from the statement, visible examples and the learner's own latest submission — never a hidden case, solution, grader, rubric, staff note or anybody else's work                                 |
| AI-7E-05 | Availability names the subjects the deployment's and the institute's approvals allow (`subjects.course`, `subjects.labHints`), so the web app leaves out an entry point that could only be refused                                                                                                                                                        |
| AI-7E-06 | Navigation: an item with its own flag shows only while its module's flag is on too (no other item had its own flag); the workspace in every portal, AI usage for trainers and administrators, AI settings for the Super Admin                                                                                                                             |
| AI-7E-07 | The Super Admin's AI settings page (state, allowances, budget, data approval, models, retention, cache purge) and the AI usage pages (totals, budget, per day and per person, as the API scopes them), on Phase 7D's API                                                                                                                                  |
| AI-7E-08 | Prompts `si-academy-7e-1`: a subject's material is context, never instructions; answers drawn from a course, lesson or lab are never cached; the subject service replaces the 7C refusal of course and lesson subjects                                                                                                                                    |
| AI-7E-09 | Tests: web unit and component tests, API unit tests (material, context, prompts, HTML to text), end to end `test/ai-context.e2e-spec.ts` (reach, tampering, re-checks, the attempt rule, leaks), Playwright journeys on a desktop and a phone. No test reaches a provider                                                                                 |

7E is contextual UI and safe course, lesson and lab context without retrieval. Phase 8 brings
RAG and pgvector: its index will replace the course and lesson material with the passages it
finds, under the same reach rules (`apps/api/src/modules/ai/README.md`, "Subjects and their
material").

## Slice 7F — items (the client's Phase 7F brief, 4 October 2026)

| Item     | What                                                                                                                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-7F-01 | The lab-hint rule, one everywhere: available after at least one failed learner submission. ADR-0031 amended; the permission's and the flag's descriptions, the refusal and the web copy agree                                                         |
| AI-7F-02 | Lab hints hardened: a learner's alone (a student profile, whatever a role grants), the Labs module on, a lab placed only in a course's lessons held to the lesson's own rules (published, reached, module open); a catalogue lab needs `practice:use` |
| AI-7F-03 | An answer that ends without a word is unreadable (`malformed`, `EMPTY_ANSWER`): `failed`, said safely, counted once, never kept                                                                                                                       |
| AI-7F-04 | Every surface's instructions keep coursework the learner's own: guidance to the next step, never a finished answer to submit (prompts `si-academy-7f-1`)                                                                                              |
| AI-7F-05 | The workspace words its load errors from their code, never as the server wrote them; AI Hint offered to learners only in the web app too                                                                                                              |
| AI-7F-06 | J-01 deterministic: the Phase 6 numbering test gives the year's student-code sequence back, so later files number learners as if it had not run; the 7E context spec leaves no institute AI settings behind                                           |
| AI-7F-07 | The Phase 7 gate spec (`test/ai-gate.e2e-spec.ts`): every route for every role, the kill switch and each surface's flag, the hint rule, timed tests on every surface, the cache behind the allowance, answers without a word                          |
| AI-7F-08 | Unit tests: an empty answer in the router; the usage day across midnight, the month and the year in the institute's time zone; the coursework line                                                                                                    |
| AI-7F-09 | pgvector readiness settled without enabling anything (ADR-0026's readiness record): storage, image, migration, dimension, index, tests and ownership                                                                                                  |
| AI-7F-10 | Documentation reconciled with the code: ADRs 0026 to 0032, the roadmap, this plan, the AI architecture, the stack, the implementation roadmap, the module README, the runbook, the permission matrix                                                  |

## The Phase 7 gate (7F, 4 October 2026)

Every requirement of Phase 7, where it lives and what proves it. The counts are in the progress
log, session 34.

| Area               | What holds                                                                                              | Where                                                                                                | Tests                                                                                             | Status |
| ------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| 7A foundation      | Contracts, permissions, flags, the `ai` module, off by default                                          | `packages/shared/src/schemas/ai.ts`, `modules/ai`                                                    | `test/ai.e2e-spec.ts`; shared and policy unit tests                                               | Pass   |
| 7B providers       | Gemini over HTTPS, the model registry and router, circuits, the fallback                                | `providers/`, `routing/`                                                                             | provider and router unit tests; `test/ai-gemini.e2e-spec.ts` (a stand-in for `fetch`, no network) | Pass   |
| 7C conversations   | Owner-scoped conversations, the policy, the stream, usage, quotas, one answer at a time, audit          | `gateway/`, `conversations/`, `usage/`, `streaming/`                                                 | `test/ai-conversations.e2e-spec.ts`                                                               | Pass   |
| 7D lifecycle       | Settings, jobs with claims, retention, the exact-key cache, privacy                                     | `settings/`, `jobs/`, `cache/`, `users/privacy.service.ts`                                           | `test/ai-lifecycle.e2e-spec.ts`; cache, roll-up and budget unit tests                             | Pass   |
| 7E experience      | Workspace, launcher, course, lesson and lab context, admin pages, navigation                            | `context/`, `apps/web/src/modules/ai`                                                                | `test/ai-context.e2e-spec.ts`; web unit tests; Playwright                                         | Pass   |
| 7F gate            | The whole foundation, audited and hardened                                                              | as above                                                                                             | `test/ai-gate.e2e-spec.ts`; deliberate-break checks                                               | Pass   |
| Authorization      | Each route's permission; owner-only conversations; usage by scope; settings for the Super Admin alone   | `gateway/ai.controller.ts`, `AiPolicyService`, `usage-report.service.ts`                             | gate (routes × roles), 7C ownership, 7D settings and usage                                        | Pass   |
| Flags              | `module.ai` and each surface's flag, both; navigation needs both                                        | `AiPolicyService`, `NavigationService`                                                               | gate (kill switch, each flag), 7E navigation, web unit tests                                      | Pass   |
| Provider isolation | Only the router reaches the provider; keys server-side, redacted, never sent                            | `routing/model-router.ts`, `providers/`, `logger.module.ts`                                          | router and Gemini tests; repository scan                                                          | Pass   |
| Streaming          | SSE events in order; failures, timeouts, unreadable and empty answers closed `failed`                   | `gateway/`, `streaming/`                                                                             | 7C endings; gate (empty answer)                                                                   | Pass   |
| Cancellation       | Stop or a closed tab ends the call; the gate opens; abandoned answers close                             | gateway, router, `conversations/`                                                                    | 7C (leaving mid-answer, abandoned), router unit tests, web hook test                              | Pass   |
| Quotas and budget  | Questions, tokens, budget before any call; jobs within the budget; usage figures                        | `usage/`, `jobs/budget-alerts.service.ts`                                                            | quota, budget and usage-day unit tests; 7C quotas; 7D budget; gate (cache behind the allowance)   | Pass   |
| Cache              | Exact normalised keys only; never subjects, hints, follow-ups, failures; reach re-checked on every hit  | `cache/`                                                                                             | normaliser and key unit tests; 7D cache; 7E course answers; gate                                  | Pass   |
| Retention          | Deleted at once, messages at 90 days, ledger at 730, totals kept, idempotent sweep                      | `jobs/retention.service.ts`                                                                          | 7D retention                                                                                      | Pass   |
| Privacy            | Export of conversations, notes, calls, totals, own cached answers; erasure leaves nothing of the person | `users/privacy.service.ts`                                                                           | 7D privacy                                                                                        | Pass   |
| Course context     | Published, enrolled or taught, re-checked at every question; the outline as context                     | `CoursesService.aiContextFor`, `context/subjects.service.ts`                                         | 7E context; gate routes                                                                           | Pass   |
| Lesson context     | A lesson in a module open to the learner; its own text; nothing recorded                                | `LessonsService.aiContextFor`                                                                        | 7E context (locked, tampered, no progress written)                                                | Pass   |
| Lab hints          | A learner's, Labs on, after a failed submission, on a lab open to them now; nothing protected sent      | `context/subjects.service.ts`, `PracticeService.labHintBrief`, `LessonsService.requireOpenLabLesson` | 7E leaks; gate (rule, staff, previews, Labs off, lesson rules)                                    | Pass   |
| Timed tests        | No AI on any surface while an attempt is open, at the server                                            | `AiPolicyService.assertNotInTimedTest`                                                               | 7C; gate (every surface)                                                                          | Pass   |
| Admin              | Settings, status, purge for the Super Admin; institute usage for administrators                         | `/admin/settings/ai`, `/admin/ai-usage`                                                              | 7D; gate; web unit tests; Playwright                                                              | Pass   |
| Trainer            | Usage of their batches' learners only; no settings; no hints; courses they teach                        | `/trainer/ai-usage`                                                                                  | 7D usage; gate; Playwright                                                                        | Pass   |
| Student            | Workspace, assistant, hints within reach; no usage or settings                                          | the web module                                                                                       | 7C, 7E, gate; Playwright                                                                          | Pass   |
| Desktop and mobile | Every surface on a desktop and a phone, no sideways scrolling, the launcher above the tab bar           | `apps/web/src/modules/ai`                                                                            | `apps/web/e2e/ai.spec.ts`, desktop and phone projects                                             | Pass   |
| Database           | `lms` not migrated; the test and preview databases match the schema                                     | migrations `phase7c`, `phase7d`                                                                      | schema diff; migration count                                                                      | Pass   |
| Documentation      | Describes what is built, and keeps Phases 8 to 10 apart                                                 | ADRs, plan, README, runbook                                                                          | reviewed in 7F                                                                                    | Pass   |

## Phase 8 prerequisites

Phase 8 implements none of these in Phase 7; it starts only when they hold:

1. The client approves Phase 7.
2. The Phase 7 migrations reach `lms` under the database gate (runbook §5): a verified backup and
   restore, `20261007090000_phase7c_ai_conversations` and `20261008090000_phase7d_ai_lifecycle`,
   and a schema check.
3. A PostgreSQL image with pgvector in local, CI and staging together, as ADR-0026's readiness
   record sets out.
4. The embedding model chosen and recorded (ADR-0027): its data terms, its cost, a dimension the
   index accepts, and the path to embed again.
5. Gemini on a paid tier before any real learner data reaches it (ADR-0024), and the AI flags on
   only with the client's approval (operating rule 35).
6. The knowledge sources and their visibility metadata agreed (AI architecture §4).

## Rules that hold from 7A onwards

- AI is off by default and stays off in production until the client approves it (operating rule 35).
- The AI runs as the requesting user. It reads nothing around the existing services, and never sees
  hidden cases, reference solutions, grader logic or other learners' data (ADR-0031).
- No provider call is made without accounting (ADR-0029). From 7C, every call is recorded in the
  usage ledger as part of closing its answer; in 7A and 7B no route called a provider.
- Provider keys stay on the server (ADR-0024). No real learner data goes to a free tier.
- No pgvector, embeddings, image change, AWS resource, LangChain or LangGraph in Phase 7
  (ADR-0025 to ADR-0027).

## 7A record (3 October 2026)

See the progress log, session 29.

## 7B record (4 October 2026)

See the progress log, session 30.

## 7C record (4 October 2026)

See the progress log, session 31.

## 7D record (4 October 2026)

See the progress log, session 32.

## 7E record (4 October 2026)

See the progress log, session 33.

## 7F record (4 October 2026)

See the progress log, session 34.
