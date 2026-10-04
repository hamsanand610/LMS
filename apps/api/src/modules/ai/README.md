# AI module — SI Academy AI

Roadmap Phase 7 (`docs/phases/PHASE-07-ai-foundation.md`); decisions ADR-0024 to ADR-0032; the
target design is `docs/architecture/AI_ARCHITECTURE.md`.

| Aspect      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status      | **Phases 7A–7E — foundation, providers and routing, conversations, lifecycle, the user experience.** A permitted person asks in the `/ai` workspace, from the launcher, beside a course or lesson, or from a lab's AI Hint, and reads the answer as it streams; titles, notes, usage, budget, retention and the answer cache run in the background. Off by default: `module.ai`, the surface's flag, the permission and a configured provider are all needed |
| Flags       | `module.ai` (off by default); options `ai.assistant`, `ai.workspace`, `ai.lab_hints`, `ai.semantic_cache` (off). An option flag opens nothing while `module.ai` is off (`aiFeatureEnabled` in `@lms/shared`)                                                                                                                                                                                                                                                 |
| Permissions | `ai:chat` (own, every role), `ai:hints` (own, learners; lab hints), `ai:usage_read` (all for administrators, batch for trainers: `GET /ai/usage` and the AI usage pages), `ai:manage` (Super Admin only)                                                                                                                                                                                                                                                     |
| Routes      | See below; all behind `module.ai` and the usual guard order                                                                                                                                                                                                                                                                                                                                                                                                  |
| Providers   | `AiProvider`, built by `createAiProvider` for `AI_PROVIDER` alone: `none` (default), `fake` (local and tests), `gemini` (`generateContent` over HTTPS)                                                                                                                                                                                                                                                                                                       |
| Routing     | `ModelRouter` (`routing/`): the model registry (an allow-list), per-task models, a same-provider fallback, data-class approval, a deadline per call, a circuit per model, one log line per call. The only path to a provider: the provider is not exported                                                                                                                                                                                                   |
| Policy      | `AiPolicyService`, `policy/data-class.ts`, `policy/prompts.ts`; what a conversation is about and the material it brings: `context/subjects.service.ts`, `context/material.ts` (7E)                                                                                                                                                                                                                                                                           |
| Data        | `ai_conversations`, `ai_messages`, `ai_requests` (the usage ledger), `ai_usage_daily` (migration `20261007090000_phase7c_ai_conversations`); `ai_cache_entries` and the 7D columns (migration `20261008090000_phase7d_ai_lifecycle`); the institute's AI settings are the `ai` row of the settings table                                                                                                                                                     |
| Contracts   | `packages/shared/src/schemas/ai.ts`; every shape a browser receives is strict, and each event of an answer stream is parsed with its shape before it is written                                                                                                                                                                                                                                                                                              |
| Tests       | `providers/*.spec.ts`, `routing/*.spec.ts`, `policy/*.spec.ts`, `context/*.spec.ts`, `usage/*.spec.ts`, `streaming/*.spec.ts`, `cache/*.spec.ts`, `jobs/*.spec.ts`; `test/ai.e2e-spec.ts`, `test/ai-gemini.e2e-spec.ts`, `test/ai-conversations.e2e-spec.ts`, `test/ai-lifecycle.e2e-spec.ts`, `test/ai-context.e2e-spec.ts` (7E); the web app's `src/modules/ai/*.spec.ts(x)` and the browser spec `apps/web/e2e/ai.spec.ts`. No test reaches a provider    |

## Routes

| Route                                 | Permission                              | What it does                                                                                          |
| ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /ai/availability`                | `ai:chat`                               | Whether the AI can answer the caller now, which surfaces are on, and which subjects are approved (7E) |
| `GET /ai/conversations`               | `ai:chat`                               | The caller's own conversations, most recent first (paginated)                                         |
| `POST /ai/conversations`              | `ai:chat` (+ `ai:hints` for a lab hint) | A conversation for one surface and its subject, by id, checked (7E). 20 in 5 minutes per person       |
| `GET /ai/conversations/:id`           | `ai:chat`                               | One of the caller's conversations with its most recent 200 messages; anybody else's is not found      |
| `DELETE /ai/conversations/:id`        | `ai:chat`                               | Hides it at once; the retention sweep purges it (7D)                                                  |
| `POST /ai/conversations/:id/messages` | `ai:chat`                               | A question; the answer streams back as server-sent events. 20 in 5 minutes per person                 |
| `GET /ai/usage`                       | `ai:usage_read`                         | Usage per day and per person (all, or a trainer's own learners); figures only (7D)                    |
| `GET /ai/admin/status`                | `ai:manage`                             | Configured or not, answering or not, and the service state                                            |
| `GET`/`PATCH /ai/admin/settings`      | `ai:manage`                             | The institute's AI settings: stored, applied, the choices; a change checked whole and audited (7D)    |
| `POST /ai/admin/cache/purge`          | `ai:manage`                             | Empties the answer cache at once, audited (7D)                                                        |

## Subjects and their material (Phase 7E)

A conversation may be about one thing, named by id and nothing more (`context/subjects.service.ts`).
The browser never sends content: the service that owns each subject checks it, with the person's
own identity and reach, when the conversation starts and again at every question — reach lost
since is reach gone — and the material is built on the server each time (`context/material.ts`).

| Subject  | Asked from                     | Reach                                                                                                                                      | Material                                                                                                                                         |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Course   | the assistant (`assistant`)    | a published course the learner is enrolled in (not withdrawn), or a trainer teaches (`CoursesService.aiContextFor`)                        | its title, description and its modules' and lessons' titles: the learner's outline                                                               |
| Lesson   | the assistant (`assistant`)    | a lesson of such a course, in a module open to the learner (the player's own unlock rule; `LessonsService.aiContextFor`); nothing recorded | where it sits, and its own text without markup or scripts (`core/html/text.ts`); no resources, no lab or question behind it                      |
| Lab hint | the lab's AI Hint (`lab_hint`) | a lab the learner may work on (`PracticeService.requireReachableLab`), and only after a submission that was not accepted                   | the statement, input and output formats, constraints, visible examples, and the learner's own latest submission with its visible cases' verdicts |

- A subject the surface does not take is refused with `422 ai_subject_not_supported`: the workspace
  takes none; a course or lesson is asked about from the assistant beside it, a lab from its AI Hint.
  A lesson named with another course is not found; one in a module still locked, `403 module_locked`.
- A hint before any submission that was not accepted is refused with `422 ai_hint_needs_attempt`
  (`HINT_AFTER_FAILED_ATTEMPTS`, 1, as the client's 7E brief put it: "After a failed attempt, the user
  can request a hint").
- Never read for any of them: hidden cases, their expected outputs or explanations, reference
  solutions, grader checks, rubrics, explanations, staff notes, drafts, archived courses, another
  learner's work, conversations or progress.
- The material goes with the question as a learner-side message after the instructions, framed as
  context — never as instructions — and counts against the context's length (at most 8,000
  characters). Answers drawn from it are never kept in the answer cache.
- No retrieval: Phase 8's RAG index will replace the course and lesson material with the passages it
  finds, under the same reach rules. Nothing here is RAG, and there are no embeddings or vectors.

## In the web app (Phase 7E)

`apps/web/src/modules/ai/`. Every surface shows only while its flags and permission are on
(`canUseAi`, `canSeeAiPage`) and the availability says the AI can answer; the API decides again on
every request, and the browser holds no authority of its own.

- **`/ai`, the workspace** (`module.ai`, `ai.workspace`, `ai:chat`): the person's own conversations,
  newest first; new, open (`?c=<id>`), delete with confirmation (gone from the screen at once); the
  answer as it streams, with Stop. On a phone the history is a drawer.
- **The launcher** (`module.ai`, `ai.assistant` or `ai.workspace`, `ai:chat`): a button at the
  bottom right of every portal page — above the learner's tab bar — opening the assistant beside the
  page, about the course or lesson in view when the institute approved course material; a link to
  the workspace when only the workspace is on. It is not shown over a test paper, a lab, a practice
  or assignment workspace or a preview, nor while the AI cannot answer (a timed test included), and
  the page keeps room below its last line so it covers nothing.
- **AI Hint** in a lab's workspace (`module.ai`, `ai.lab_hints`, `ai:hints`; never in a preview):
  "AI Hint — helps you reason about the problem without giving the solution." It asks for a submission
  first, and says any refusal in safe words.
- **Management**: `/admin/settings/ai` (`ai:manage`): the service's state, allowances, budget, data
  approval, models, retention and the cache purge; `/admin/ai-usage` and `/trainer/ai-usage`
  (`ai:usage_read`): totals, the budget where the person sees the whole institute, per day and per
  person, as the API scopes them. No key or provider account is ever shown or asked for.
- **Navigation**: the workspace in every portal, and the AI usage and settings pages, each needing
  `module.ai` as well as its own flag or permission (an item's own flag never stands in for its
  module's).
- Streaming goes through the one stream client (`src/lib/api/stream.ts`); text is added once per
  frame; refusals and failures are worded by code (`ai-errors.ts`), never shown as the server or a
  provider wrote them; nothing of a conversation is kept in the browser's storage.

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
   - a course or lesson subject is `course` (7E);
   - anything else is `public`, a general learning question.

   The router must have a model approved for the class (`AI_DATA_CLASSES`, only `public` by
   default); if not, `403 ai_data_not_approved`, before anything is written.

   Then the subject, if the conversation has one (7E): checked again for this person now, and its
   material built (`403`, `404`, or `422 ai_hint_needs_attempt` before anything is written).

6. Quotas (ADR-0029; `usage/`), before any call: the person's questions and tokens today, the
   institute's spend this month, by the institute's AI settings or else the deployment's; `429
ai_quota_exceeded`. If usage cannot be read, the error stops the question: the check fails
   closed.
7. The generation gate: the question and the answer's placeholder are written in one transaction,
   and the database allows one `streaming` answer per person (`ai_messages_one_generation_per_user_key`),
   so a second question is refused (`409 ai_generation_in_progress`) and not stored. An answer left
   `streaming` by a stopped process is closed as `failed` (`interrupted`) once it is past the longest
   an answer can take (`AI_TIMEOUT_MS` + 30 s), and the next question goes through.
8. The context (`context/context-assembler.ts`): the surface's instructions, the subject's
   material (7E), the conversation's notes on its older turns when it has some (7D), the most recent
   completed messages the notes do not cover (at most 10; 16,000 characters with the material, the
   notes and the question) and the question. Nothing is read there: other person's data, tests,
   solutions and system data have no path in. The material, the learner's words and the notes
   written from them stay in learner-side messages, never in the instructions.
9. The answer cache (7D, ADR-0032), for a question asked on its own: a kept answer this person may
   be given is streamed as the answer, and no provider is called. Otherwise the router streams the
   answer; the gateway writes it as SI Academy's own events.
10. The answer is closed once, in one transaction with its ledger rows and the day's usage — only an
    answer still `streaming` is closed, so nothing is counted twice — and the gate opens.
11. After the stream has ended (7D): a title, the notes and keeping the answer are queued as
    background jobs. None is waited for, and none can fail the answer.

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

Governance events, as metadata only — never a question, an answer, a title or notes:
`ai.conversation.created`, `ai.conversation.deleted`, `ai.policy.refused` (`timed_assessment`,
`feature_disabled`, `restricted_content`, `data_not_approved`), `ai.quota.exceeded`,
`ai.generation.busy`, `ai.generation.failed` (the provider's failure kind); from 7D
`ai.settings.updated` (before and after), `ai.retention.swept`, `ai.usage.reconciled`,
`ai.budget.warning`, `ai.budget.exceeded` and `ai.cache.purged` (counts). A completed answer is not
audited: the usage ledger records every call, and the audit log is not a log of every call
(ADR-0028).

## Privacy

A learner's export carries their conversations with their titles and notes (deleted ones too,
until purged), the answers the cache keeps for them alone, their calls and their daily usage, naming
no provider or model. Erasure deletes their conversations, messages, notes and those answers; their
calls and daily totals stay, belonging to nobody, so the institute's figures do not change. Answers
shared between learners name nobody and hold nothing of anyone, and stay.

## The institute's AI settings (Phase 7D)

`settings/ai-settings.service.ts`: the `ai` row of the settings table — no table of its own —
validated by `aiSettingsSchema` (`@lms/shared`) and by the router's own routing rules, the Super
Admin's alone (`ai:manage`), audited. Each empty field keeps the deployment's variable:

| Setting                                    | Default                         | What it does                                                 |
| ------------------------------------------ | ------------------------------- | ------------------------------------------------------------ |
| `dailyQuestions`, `dailyTokens`            | `AI_USER_DAILY_*`               | Each person's daily allowance                                |
| `monthlyBudgetUsd`, `budgetWarningPercent` | `AI_ORG_MONTHLY_BUDGET_USD`, 80 | The month's budget against estimated costs, and when to warn |
| `conversationRetentionDays`                | 90                              | How long each message is kept (the requirements' schedule)   |
| `usageDetailRetentionDays`                 | 730                             | How long each ledger row is kept; the daily totals stay      |
| `dataClasses`                              | `AI_DATA_CLASSES`               | Narrows the deployment's approval; never widens it           |
| `model`, `taskModels`, `fallbackModel`     | `AI_MODEL`, `AI_TASK_MODELS`, … | Among the registry's models for the configured provider      |
| `cacheTtlHours`                            | 168                             | How long a cached answer may be reused                       |

Read through a 30-second cache; each read hands the router the institute's routing, applied whole
or not at all. Switching AI and the cache on and off stays with the flags. No key is ever here.

## Background jobs (Phase 7D)

`jobs/`: on the platform's queue, inline when `WORKER_MODE=none`. Payloads carry ids only, and each
job takes its work by a claim in the database — a singleton key on the queue is never what makes it
safe.

| Job                  | When                                     | What                                                                                  |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `ai.title`           | After a conversation's first answers     | The model's title, from the first question alone; once; never over the owner's title  |
| `ai.summarize`       | Once six messages have left the window   | The conversation's notes on its older turns: context, never instructions or authority |
| `ai.cache.write`     | After a complete answer that may be kept | Keeps the answer (ADR-0032), checked again from the database                          |
| `ai.usage.rollup`    | Every hour                               | Settles each closed day's totals from the ledger, once                                |
| `ai.budget.alert`    | Every 15 minutes                         | `ai.budget.warning` and `ai.budget.exceeded`, each once a month                       |
| `ai.retention.sweep` | Nightly, 02:45 India time                | Deleted conversations, old messages and ledger rows, unusable cached answers          |

Titles and notes go through the router alone, as the owner is now (account, permission, surface,
`module.ai`), within the owner's tokens and the institute's budget; they count as calls, never as
questions. A title or notes that cannot be written leave the conversation as it was.

## The answer cache (Phase 7D, ADR-0032)

`cache/`: normalised **exact** keys in PostgreSQL (`ai_cache_entries`) — the Phase 7 cache.
Similarity matching with embeddings and pgvector is Phase 8's and is not here.

- Kept: a complete answer to a `public` question asked on its own, in the workspace or the
  assistant, with no course, lesson or lab. Never a lab hint, an answer drawn from a course's or
  lesson's material (7E), a follow-up, code, a person's details, or an answer that did not complete.
- Scopes: `shared` for a question with nothing of the asker in it (no person, conversation or
  message linked); `user` otherwise, for the asker alone.
- Every hit comes after the whole policy, and checks the entry: in date, not invalidated, from the
  model that routes now, and every source still within the asker's reach. The entry grants nothing.
- Invalidation: expiry, another model version, a new prompt or knowledge version, the Super Admin's
  purge, and `AiCacheService.invalidate()` for Phase 8's knowledge events.

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
