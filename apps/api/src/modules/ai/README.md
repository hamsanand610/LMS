# AI module — SI Academy AI

Roadmap Phase 7 (`docs/phases/PHASE-07-ai-foundation.md`); decisions ADR-0024 to ADR-0031; the
target design is `docs/architecture/AI_ARCHITECTURE.md`.

| Aspect      | Detail                                                                                                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status      | **Phases 7A–7C — foundation, providers and routing, conversations.** A permitted person can ask a question and read the answer as it streams. Off by default: `module.ai`, the surface's flag, the permission and a configured provider are all needed                                          |
| Flags       | `module.ai` (off by default); options `ai.assistant`, `ai.workspace`, `ai.lab_hints`, `ai.semantic_cache` (off). An option flag opens nothing while `module.ai` is off (`aiFeatureEnabled` in `@lms/shared`)                                                                                    |
| Permissions | `ai:chat` (own, every role), `ai:hints` (own, learners; lab hints), `ai:usage_read` (all for administrators, batch for trainers; no route yet), `ai:manage` (Super Admin only)                                                                                                                  |
| Routes      | See below; all behind `module.ai` and the usual guard order                                                                                                                                                                                                                                     |
| Providers   | `AiProvider`, built by `createAiProvider` for `AI_PROVIDER` alone: `none` (default), `fake` (local and tests), `gemini` (`generateContent` over HTTPS)                                                                                                                                          |
| Routing     | `ModelRouter` (`routing/`): the model registry (an allow-list), per-task models, a same-provider fallback, data-class approval, a deadline per call, a circuit per model, one log line per call. The only path to a provider: the provider is not exported                                      |
| Policy      | `AiPolicyService`, `policy/data-class.ts`, `policy/prompts.ts`                                                                                                                                                                                                                                  |
| Data        | `ai_conversations`, `ai_messages`, `ai_requests` (the usage ledger), `ai_usage_daily` (migration `20261007090000_phase7c_ai_conversations`)                                                                                                                                                     |
| Contracts   | `packages/shared/src/schemas/ai.ts`; every shape a browser receives is strict, and each event of an answer stream is parsed with its shape before it is written                                                                                                                                 |
| Tests       | `providers/*.spec.ts`, `routing/*.spec.ts`, `policy/*.spec.ts`, `context/*.spec.ts`, `usage/*.spec.ts`, `streaming/*.spec.ts`; `test/ai.e2e-spec.ts`, `test/ai-gemini.e2e-spec.ts`, `test/ai-conversations.e2e-spec.ts`; the browser spec `apps/web/e2e/ai.spec.ts`. No test reaches a provider |

## Routes

| Route                                 | Permission                              | What it does                                                                                             |
| ------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /ai/availability`                | `ai:chat`                               | Whether the AI can answer the caller now, and which surfaces are on for them                             |
| `GET /ai/conversations`               | `ai:chat`                               | The caller's own conversations, most recent first (paginated)                                            |
| `POST /ai/conversations`              | `ai:chat` (+ `ai:hints` for a lab hint) | A conversation for one surface; a lab hint names a lab the learner can reach. 20 in 5 minutes per person |
| `GET /ai/conversations/:id`           | `ai:chat`                               | One of the caller's conversations with its most recent 200 messages; anybody else's is not found         |
| `DELETE /ai/conversations/:id`        | `ai:chat`                               | Hides it at once; the retention sweep purges it (7D)                                                     |
| `POST /ai/conversations/:id/messages` | `ai:chat`                               | A question; the answer streams back as server-sent events. 20 in 5 minutes per person                    |
| `GET /ai/admin/status`                | `ai:manage`                             | Configured or not, answering or not, and the service state                                               |

Course and lesson subjects are refused (`422 ai_subject_not_supported`) until the on-page assistant
brings their context with its own checks (7E).

## A question, step by step

1. The platform's guards: rate limit, sign-in, CSRF and origin, `module.ai`, the permission.
2. Ownership: anybody else's conversation — a trainer's, an administrator's, the Super Admin's
   included — is not found. There is no staff view of AI conversations: one would need its own ADR.
3. The policy (ADR-0031): the surface's flag and permission, and no AI during a timed test — no
   question, and no reading of conversations, while an attempt is open (`403 ai_not_allowed`).
4. A configured model service that is answering (`503 ai_unavailable` or `ai_busy`).
5. The data class (ADR-0024; `policy/data-class.ts`), decided from what the request is, not by
   guessing at personal details in the text:
   - a message holding a credential (private keys, cloud and repository tokens) is `restricted`:
     refused with `422 ai_restricted_content`, not stored, never sent;
   - a lab hint is `personal` (the learner's own work);
   - a course or lesson subject is `course` (from 7E);
   - anything else is `public`, a general learning question.

   The router must have a model approved for the class (`AI_DATA_CLASSES`, only `public` by
   default); if not, `403 ai_data_not_approved`, before anything is written.

6. Quotas (ADR-0029; `usage/`), before any call: the person's questions and tokens today, the
   institute's spend this month; `429 ai_quota_exceeded`. If usage cannot be read, the error stops
   the question: the check fails closed.
7. The generation gate: the question and the answer's placeholder are written in one transaction,
   and the database allows one `streaming` answer per person (`ai_messages_one_generation_per_user_key`),
   so a second question is refused (`409 ai_generation_in_progress`) and not stored. An answer left
   `streaming` by a stopped process is closed as `failed` (`interrupted`) once it is past the longest
   an answer can take (`AI_TIMEOUT_MS` + 30 s), and the next question goes through.
8. The context (`context/context-assembler.ts`): the surface's instructions, the most recent
   completed messages (at most 10, 16,000 characters) and the question. Nothing else is read: no
   course content, other person's data, test, solution or system data. The learner's words stay in
   user messages, never in the instructions.
9. The router streams the answer; the gateway writes it as SI Academy's own events.
10. The answer is closed once, in one transaction with its ledger rows and the day's usage — only an
    answer still `streaming` is closed, so nothing is counted twice — and the gate opens.

Refusals before step 7 are ordinary problem responses; nothing is stored for them.

## The answer stream (ADR-0030)

`POST /ai/conversations/:id/messages` answers `200 text/event-stream`, read with `fetch` (the web's
`apps/web/src/lib/api/stream.ts`): the request carries the session cookie and the CSRF header like
any other mutation.

| Event     | When                                  | Data                                                                                |
| --------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `meta`    | first                                 | `conversationId`, `userMessageId`, `assistantMessageId`                             |
| `delta`   | as the answer is written              | `text`                                                                              |
| `notice`  | the answer reached its length limit   | `code`, `message`                                                                   |
| `error`   | the answer did not complete           | `code` (`ai_unavailable`, `ai_busy`, `ai_timeout`, `ai_answer_withheld`), `message` |
| `usage`   | when a provider was called            | tokens in and out, whether estimated, questions and tokens left today               |
| `done`    | last, always                          | `messageId`, `status` (`complete`, `failed`, `cancelled`, `blocked`)                |
| `ping`    | every 15 seconds                      | `{}`                                                                                |
| `sources` | reserved for cited material (Phase 8) | —                                                                                   |

Each event is checked against its strict shape before it is written: none of a provider's own
events, fields, names or errors can pass through. Headers: `Cache-Control: no-store, no-transform`
and `X-Accel-Buffering: no`, so nothing between the API and the browser buffers the answer.

- **The reader leaves** (Stop, a closed tab): the connection closes, the call is aborted, and the
  answer is closed as `cancelled`.
- **Too slow**: the router's deadline (`AI_TIMEOUT_MS`) ends the call: `failed`, `ai_timeout`.
- **A provider failure or an unreadable answer**: `failed`, with SI Academy's code and words only.
- **Withheld by the provider's filters**: `blocked`.
- **A partial answer is never kept as one**: an answer that did not complete stores no text.
- If something fails after the stream has started, the `ProblemFilter` closes the response instead
  of writing a problem document over it.

## Usage and quotas (ADR-0029)

- `ai_requests`: one row per call to a provider — person, organisation, conversation, message,
  feature, task, data class, provider, model, outcome, fallback, tokens, estimated cost (millionths
  of a dollar, from `AI_MODEL_COSTS`; null without a price), latency and request id. A call that
  stopped while writing (cancelled, timed out, failed) is counted with estimated tokens, marked so.
- `ai_usage_daily`: per person per day (institute time): questions, tokens, estimated cost. One
  question counts once, however many calls it took (a fallback).
- Allowances: `AI_USER_DAILY_REQUESTS` (default 50), `AI_USER_DAILY_TOKENS` (default 100,000),
  `AI_ORG_MONTHLY_BUDGET_USD` (default none; set, every routed model needs a price or the API refuses
  to start). The last question of a day may finish a little over the token allowance:
  `AI_MAX_OUTPUT_TOKENS` (default 4096) and the context window bound by how much.
- Rate limits (short-term abuse protection) stay the platform's `@RateLimit`; quotas are the
  longer-term allowance.

## Audit (ADR-0028)

Governance events, as metadata only — never a question or an answer: `ai.conversation.created`,
`ai.conversation.deleted`, `ai.policy.refused` (`timed_assessment`, `feature_disabled`,
`restricted_content`, `data_not_approved`), `ai.quota.exceeded`, `ai.generation.busy`,
`ai.generation.failed` (the provider's failure kind). A completed answer is not audited: the usage
ledger records every call, and the audit log is not a log of every call (ADR-0028).

## Privacy

A learner's export carries their conversations (deleted ones too, until purged), their calls and
their daily usage, naming no provider or model. Erasure deletes their conversations and messages;
their calls and daily totals stay, belonging to nobody, so the institute's figures do not change.
Retention of deleted conversations and old messages is Phase 7D's.

## The boundary (ADR-0031)

The AI always runs as the requesting user. Whatever it is given comes through the services the API
already uses, with that user's identity and scope. It never:

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
`generateContent` keeps no conversation on Google's side, and every request sets `store: false`. The
key travels only in the `x-goog-api-key` header to the configured address; redirects are refused.
The wire format stays in `providers/gemini.wire.ts`: the rest of the platform sees SI Academy's own
types — finish reasons `stop`, `length`, `blocked`, `other`; usage with thinking counted as output;
failures as `AiProviderError`, which answer `ai_unavailable`, `ai_busy` or `ai_timeout` and carry
only status and reason codes, never the provider's message.

**The model registry** (`routing/model-registry.ts`) lists every model SI Academy may route to:
Gemini's stable text models as Google listed them on 3 October 2026, and the fake's one model.

**The router** (`routing/model-router.ts`) sends each task to its model (`AI_TASK_MODELS`, else
`AI_MODEL`); refuses before any call what the model may not take; calls it within `AI_TIMEOUT_MS`;
falls back only to `AI_FALLBACK_MODEL` of the same provider, only before any of the answer is
written; tells the gateway of every call made (`onAttempt`, the ledger); and logs each call without
its content. `refusalFor` lets the gateway ask first.

**Circuits** (`routing/circuit-breaker.ts`): five consecutive failures rest a model for 30 seconds,
then one probe call tests it. In the process, like the rate limiter's state (ADR-0006).
