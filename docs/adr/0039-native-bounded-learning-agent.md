# ADR-0039 — The learning agent: a native, bounded orchestrator over read-only tools

- **Status**: accepted — built on 6 October 2026 in Phase 9B, and approved by the client the same day
- **Date**: 2026-10-06
- **Phase**: Roadmap Phase 9 (AI Learning Agent), slice 9B — the agent's foundation and first
  capability
- **Builds on**: ADR-0024 (providers, models and data classes), ADR-0025 (orchestration and the
  model router), ADR-0028 (observability), ADR-0029 (quotas and budgets), ADR-0030 (streaming and
  retention), ADR-0031 (where AI is allowed), ADR-0036 (retrieval), ADR-0037 (grounded answers),
  ADR-0038 (the stand-in provider)
- **Amends**: `docs/architecture/AI_ARCHITECTURE.md` §5 — "The agent is a LangGraph graph" — and
  settles ADR-0025's "LangChain/LangGraph: planned, not decided" for the agent: **not adopted**

## Context

Phase 9 builds the AI Learning Agent. Phase 9A's reconnaissance (approved 6 October 2026) found that
the provider contract is text only — system, user and assistant messages; no tool or function
calling — that every service the agent would read through checks its caller only when called through
HTTP, and that the conversation path streams a model's words as they arrive. The client's 9B brief
then fixed the shape: a native orchestrator; no LangChain, LangGraph, Redis or external agent
framework; no arbitrary tool, web, SQL, filesystem, shell or outbound HTTP access; no autonomous or
background agent; learners only; every limit enforced in code; nothing unverified ever streamed.

## Decision

1. **A native orchestrator** (`apps/api/src/modules/ai/agent/`). A run is a deterministic recipe
   the server executes; the model only proposes, in strict JSON the server validates. The model
   never runs anything.
2. **The execution model.** Entry → policy gate → pin context → route → the capability's recipe →
   at most one follow-up round → draft → verify → the learner's authorization once more → stream
   only the verified output → complete.
   - Routing is `{"capability","needsKnowledge","needsLesson"}`, strict: one controlled retry,
     then a safe refusal.
   - `explain_lesson`: the open lesson's content, then a knowledge search if it would help.
     `clarify_doubt`: a knowledge search, then the lesson if it would help.
   - The follow-up is offered only while the evidence is thin and calls remain for a draft and its
     regeneration. It is `{"action":"finish"}` or `{"action":"tool","tool","arguments"}`; the
     envelope is checked here, the name and arguments by the tool registry.
3. **Two tools, read-only, allow-listed** (`AgentToolRegistry`). `knowledge_search` goes through
   `KnowledgeRetrievalService` — the one retrieval authority (Phase 8D), unchanged — and keeps only
   Phase 8E's evidence (`packEvidence`). `lesson_content` goes through
   `LessonsService.aiContextFor`, the lesson player's own rule.
   - **Each tool declares**: name, description, input and output schemas (strict), its data class,
     the permissions and modules it needs, the flags that switch it on, its deadline and largest
     output, that it is never available during a timed test, and that it changes nothing.
   - **Every call**: a name on the list; exactly the tool's arguments (an identity, a scope or any
     extra field refuses the call); the learner authorized afresh (current permissions, the
     learner's profile, `module.ai`, `ai.agent`, the tool's modules, no timed test, the data class
     approved); the tool's deadline; its declared output and bound; the same call twice is a loop
     and is not run.
   - The learner, institute, course and lesson come from the run's pinned context, never from a
     model.
4. **Hard limits**, in code (`AGENT_LIMITS`, counted in `RunBudget` before each call):

   | Limit                            | Value                          | Limit                      | Value                    |
   | -------------------------------- | ------------------------------ | -------------------------- | ------------------------ |
   | steps (model + tool calls)       | 8                              | run time                   | 120 s                    |
   | model calls (stand-ins included) | 4                              | one model call             | 60 s (and AI_TIMEOUT_MS) |
   | tool calls                       | 6                              | knowledge search           | 10 s                     |
   | knowledge searches               | 3                              | lesson content             | 5 s                      |
   | follow-up rounds                 | 1                              | routing / follow-up output | 256 tokens               |
   | evidence                         | 12,000 characters              | final answer               | 1,024 tokens             |
   | other observations               | 8,000 characters               | run tokens                 | 24,000                   |
   | history                          | 10 messages, 16,000 characters | runs per learner           | 1                        |
   | runs per process                 | 8                              | route rate limit           | 10 per 300 s per learner |

5. **Cancellation.** The client going away aborts the run's signal, and with it whatever is in
   flight: a model call and its stand-in, a tool, a retrieval's embedding. A run cancelled while
   its quotas are read starts no further call. The run's deadline aborts the same way. A run's
   turn left `streaming` by a stopped process is abandoned only after the run's deadline and 30 s
   more (`AGENT_ABANDONED_AFTER_MS`); other answers keep their own window.
6. **Verification before streaming** (`verifyDraft`). Checks:
   - a whole answer: not withheld by the provider, not cut short;
   - no tool protocol, and no sign of obeyed planted instructions;
   - none of the run's identifiers, and no credential (the platform's patterns, plus Groq keys and
     signed tokens);
   - then Phase 8E/8F's grounded checks (`checkAnswer`): no leaked instructions or reference code,
     known citations only, every sentence cited and supported by the passages it cites.

   On failure: one regeneration, then every check again. If it fails again, nothing is streamed —
   `not_grounded`, or `refused` when the fault was unsafe. The learner's authorization is then
   checked once more: permissions afresh, the policy, every cited lesson still open, every cited
   passage still in reach (published source, active document, current version).

7. **Conversations.** `AiPurpose` gains `agent` — the one migration. A run is an ordinary turn:
   the question and the answer's placeholder written together, the database's one answer at a time
   per person, closed once with its calls in the ledger. The messages route refuses an agent
   conversation, and the run route takes no other. No new table, and no learner memory.
8. **Usage.** Feature `agent`; each call recorded with its own task (`classify` to route or plan,
   `chat` to write) and one question per run. The allowance and the budget are asked before the
   first call (`assertWithinQuota`), then before each further call, a stand-in, the follow-up and
   the regeneration, counting the run's own calls (`AiUsageService.runBlockedBy`). They fail
   closed. No semantic cache.
9. **Audit** — one `ai.agent.run` entry per run, metadata only:
   - status and reason, capability, the tools by name with how each call ended, the counts;
   - provider, model, stand-in, tokens, duration;
   - never the question, a prompt, the evidence, a tool's arguments or output, or the answer.

   Refusals before the turn are recorded by code.

10. **Access.** Permission `ai:agent` (learners' own; in the student bundle) and flag `ai.agent`
    (off by default), with `module.ai`. Staff are refused whatever their role grants.

## The route

`POST /api/v1/ai/agent/conversations/:id/runs`

- **Request:** `{"content": "…"}`, 1–4,000 characters. `?stream=false` for one JSON result;
  server-sent events otherwise.
- **Statuses:** `answered`, `insufficient_evidence`, `not_grounded`, `limit_reached`, `refused`,
  `failed`, `cancelled`.
- **Events:** `meta`, `step` (a state only), `delta` and `sources` (only once verified), `notice`,
  `usage`, `error`, `done`, `ping`.
- **Refusals before the turn** use the platform's existing codes; no new error code was needed. A
  limit is a run's status and notice (`limit_reached`), not an error.

## Consequences

- The agent is small enough to read whole, and every limit, check and refusal is a line of code
  with a test that fails without it (the 9B deliberate-break gate).
- Phase 8 stays as it was: retrieval, its SQL, the reach rule, ranking and the grounded checks are
  reused, not changed.
- Small additive changes outside the agent module:
  - the router awaits an optional `beforeFallback` before a stand-in;
  - a ledger call may name its own task;
  - a turn may carry its own prompt version.
- Known limits:
  - Verification is lexical (Phase 8F's): it cannot understand meaning.
  - The planted-instruction check is conservative and may refuse a legitimate answer about prompt
    injection itself.
  - The per-learner and per-process run gates are in memory, as Phase 8E's were; across processes
    the database's one answer at a time per person still holds.
  - History is data only, never evidence.
- **Not in 9B:** the learner context beyond the pinned course and lesson (weak topics,
  recommendations, recent lessons, lab attempts, memory, a profile — 9C), the roadmap's other
  capabilities, and any UI.

## Alternatives considered

- **LangGraph / LangChain.** Refused by the brief. It would also add a dependency footprint and a
  second place where steps, state and retries are decided, against ADR-0025's single router.
- **Provider-native function calling.** The provider contract is text only, and Gemini and Groq
  differ. A strict JSON protocol, validated by the server, keeps the platform the only executor.
- **A free ReAct loop.** Unbounded by nature. Replaced by recipes and one follow-up round.
