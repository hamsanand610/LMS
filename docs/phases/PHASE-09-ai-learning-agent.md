# Phase 9 — AI Learning Agent

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **Built: 9A to 9F.** 9A (reconnaissance, architecture and plan) approved on 6 October 2026, with the pre-9B security hardening. **9B (agent foundation and orchestrator): CLOSED, 100%** — `ff60c00`, GitHub Actions run #32. **9C to 9F** (the learner's context, the workflows and their UI, security and evaluation, hardening and closure) built on 7 October 2026 in one continuous execution, as the client's Phase 9 completion brief of that day asked; Phase 9 closes once its commit's GitHub CI is green. |
| Scope    | The client's Phase 9A and 9B briefs (6 October 2026); the 9C reconnaissance brief and the Phase 9 completion brief (7 October 2026), which set Phase 9's final scope to 9C to 9F                                                                                                                                                                                                                                                                                                                                     |
| Roadmap  | `docs/ROADMAP.md`, Phase 9. Its gate: every capability works against real LMS context through controlled tools, without hidden tests, hidden answers, private trainer material or another learner's data in any prompt or reply                                                                                                                                                                                                                                                                                      |
| ADRs     | ADR-0039 (the native, bounded orchestrator; 9B), ADR-0040 (the learner's context: live state, data classes, history taint, lab answers without code; 9C to 9F), ADR-0041 (personal data and the providers)                                                                                                                                                                                                                                                                                                           |
| Boundary | No persistent learner memory; no LangChain, LangGraph, Redis, autonomous agent, arbitrary tool, SQL, filesystem, shell, web or HTTP access; the agent never runs a learner's code. Phase 10 not started.                                                                                                                                                                                                                                                                                                             |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9A** | **Approved** (6 October 2026). Read-only reconnaissance, the architecture and this plan's slices. The pre-9B hardening: AI course and lesson reach requires `courses:read` and the Courses module; a learner sees a lesson's practice question as its words and options only.                                                                                                                                                 |
| **9B** | **Closed** (6 October 2026): built and approved; its migration on `lms` (backup `lms-before-phase9b.dump`); `ff60c00`; GitHub Actions run #32 green. The native, bounded orchestrator, two read-only tools (`knowledge_search`, `lesson_content`) and the first capability: explain the lesson being studied, or clear a doubt about it, from approved lesson and knowledge material. ADR-0039.                               |
| **9C** | **Built** (7 October 2026). The learner's context, read live and never stored: `learning_state` (progress, the lock-aware next lesson, what is due) and `lab_attempt` (their own failed attempt at the pinned lab); AI-safe reads in the courses, assignments, tests and practice modules; data classes per call, history taint, the personal-data gate (ADR-0040, ADR-0041). No weak topics: no authoritative signal exists. |
| **9D** | **Built** (7 October 2026). The workflows and their UI: the assistant beside a course or lesson is the learning agent for a learner with it on (suggested questions, safe status steps, verified answers with their sources); "Explain my failed attempt" beside a lab; agent conversations in the `/ai` workspace.                                                                                                           |
| **9E** | **Built** (7 October 2026). Security and evaluation: the learner-context security suite, the deterministic evaluation set (20 cases, its measures all zero), the deliberate breaks.                                                                                                                                                                                                                                           |
| **9F** | **Built** (7 October 2026). Hardening and closure: bounds, deadlines and measured cost; documents; the final regression, CI and the AWS readiness review.                                                                                                                                                                                                                                                                     |

The client's Phase 9 completion brief (7 October 2026) asked for 9C to 9F in one continuous execution,
with no approval between slices.

## Slice 9B — items (the client's Phase 9B brief, 6 October 2026)

| ID       | Item                                                                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-9B-01 | Shared contracts (`packages/shared/src/schemas/agent.ts`): the request, its query, the result, the citations and the stream's events, all strict; the purpose `agent`, the feature and flag `ai.agent`, the permission `ai:agent` |
| AI-9B-02 | The one migration, `20261013090000_phase9b_agent_purpose`: `AiPurpose` gains `agent`                                                                                                                                              |
| AI-9B-03 | The tool contract (`AgentTool`) and the registry (`AgentToolRegistry`): an allow-list of two; strict arguments; every call authorized afresh; deadlines; checked, bounded output                                                  |
| AI-9B-04 | `knowledge_search`: `KnowledgeRetrievalService` (unchanged) for the learner, from the pinned lesson or course; Phase 8E's evidence rule; credentials withheld                                                                     |
| AI-9B-05 | `lesson_content`: `LessonsService.aiContextFor` for the pinned lesson; at most 6,000 characters; withheld whole if any of it holds a credential                                                                                   |
| AI-9B-06 | The run (`AgentRun`): strict routing with one controlled retry; the two capabilities' recipes; one follow-up round at most; the draft; verification and one regeneration; the learner's authorization once more                   |
| AI-9B-07 | Hard limits (`AGENT_LIMITS`, `RunBudget`), deadlines and cancellation end to end                                                                                                                                                  |
| AI-9B-08 | The route, `POST /api/v1/ai/agent/conversations/:id/runs`, and its stream of verified output only                                                                                                                                 |
| AI-9B-09 | Usage: feature `agent`, a task per call, one question a run, quotas between steps and before a stand-in; no semantic cache                                                                                                        |
| AI-9B-10 | Audit: `ai.agent.run`, metadata only                                                                                                                                                                                              |
| AI-9B-11 | Conversations: agent runs are turns; the messages route refuses agent conversations; agent turns abandoned only past the run's deadline                                                                                           |
| AI-9B-12 | Tests: unit, end to end, the 28 security cases, deliberate breaks                                                                                                                                                                 |
| AI-9B-13 | ADR-0039, `AI_ARCHITECTURE.md` §5, this plan                                                                                                                                                                                      |

## Slices 9C to 9F — items (the client's Phase 9 completion brief, 7 October 2026)

| ID       | Item                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-9C-01 | Data classes `public` < `course` < `personal` < `restricted` per call (`mostSensitive`): the subject, the history a request sends, the evidence; the trace and ledger record the most sensitive                                 |
| AI-9C-02 | History taint: an answer kept with its draft's class (`ai_messages.data_class`); history read with its classes; a message of a class not approved left out; the gateway refuses history more sensitive than its conversation    |
| AI-9C-03 | `CourseLearningStateService` (courses module): the learner's own state, read only, lock-aware, bounded (40 lessons, 12 modules, 8 courses), asking its own permissions, modules and reach                                       |
| AI-9C-04 | `learning_state` tool: strict `{}`, personal, at most 3,000 characters; progress, lessons, what is due (`LearnerAssignmentsService.aiDueSummary`, `AttemptsService.aiOpenWindows`)                                              |
| AI-9C-05 | `lab_attempt` tool: strict `{}`, personal, at most 6,000 characters; the AI Hint's gate (`requireHintableLab`, now shared), the pinned lab lesson, `labHintBrief`; at least one failed attempt; never runs code                 |
| AI-9C-06 | Capabilities `learning_state`, `explain_lab_attempt`, and `clarify_doubt` with `needsState`; their recipes; the 9B limits unchanged                                                                                             |
| AI-9C-07 | The personal-data gate: unavailable unless approved (`context_unavailable`); Gemini only, never a stand-in unapproved for it (ADR-0041)                                                                                         |
| AI-9C-08 | The last check re-asks the learner's state, the lab and the answer's data class                                                                                                                                                 |
| AI-9D-01 | Shared contracts: capabilities, tools, steps (`reading_progress`, `reading_lab_attempt`), citations (`learning_state`, `lab_attempt`), notices (`context_unavailable`, `needs_attempt`), availability `subjects.learnerContext` |
| AI-9D-02 | The web's agent run (`useAgentRun`): steps in fixed safe words, only verified words, sources, the platform's own words as a note                                                                                                |
| AI-9D-03 | The assistant beside a course or lesson as the learning agent, with its suggested questions                                                                                                                                     |
| AI-9D-04 | "Explain my failed attempt" beside a lab, after an attempt that did not pass                                                                                                                                                    |
| AI-9D-05 | The `/ai` workspace: agent conversations started and continued                                                                                                                                                                  |
| AI-9E-01 | The learner-context security suite (`test/ai-agent-context.e2e-spec.ts`)                                                                                                                                                        |
| AI-9E-02 | The deterministic evaluation set (`test/ai-agent-evaluation.e2e-spec.ts`): 20 cases; leakage, fabricated citations, unchecked streaming, injection and personal-to-stand-in all zero                                            |
| AI-9E-03 | Deliberate breaks of every security control added in 9C to 9E                                                                                                                                                                   |
| AI-9E-04 | No code in a lab explanation (`solution_code`)                                                                                                                                                                                  |
| AI-9F-01 | Bounds and deadlines (state 5 s, lab 5 s), cost measured (no extra model call), the final regression                                                                                                                            |
| AI-9F-02 | ADR-0040, ADR-0041, ADR-0039 amended; the documents' contradictions resolved; the AWS readiness review                                                                                                                          |

## The route (9B)

`POST /api/v1/ai/agent/conversations/:id/runs` — `ai:agent`; 10 runs per 5 minutes per learner.

- **The conversation:** started with `POST /ai/conversations` and `{"purpose": "agent", "context":
{"lessonId": …} | {"courseId": …}}`. It may also name nothing. It is read and deleted like any
  other conversation.
- **Request:** `{"content": "…"}`, 1–4,000 characters, strict.
- **Query:** `stream=false` gives one JSON result; otherwise server-sent events.
- **Refused before the turn** (ordinary problem responses; nothing stored or called):

  | Status | Codes                                                                                                                                             |
  | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 401    | unauthenticated                                                                                                                                   |
  | 403    | `forbidden`, `module_disabled`, `ai_feature_disabled`, `ai_not_allowed` (timed test), `ai_data_not_approved`, the lesson or course no longer open |
  | 404    | the conversation                                                                                                                                  |
  | 409    | `ai_generation_in_progress`                                                                                                                       |
  | 422    | `ai_restricted_content`, `ai_subject_not_supported`                                                                                               |
  | 429    | `rate_limited`, `ai_quota_exceeded`                                                                                                               |
  | 503    | `ai_unavailable`, `ai_busy`                                                                                                                       |

- **Run statuses:** `answered`, `insufficient_evidence`, `not_grounded`, `limit_reached`,
  `refused`, `failed`, `cancelled`. A status other than `answered` carries the platform's own
  words, and a notice or an error code. No new error code was added. Phase 9C added two notices:
  `context_unavailable` (the learner's own progress or attempt cannot be used: not approved, or no
  lab open) and `needs_attempt` (an attempt is explained only after one that did not pass).
- **Conversations (9C):** `{"purpose": "agent", "context": {"questionId": …}}` pins a lab — the AI
  Hint's own rule decides it — besides a course or a lesson; a lab lesson pins its lab too.
- **Events, in order:**
  1. `meta`;
  2. `step` (`routing`, `reading_lesson`, `reading_progress`, `reading_lab_attempt`,
     `searching_knowledge`, `planning`, `drafting`, `verifying`);
  3. only once verified: `delta`s, then `sources`;
  4. `notice` or `error`;
  5. `usage`;
  6. `done`.

  `ping` keeps the line open.

- **There is no stop route.** Closing the request cancels the run.

## Security boundaries (9B)

- The model proposes. The server executes only allow-listed, read-only tools, with exactly their
  arguments. Every tool call:
  - re-checks the learner, their current permissions, the flags, the modules and a timed test;
  - reads the learner's identity, institute, course and lesson from the pinned context, never
    from a model.
- Nothing reaches a model that the learner could not open in the product:
  - the lesson player's rule for the lesson;
  - Phase 8's reach rule for knowledge;
  - no credential, hidden test, reference solution, staff note or other learner's data.
- Nothing reaches the learner unverified, and nothing of the run's insides ever does: no prompt,
  reasoning, tool argument, provider error or key.
- Every limit is counted in code before the call it bounds.

## Security boundaries (9C to 9F)

- The learner's own records are read through AI-safe reads that ask for themselves — never the
  player's `LessonsService.get`, which records an opening, nor anything that runs the sandbox,
  shows a staff view, or another learner.
- No model names a learner, institute, course, lesson or lab: the new tools take `{}`, and any
  argument refuses the call.
- Personal data only while approved, only to the task's own model; restricted never; the
  learner's answers kept as personal, and the requests that resend them too.
- A lab explanation never holds code, a hidden check, a reference solution or another learner's
  work; the agent never runs, re-runs or submits.
- No help during a timed test (unchanged, ADR-0031); the `hasOpenAttempt` gap the reconnaissance
  found (an expired attempt not yet submitted) is recorded, not changed.

## Verification (9B)

Recorded in `docs/PROGRESS_LOG.md` (session 43): the unit and end-to-end counts, the 28 security
cases, the deliberate breaks with their restoration, typecheck, lint, formatting, the builds and
the full API end-to-end suite.

## Verification (9C to 9F)

Recorded in `docs/PROGRESS_LOG.md` (session 45), 7 October 2026:

| Check                                | Result                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Unit                                 | shared 168, API 641, web 76, runner 16                                                                         |
| Typecheck, lint, formatting, builds  | 9 of 9, 9 of 9, clean, 6 of 6                                                                                  |
| Full API end-to-end                  | 57 files, 725 of 725 (then the learner-context spec, 29 of 29, with one test added after)                      |
| The learner-context security suite   | `test/ai-agent-context.e2e-spec.ts`: 29                                                                        |
| The evaluation set                   | 20 of 20 cases; leakage, fabricated citations, unchecked streaming, injection, personal to the stand-in: all 0 |
| Deliberate breaks                    | 54 of 54 caught (9B's 17 re-run, 37 new), every file restored and verified                                     |
| Browser (AI journeys, fake provider) | Chromium 13 of 13; phone 11 passed, 2 skipped (desktop-only pages)                                             |
| Cost and time (fake provider)        | 2 model calls for a state or lab answer; server time p50 129 ms, p95 314 ms                                    |

## What Phase 9 did not build (deferred by the client's Phase 9 completion brief)

Recorded in AI_ARCHITECTURE §5: weak-topic or mastery models (no authoritative signal); quizzes and
generated practice; help debug by re-running code; SQL schema and results; assignment feedback and
test result detail; recommendations beyond the next open lesson; escalation to a trainer (a write
tool); any learner memory. Each needs its own brief and approval.
