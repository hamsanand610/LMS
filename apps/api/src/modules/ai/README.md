# AI module — SI Academy AI

Roadmap Phases 7 and 8 (`docs/phases/PHASE-07-ai-foundation.md`,
`docs/phases/PHASE-08-rag-knowledge.md`); decisions ADR-0024 to ADR-0033; the target design is
`docs/architecture/AI_ARCHITECTURE.md`.

| Aspect      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status      | **Phase 7 complete (7A–7F) — foundation, providers and routing, conversations, lifecycle, the user experience, the gate.** A permitted person asks in the `/ai` workspace, from the launcher, beside a course or lesson, or from a lab's AI Hint, and reads the answer as it streams; titles, notes, usage, budget, retention and the answer cache run in the background. Off by default: `module.ai`, the surface's flag, the permission and a configured provider are all needed. **Phase 8A: the knowledge base's foundation** — sources, documents, versions and chunks with their provenance, managed by the Super Admin through the API (ADR-0033); **Phase 8B: their ingestion** — Markdown, plain text and HTML into deterministic chunks by a job on the queue (ADR-0034); **Phase 8C: their embeddings** — `gemini-embedding-001` at 768 dimensions through the model router (the fake provider for tests and local work), vectors of unit length on pgvector with an HNSW cosine index, made by a claimed, leased and batched job (ADR-0035); nothing retrieves from it yet |
| Flags       | `module.ai` (off by default); options `ai.assistant`, `ai.workspace`, `ai.lab_hints`, `ai.semantic_cache` and, from 8A, `ai.knowledge` (off). An option flag opens nothing while `module.ai` is off (`aiFeatureEnabled` in `@lms/shared`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Permissions | `ai:chat` (own, every role), `ai:hints` (own, learners; lab hints), `ai:usage_read` (all for administrators, batch for trainers: `GET /ai/usage` and the AI usage pages), `ai:manage` (Super Admin only), `ai:knowledge_manage` (Super Admin only; the knowledge base, 8A)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Routes      | See below; all behind `module.ai` and the usual guard order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Providers   | `AiProvider`, built by `createAiProvider` for `AI_PROVIDER` alone: `none` (default), `fake` (local and tests), `gemini` (`generateContent` over HTTPS); embeddings (8C): the fake's deterministic vectors, Gemini's `batchEmbedContents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Routing     | `ModelRouter` (`routing/`): the model registry (an allow-list), per-task models, a same-provider fallback, data-class approval, a deadline per call, a circuit per model, one log line per call; for embeddings (8C) the embedding registry, the schema's dimension, the batch and input limits, and every vector checked. The only path to a provider: the provider is not exported                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Policy      | `AiPolicyService`, `policy/data-class.ts`, `policy/prompts.ts`; what a conversation is about and the material it brings: `context/subjects.service.ts`, `context/material.ts` (7E)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Data        | `ai_conversations`, `ai_messages`, `ai_requests` (the usage ledger), `ai_usage_daily` (migration `20261007090000_phase7c_ai_conversations`); `ai_cache_entries` and the 7D columns (migration `20261008090000_phase7d_ai_lifecycle`); the institute's AI settings are the `ai` row of the settings table; the knowledge base: `knowledge_sources`, `knowledge_documents`, `knowledge_document_versions`, `knowledge_chunks` (migration `20261009090000_phase8a_knowledge_base`, 8A; the parser and chunker versions and the claim's time from `20261010090000_phase8b_knowledge_ingestion`, 8B); the embeddings: `knowledge_version_embeddings` and `knowledge_chunk_embeddings` (`vector(768)`, an HNSW cosine index) with the `vector` extension (migration `20261011090000_phase8c_knowledge_embeddings`, 8C)                                                                                                                                                                                                                                                                       |
| Contracts   | `packages/shared/src/schemas/ai.ts` and, for the knowledge base, `knowledge.ts`; every shape a browser receives is strict, and each event of an answer stream is parsed with its shape before it is written                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Tests       | `providers/*.spec.ts`, `routing/*.spec.ts`, `policy/*.spec.ts`, `context/*.spec.ts`, `usage/*.spec.ts`, `streaming/*.spec.ts`, `cache/*.spec.ts`, `jobs/*.spec.ts`, `knowledge/*.spec.ts`; `test/ai.e2e-spec.ts`, `test/ai-gemini.e2e-spec.ts`, `test/ai-conversations.e2e-spec.ts`, `test/ai-lifecycle.e2e-spec.ts`, `test/ai-context.e2e-spec.ts` (7E), `test/ai-gate.e2e-spec.ts` (the Phase 7 gate, 7F), `test/ai-knowledge.e2e-spec.ts` (8A), `test/ai-knowledge-ingestion.e2e-spec.ts` (8B), `test/ai-knowledge-embeddings.e2e-spec.ts` (8C); the web app's `src/modules/ai/*.spec.ts(x)` and the browser spec `apps/web/e2e/ai.spec.ts`. No test reaches a provider                                                                                                                                                                                                                                                                                                                                                                                                             |

## Routes

| Route                                       | Permission                              | What it does                                                                                                                                    |
| ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /ai/availability`                      | `ai:chat`                               | Whether the AI can answer the caller now, which surfaces are on, and which subjects are approved (7E)                                           |
| `GET /ai/conversations`                     | `ai:chat`                               | The caller's own conversations, most recent first (paginated)                                                                                   |
| `POST /ai/conversations`                    | `ai:chat` (+ `ai:hints` for a lab hint) | A conversation for one surface and its subject, by id, checked (7E). 20 in 5 minutes per person                                                 |
| `GET /ai/conversations/:id`                 | `ai:chat`                               | One of the caller's conversations with its most recent 200 messages; anybody else's is not found                                                |
| `DELETE /ai/conversations/:id`              | `ai:chat`                               | Hides it at once; the retention sweep purges it (7D)                                                                                            |
| `POST /ai/conversations/:id/messages`       | `ai:chat`                               | A question; the answer streams back as server-sent events. 20 in 5 minutes per person                                                           |
| `GET /ai/usage`                             | `ai:usage_read`                         | Usage per day and per person (all, or a trainer's own learners); figures only (7D)                                                              |
| `GET /ai/admin/status`                      | `ai:manage`                             | Configured or not, answering or not, and the service state                                                                                      |
| `GET`/`PATCH /ai/admin/settings`            | `ai:manage`                             | The institute's AI settings: stored, applied, the choices; a change checked whole and audited (7D)                                              |
| `POST /ai/admin/cache/purge`                | `ai:manage`                             | Empties the answer cache at once, audited (7D)                                                                                                  |
| `GET /ai/knowledge/status`                  | `ai:knowledge_manage`                   | Sources and versions by state, the chunk count, and whether the database can hold vectors (8A)                                                  |
| `GET /ai/knowledge/sources`                 | `ai:knowledge_manage`                   | The institute's knowledge sources, each with its document count (8A)                                                                            |
| `POST /ai/knowledge/sources`                | `ai:knowledge_manage`                   | A new source, as a draft: its type, audience, course and data class (8A)                                                                        |
| `GET /ai/knowledge/sources/:id`             | `ai:knowledge_manage`                   | A source with its documents and their versions: metadata only, never the content (8A)                                                           |
| `PATCH /ai/knowledge/sources/:id`           | `ai:knowledge_manage`                   | Its name and description; who it is for and what it holds only while it is a draft (8A)                                                         |
| `POST /ai/knowledge/sources/:id/publish`    | `ai:knowledge_manage`                   | Publishes a draft, once (8A)                                                                                                                    |
| `POST /ai/knowledge/sources/:id/archive`    | `ai:knowledge_manage`                   | Archives it for good: nothing in it changes or is drawn on again (8A)                                                                           |
| `POST /ai/knowledge/sources/:id/documents`  | `ai:knowledge_manage`                   | A document, by a reference unique in the source, perhaps about a lesson of its course (8A)                                                      |
| `POST /ai/knowledge/documents/:id/versions` | `ai:knowledge_manage`                   | A version: the text normalised, hashed and stored; the same content twice is refused (8A); in Markdown, plain text or HTML (`format`, 8B)       |
| `GET /ai/knowledge/versions/:id`            | `ai:knowledge_manage`                   | Where a version's ingestion stands: status, chunks, failure code, parser and chunker (8B); its embedding run under the active contract (8C)     |
| `POST /ai/knowledge/versions/:id/ingest`    | `ai:knowledge_manage`                   | Asks for a version's ingestion (202); refused for an archived source, a chunked version, one being ingested, one older than the current (8B)    |
| `POST /ai/knowledge/versions/:id/embed`     | `ai:knowledge_manage`                   | Asks for a version's embedding (202); refused when the AI cannot embed, the version may not be embedded, a run holds it, or it is embedded (8C) |

## Subjects and their material (Phase 7E)

A conversation may be about one thing, named by id and nothing more (`context/subjects.service.ts`).
The browser never sends content: the service that owns each subject checks it, with the person's
own identity and reach, when the conversation starts and again at every question — reach lost
since is reach gone — and the material is built on the server each time (`context/material.ts`).

| Subject  | Asked from                     | Reach                                                                                                                                                                                                        | Material                                                                                                                                         |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Course   | the assistant (`assistant`)    | a published course the learner is enrolled in (not withdrawn), or a trainer teaches (`CoursesService.aiContextFor`)                                                                                          | its title, description and its modules' and lessons' titles: the learner's outline                                                               |
| Lesson   | the assistant (`assistant`)    | a lesson of such a course, in a module open to the learner (the player's own unlock rule; `LessonsService.aiContextFor`); nothing recorded                                                                   | where it sits, and its own text without markup or scripts (`core/html/text.ts`); no resources, no lab or question behind it                      |
| Lab hint | the lab's AI Hint (`lab_hint`) | a learner (a student profile) with Labs on, on a lab in the catalogue (`practice:use`) or opened by a lesson they can open — the lesson's own rules (7F) — and only after a submission that was not accepted | the statement, input and output formats, constraints, visible examples, and the learner's own latest submission with its visible cases' verdicts |

- A subject the surface does not take is refused with `422 ai_subject_not_supported`: the workspace
  takes none; a course or lesson is asked about from the assistant beside it, a lab from its AI Hint.
  A lesson named with another course is not found; one in a module still locked, `403 module_locked`.
- **The hint rule:** a lab hint is available after at least one failed learner submission. Before
  any, or after accepted ones only, it is refused with `422 ai_hint_needs_attempt`
  (`HINT_AFTER_FAILED_ATTEMPTS`; ADR-0031, decision 2). Staff get no hint whatever a role grants
  (`403`), nor does a learner with Labs switched off; a lab placed only in a course's lessons needs
  a lesson the learner can open (7F).
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
  An answer that ends without a word (and was not withheld) is unreadable too (`malformed`,
  `EMPTY_ANSWER`, Phase 7F): never a complete empty answer, never kept.
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
- Knowledge embedded for the institute (8C) is in the ledger (feature `knowledge`, task `embed`,
  no conversation) and the requester's day, and the budget counts it; with a budget set, the
  embedding model needs a price in `AI_MODEL_COSTS` or nothing is embedded. It is the institute's
  work: the quota check leaves its tokens out of the requester's own allowance.

## Audit (ADR-0028)

Governance events, as metadata only — never a question, an answer, a title or notes:
`ai.conversation.created`, `ai.conversation.deleted`, `ai.policy.refused` (`timed_assessment`,
`feature_disabled`, `restricted_content`, `data_not_approved`), `ai.quota.exceeded`,
`ai.generation.busy`, `ai.generation.failed` (the provider's failure kind); from 7D
`ai.settings.updated` (before and after), `ai.retention.swept`, `ai.usage.reconciled`,
`ai.budget.warning`, `ai.budget.exceeded` and `ai.cache.purged` (counts). A completed answer is not
audited: the usage ledger records every call, and the audit log is not a log of every call
(ADR-0028).

The knowledge base's (8A), by ids, counts, hashes and states — never its content:
`ai.knowledge.source.created`, `ai.knowledge.source.updated`, `ai.knowledge.source.published`,
`ai.knowledge.source.archived`, `ai.knowledge.document.created`, `ai.knowledge.version.created`
(the document, number, format, hash and length), `ai.knowledge.version.ingestion` (the new state:
processing when an ingestion starts; chunked with its counts, parser, chunker and duration; failed
with its code and stage), `ai.knowledge.chunks.recorded` (counts and the chunker) and, from 8B,
`ai.knowledge.ingestion.requested` (who asked for an ingestion). From 8C:
`ai.knowledge.embedding.requested` (the contract), `ai.knowledge.embedding` (the run's new state:
embedding with its attempt; embedded with its counts, batches, what was purged and the duration;
failed with its code, stage and whether it may pass), and `ai.knowledge.source.archived` counts the
vectors that went with the source.

## Privacy

A learner's export carries their conversations with their titles and notes (deleted ones too,
until purged), the answers the cache keeps for them alone, their calls and their daily usage, naming
no provider or model. Erasure deletes their conversations, messages, notes and those answers; their
calls and daily totals stay, belonging to nobody, so the institute's figures do not change. Answers
shared between learners name nobody and hold nothing of anyone, and stay.

The knowledge base (8A) is the institute's, not a person's: a learner's export does not carry it,
and their erasure leaves it whole — its files name no uploader.

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
| `ai.knowledge.embed` | When a version's embedding is asked for  | The version's chunks as vectors, a batch at a time (8C; see "The knowledge base")     |

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

## The knowledge base (Phases 8A to 8C; ADR-0033, ADR-0034, ADR-0035)

What SI Academy AI will draw on in Phase 8: the institute's own material, never crawled or scraped.
Phase 8A built its foundation, Phase 8B its ingestion into chunks and Phase 8C their embeddings.
Nothing is retrieved yet, and no web page shows it.

- **The chain.** A source holds documents, a document has versions, a version is cut into chunks
  (`knowledge/`). Each row carries its institute and its parents' ids, and composite foreign keys
  hold them to the parents: a chunk cannot name a version, document, source or institute it does
  not belong to. One version of a document is current, and only a chunked one.
- **A source** has an audience (`institute`, `staff`, `course` with its course), a data class
  (`public`, `course`, `personal`) and a state: written as a draft, published once, archived for
  good. Who it is for and what it holds are fixed when it is published.
- **A version** is the document's text, normalised (NFC, LF line ends, no trailing spaces, no
  blank lines at either end) and hashed with SHA-256 (`content-hash.ts`). The same content twice
  is refused, in any form; a change is the next version. The text is kept through the storage
  driver in the private bucket, with a `files` row of owner type `knowledge-version`, its checksum
  the hash, and no uploader. The files API never serves it by id (a file no upload context
  describes is reached only through the module that wrote it).
- **Ingestion** (Phase 8B; `knowledge/ingestion/`, ADR-0034). Asked for through
  `POST /ai/knowledge/versions/:id/ingest`; run by the `ai.knowledge.ingest` job with the version's
  id alone (`knowledge-jobs.ts`):
  1. **claim** (`KnowledgeService.claim`): a version of this institute, pending, failed, or
     processing past its 10-minute lease; the claim's time is the token every later write checks;
  2. **check**: the source and document not archived, a lesson document in its source's course, no
     newer version current, the file the version's own (owner type, owner, institute, folder,
     private, ready), a format the job reads, the size;
  3. **read** at most 2 MiB through the storage driver, as strict UTF-8, and **verify** its hash;
  4. **extract** (`pipeline.ts`): normalise (`normalize.ts`), read the structure — Markdown
     (`markdown.ts`), plain text, or HTML through the sanitiser (`html.ts`) — into blocks
     (`blocks.ts`), and **chunk** (`chunker.ts`, `sections-1/1200-2000-200-200`);
  5. **record** (`recordChunks`): every chunk, with an id from its version, position and hash, and
     the chunked state, in one transaction; the newest chunked version becomes current.

  Anything that stops it is a code on the version (`KNOWLEDGE_INGESTION_FAILURES`);
  `storage_unavailable` and `persist_failed` are retried by the queue. The job does nothing while
  `module.ai` or `ai.knowledge` is off. Ingesting a version again gives the same chunks, ids and
  hashes; a chunked version is never taken again.

- **The hand-over to Phase 8C** (`KnowledgeIngestionService.chunksForEmbedding`,
  `KnowledgeEmbeddingInput`): a chunked version's chunks with their provenance, text, hash, counts,
  parser and chunker, document and visibility — from the database alone, never the file. None for
  archived knowledge, another institute or personal data.
- **Who may draw on a chunk** (`KnowledgeReachService`, for Phase 8D's retrieval to filter by): the
  person's institute; a published source; public or course data (personal waits for 8E); an
  audience that includes them — the institute, staff alone (no student profile), or a course they
  reach, down to a lesson as the player would open it; the current, chunked version of an active
  document. Each condition is read from the database when asked.
- **Embeddings** (Phase 8C; `knowledge/embedding/`, ADR-0035). Asked for through
  `POST /ai/knowledge/versions/:id/embed`; run by the `ai.knowledge.embed` job with the version's
  id alone:
  1. **eligible**: the current, chunked version of an active document of a published source of
     this institute, public or course data that the deployment and the institute approve for the
     provider — checked by the request and again by the job;
  2. **claim** the run under the active contract (provider, model, dimension, embedding version
     `embed-1`; `contract.ts`): pending, failed, or embedding past its 10-minute lease; every later
     write is fenced by the claim's time;
  3. **embed** the chunks without a valid vector — under the contract, with their chunk's current
     hash — from `chunksForEmbedding`, a batch of `AI_EMBEDDING_BATCH_SIZE` (32) at a time, through
     `ModelRouter.embed`, which refuses what the provider may not be given and checks every vector
     (one per text, 768 values, finite, scaled to unit length);
  4. **record** each batch's vectors (`knowledge_chunk_embeddings`, replaced in place, never
     duplicated) with its calls' ledger rows, in one transaction;
  5. **finish** once every chunk has a valid vector: the run is embedded, and the vectors of the
     document's older versions and of the version under other contracts are deleted.

  Failures are codes on the run (`KNOWLEDGE_EMBEDDING_FAILURES`); those that may pass go back to
  the queue (three retries) and each retry goes on from the vectors already written. The job does
  nothing while `module.ai` or `ai.knowledge` is off, or while the installation cannot embed.
  Archiving a source deletes its vectors. No route returns a vector, and nothing compares them
  before Phase 8D. The fake provider embeds deterministically, offline, with no key; Gemini's
  `gemini-embedding-001` is used only when configured (`AI_PROVIDER=gemini`), and
  `pnpm --filter @lms/api ai:embed-smoke -- --confirm` makes the first live check.

- **Vector readiness** (`vector-readiness.ts`): the status route reads, from PostgreSQL's catalogue,
  whether the `vector` extension is available and installed, and its version; it counts the vectors
  under the active contract. Every environment runs the pgvector image since Phase 8C (ADR-0026),
  and the 8C migration installs the extension. The chunks themselves have no vector column.

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
