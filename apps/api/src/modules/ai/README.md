# AI module — SI Academy AI

Roadmap Phase 7 (`docs/phases/PHASE-07-ai-foundation.md`); decisions ADR-0024 to ADR-0031; the
target design is `docs/architecture/AI_ARCHITECTURE.md`.

| Aspect      | Detail                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status      | **Phase 7A — foundation only.** The gateway checks a request against the policy and answers `503 ai_unavailable`; no provider is called until conversations and usage accounting arrive (7C)                         |
| Flags       | `module.ai` (off by default); options `ai.assistant`, `ai.workspace`, `ai.lab_hints`, `ai.semantic_cache` (off). An option flag opens nothing while `module.ai` is off (`aiFeatureEnabled` in `@lms/shared`)         |
| Permissions | `ai:chat` (own, every role), `ai:hints` (own, learners), `ai:usage_read` (all for administrators, batch for trainers), `ai:manage` (Super Admin only)                                                                |
| Routes      | `GET /ai/availability` (`ai:chat`), `POST /ai/messages` (`ai:chat`, 20 in 5 minutes per person), `GET /ai/admin/status` (`ai:manage`); all behind `module.ai` and the usual guard order                              |
| Providers   | `AiProvider` (`providers/ai-provider.ts`), chosen by `AI_PROVIDER`: `none` (default; refuses every call) and `fake` (deterministic, no network; local and tests only — refused at start-up elsewhere)                |
| Policy      | `AiPolicyService`: a surface is on when `module.ai`, its own flag and its permission all are; no AI help while the person has a timed test attempt open (`AttemptsService.hasOpenAttempt`)                           |
| Contracts   | `packages/shared/src/schemas/ai.ts`; every shape a browser receives is strict, and the gateway parses its answers with it                                                                                            |
| Tests       | `providers/providers.spec.ts`; `packages/shared/src/schemas/ai.spec.ts`; `test/ai.e2e-spec.ts` (flags, guards, CSRF, permissions, the timed-test refusal); the route-table and role-boundary specs cover every route |

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
