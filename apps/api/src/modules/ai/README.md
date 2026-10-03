# AI module — SI Academy AI

Roadmap Phase 7 (`docs/phases/PHASE-07-ai-foundation.md`); decisions ADR-0024 to ADR-0031; the
target design is `docs/architecture/AI_ARCHITECTURE.md`.

| Aspect      | Detail                                                                                                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status      | **Phases 7A and 7B — foundation, providers and routing.** The gateway checks a request against the policy and answers `503 ai_unavailable`; no provider is called until conversations and usage accounting arrive (7C)                                                                               |
| Flags       | `module.ai` (off by default); options `ai.assistant`, `ai.workspace`, `ai.lab_hints`, `ai.semantic_cache` (off). An option flag opens nothing while `module.ai` is off (`aiFeatureEnabled` in `@lms/shared`)                                                                                         |
| Permissions | `ai:chat` (own, every role), `ai:hints` (own, learners), `ai:usage_read` (all for administrators, batch for trainers), `ai:manage` (Super Admin only)                                                                                                                                                |
| Routes      | `GET /ai/availability` (`ai:chat`), `POST /ai/messages` (`ai:chat`, 20 in 5 minutes per person), `GET /ai/admin/status` (`ai:manage`; configured, gateway ready, and the service state `off`/`ready`/`degraded`/`unavailable`); all behind `module.ai` and the usual guard order                     |
| Providers   | `AiProvider` (`providers/ai-provider.ts`), built by `createAiProvider` for `AI_PROVIDER` alone: `none` (default; refuses every call), `fake` (deterministic, no network; local and tests only — refused at start-up elsewhere), `gemini` (`generateContent` over HTTPS)                              |
| Routing     | `ModelRouter` (`routing/`): the model registry (an allow-list), per-task models, a same-provider fallback, data-class approval, a deadline per call, a circuit per model, and a log line per call. The only path to a provider: the provider is not exported                                         |
| Policy      | `AiPolicyService`: a surface is on when `module.ai`, its own flag and its permission all are; no AI help while the person has a timed test attempt open (`AttemptsService.hasOpenAttempt`)                                                                                                           |
| Contracts   | `packages/shared/src/schemas/ai.ts`; every shape a browser receives is strict, and the gateway parses its answers with it                                                                                                                                                                            |
| Tests       | `providers/*.spec.ts` (Gemini on a stand-in for fetch, the contract shared with the fake), `routing/*.spec.ts`, `packages/shared/src/schemas/ai.spec.ts`, `test/ai.e2e-spec.ts`, `test/ai-gemini.e2e-spec.ts`; the route-table and role-boundary specs cover every route. No test reaches a provider |

## The boundary (ADR-0031)

The AI always runs as the requesting user. Whatever it is given comes through the services the API
already uses, with that user's identity and scope (`ScopeService`, publication reach, the
learner-facing views). It never:

- reads the repository, runs SQL, runs a shell command or makes an arbitrary outbound request;
- sees hidden test cases or their expected outputs, reference solutions, grader logic, unreleased
  answers, rubrics, validation results or question version snapshots;
- sees another learner's code or data;
- answers during a timed test.

No tool or agent action exists in Phase 7 (Phase 9). Provider keys stay in server environment
variables, never in the database, a response, a job payload or a log (the logger's
`LOG_REDACT_PATHS` carry explicit paths for them).

## Providers and routing (Phase 7B)

**Gemini** uses `models.generateContent` and `models.streamGenerateContent?alt=sse` of the stable
`v1` API (`GEMINI_BASE_URL`), as Google's discovery document describes them (revision 20261002).
`generateContent` keeps no conversation on Google's side, and every request sets `store: false`, so
the provider logs none of them; SI Academy keeps its own records. The key travels only in the
`x-goog-api-key` header to the configured address; redirects are refused, so the header cannot
follow one elsewhere. The wire format stays in `providers/gemini.wire.ts`: the rest of the platform
sees SI Academy's own types — finish reasons `stop`, `length`, `blocked`, `other`; usage with
thinking counted as output; failures as `AiProviderError` (`auth`, `configuration`, `rate_limited`,
`unavailable`, `timeout`, `cancelled`, `bad_request`, `malformed`, `circuit_open`), which answer
`ai_unavailable`, `ai_busy` or `ai_timeout` and carry only status and reason codes, never the
provider's message.

**The model registry** (`routing/model-registry.ts`) lists every model SI Academy may route to:
Gemini's stable text models as Google listed them on 3 October 2026, and the fake's one model. A new
model joins the list, with its test, once it is stable and checked; choosing among the listed ones
is configuration. The API refuses to start when a configured model is not listed for the
configured provider.

**The router** (`routing/model-router.ts`), for each call:

1. takes the task's model — `AI_TASK_MODELS`, else `AI_MODEL`;
2. refuses, before any call, a model that does not handle the task, cannot stream when asked to,
   or is not approved for the call's data class (the model's own limit and `AI_DATA_CLASSES`;
   `restricted` never), and a request too long for the model's input;
3. calls it within `AI_TIMEOUT_MS`, or until the caller aborts;
4. if the model is overloaded or resting, before any of the answer is written, asks
   `AI_FALLBACK_MODEL` — always the same provider's, never the fake;
5. logs the call: provider, model, task, feature, data class, person, organisation, outcome,
   latency, tokens and the estimated cost (`AI_MODEL_COSTS`) — never the question or the answer.

**Circuits** (`routing/circuit-breaker.ts`): five consecutive failures of the model service rest a
model for 30 seconds; then one probe call tests it, and its outcome closes the circuit or rests the
model again. Cancellations and invalid requests do not count. The state lives in the process, like
the rate limiter's (ADR-0006).
