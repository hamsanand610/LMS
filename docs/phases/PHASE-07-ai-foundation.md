# Phase 7 — AI foundation

| Field    | Value                                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **In progress** — slices 7A (3 October 2026) and 7B (4 October 2026) built; 7C–7F follow, each on the client's go-ahead                                                                                               |
| Scope    | The client's Phase 7A and 7B briefs of 3 October 2026, after the AI platform reconnaissance of the same day                                                                                                           |
| Roadmap  | `docs/ROADMAP.md`, Phase 7 (AI foundation; it starts only after Phase 6's gate, which passed on 3 October 2026)                                                                                                       |
| ADRs     | ADR-0024 (provider and models), 0025 (orchestration), 0026 (vector storage readiness), 0027 (embeddings), 0028 (observability), 0029 (quotas and budgets), 0030 (streaming and retention), 0031 (where AI is allowed) |
| Boundary | Phase 8 starts only after the Phase 7 gate. Phase 8 owns retrieval (RAG), embeddings and pgvector. Phase 9 owns agent behaviour, tools and controlled long-term memory                                                |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **7A** | **Built** (3 October 2026). The ADRs, this plan, the shared AI contracts, the AI permissions and flags, the `ai` module skeleton (manifest, gateway boundary, policy and availability, provider interface with `none` and `fake`), AI configuration, secret redaction, the `/ai` web route boundary |
| **7B** | **Built** (4 October 2026). The Gemini adapter (no learner data on a free tier, ADR-0024), per-task model routing, provider health and fallback, contract tests shared with `fake`                                                                                                                  |
| 7C     | Conversations and messages (owner-scoped, append-only), the policy layer, SSE streaming, usage accounting, quotas, one generation per user, AI audit events                                                                                                                                         |
| 7D     | AI jobs (titles, summaries, usage roll-ups, budget alerts, retention), privacy export and erasure, the semantic-cache foundation (exact match)                                                                                                                                                      |
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

## Rules that hold from 7A onwards

- AI is off by default and stays off in production until the client approves it (operating rule 35).
- The AI runs as the requesting user. It reads nothing around the existing services, and never sees
  hidden cases, reference solutions, grader logic or other learners' data (ADR-0031).
- No provider call is made without accounting (ADR-0029). In 7A and 7B no route calls a provider:
  the router exists, and the gateway still answers that AI is unavailable.
- Provider keys stay on the server (ADR-0024). No real learner data goes to a free tier.
- No pgvector, embeddings, image change, AWS resource, LangChain or LangGraph in Phase 7
  (ADR-0025 to ADR-0027).

## 7A record (3 October 2026)

See the progress log, session 29.

## 7B record (4 October 2026)

See the progress log, session 30.
