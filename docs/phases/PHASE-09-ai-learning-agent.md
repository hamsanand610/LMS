# Phase 9 — AI Learning Agent

| Field    | Value                                                                                                                                                                                                                                                                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **In progress.** 9A (reconnaissance, architecture and plan) approved on 6 October 2026. The pre-9B security hardening approved and closed the same day. **9B (agent foundation and orchestrator) built and approved on 6 October 2026; its migration reached `lms` the same day; closed once GitHub CI is green.** 9C to 9F not started. |
| Scope    | The client's Phase 9A brief and Phase 9B brief, 6 October 2026                                                                                                                                                                                                                                                                           |
| Roadmap  | `docs/ROADMAP.md`, Phase 9. Its gate: every capability works against real LMS context through controlled tools, without hidden tests, hidden answers, private trainer material or another learner's data in any prompt or reply                                                                                                          |
| ADRs     | ADR-0039 (the native, bounded orchestrator over read-only tools; 9B)                                                                                                                                                                                                                                                                     |
| Boundary | Each slice starts only with the client's go-ahead. 9B builds the foundation and its first capability, and nothing of 9C onwards.                                                                                                                                                                                                         |

## Slices

| Slice  | Delivers                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9A** | **Approved** (6 October 2026). Read-only reconnaissance, the architecture and this plan's slices. The pre-9B hardening: AI course and lesson reach requires `courses:read` and the Courses module; a learner sees a lesson's practice question as its words and options only.                                                                               |
| **9B** | **Built and approved** (6 October 2026); its migration on `lms` the same day (backup `lms-before-phase9b.dump`). The native, bounded orchestrator, two read-only tools (`knowledge_search`, `lesson_content`) and the first capability: explain the lesson being studied, or clear a doubt about it, from approved lesson and knowledge material. ADR-0039. |
| 9C     | Not started. Further read-only tools and the narrow learner context: progress, recent lessons, weak topics, lab attempts.                                                                                                                                                                                                                                   |
| 9D     | Not started. The roadmap's other capabilities, and their UI.                                                                                                                                                                                                                                                                                                |
| 9E     | Not started. Security and evaluation: the red-team suite as a committed runner, quality thresholds.                                                                                                                                                                                                                                                         |
| 9F     | Not started. Hardening and closure.                                                                                                                                                                                                                                                                                                                         |

The 9A slices beyond 9B are a proposal: each is planned again, and approved, before it starts.

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
  words, and a notice or an error code. No new error code was added.
- **Events, in order:**
  1. `meta`;
  2. `step` (`routing`, `reading_lesson`, `searching_knowledge`, `planning`, `drafting`,
     `verifying`);
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

## Verification (9B)

Recorded in `docs/PROGRESS_LOG.md` (session 43): the unit and end-to-end counts, the 28 security
cases, the deliberate breaks with their restoration, typecheck, lint, formatting, the builds and
the full API end-to-end suite.

## What 9C starts from

The run, the registry and the tool contract take further read-only tools without change to the
orchestrator's limits. These are 9C's, after approval:

- the learner context beyond the pinned course and lesson;
- tools over progress and lab attempts;
- any memory beyond a conversation's last ten messages.

The UI is 9D's.
