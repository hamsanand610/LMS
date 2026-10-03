# Phase 7 — AI foundation

| Field    | Value                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **In progress** — slices 7A (3 October 2026), 7B, 7C and 7D (4 October 2026) built; 7E and 7F follow, each on the client's go-ahead                                                                                                                        |
| Scope    | The client's Phase 7A and 7B briefs of 3 October 2026, after the AI platform reconnaissance of the same day, and the Phase 7C and 7D briefs of 4 October 2026                                                                                              |
| Roadmap  | `docs/ROADMAP.md`, Phase 7 (AI foundation; it starts only after Phase 6's gate, which passed on 3 October 2026)                                                                                                                                            |
| ADRs     | ADR-0024 (provider and models), 0025 (orchestration), 0026 (vector storage readiness), 0027 (embeddings), 0028 (observability), 0029 (quotas and budgets), 0030 (streaming and retention), 0031 (where AI is allowed), 0032 (the Phase 7 answer cache, 7D) |
| Boundary | Phase 8 starts only after the Phase 7 gate. Phase 8 owns retrieval (RAG), embeddings and pgvector. Phase 9 owns agent behaviour, tools and controlled long-term memory                                                                                     |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **7A** | **Built** (3 October 2026). The ADRs, this plan, the shared AI contracts, the AI permissions and flags, the `ai` module skeleton (manifest, gateway boundary, policy and availability, provider interface with `none` and `fake`), AI configuration, secret redaction, the `/ai` web route boundary |
| **7B** | **Built** (4 October 2026). The Gemini adapter (no learner data on a free tier, ADR-0024), per-task model routing, provider health and fallback, contract tests shared with `fake`                                                                                                                  |
| **7C** | **Built** (4 October 2026). Conversations and messages (owner-scoped, append-only), the policy layer, SSE streaming, usage accounting, quotas, one generation per user, AI audit events                                                                                                             |
| **7D** | **Built** (4 October 2026). The institute's AI settings, AI jobs (titles, summaries, usage roll-ups, budget alerts, retention), privacy export and erasure, the semantic-cache foundation (exact match, ADR-0032)                                                                                   |
| 7E     | The web AI workspace, the global launcher, the lab-hint foundation; navigation that needs both `module.ai` and its option flag                                                                                                                                                                      |
| 7F     | Full integration, verification and the Phase 7 gate; pgvector readiness planned (ADR-0026)                                                                                                                                                                                                          |

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
