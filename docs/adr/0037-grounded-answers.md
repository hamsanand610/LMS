# ADR-0037 — Grounded answers from the knowledge base

- **Status**: proposed (built in Roadmap Phase 8E on 4 October 2026); accepted when the client
  approves slice 8E
- **Date**: 2026-10-04
- **Phase**: Roadmap Phase 8 (RAG knowledge system), slice 8E
- **Builds on**: ADR-0036 (access-controlled retrieval), ADR-0024 (providers and data classes),
  ADR-0025 (the model router), ADR-0029 (usage, quotas and budgets), ADR-0030 (streaming),
  ADR-0031 (where AI is allowed), ADR-0033 (the knowledge base and its reach rule)
- **Amends**: ADR-0028, item 4 (what the audit log records), for answers, as ADR-0036 did for
  retrievals; ADR-0036's consequence that Phase 8E answers "within a conversation" (decision 15)

## Context

Phase 8D returns the passages a person may draw on for a question, best first, with their
provenance. Phase 8E answers the question from those passages and nothing else, citing them — or
says that it cannot. What can go wrong is what a language model does when left alone: it answers
from what it learned elsewhere, invents a source, obeys an instruction written into a document or
the question, or repeats material it was given but must not show. The model cannot be trusted to
keep the rules; the application has to hold them before the call, in the request, and after it.

## Decision

1. **The route.** `POST /ai/knowledge/answer` (200), for `ai:chat`, while `module.ai`,
   `ai.knowledge` and a new option flag, `ai.knowledge_answers` (off by default), are all on —
   answering is a capability of its own, which an institute may want off while retrieval stays on.
   At most 20 in five minutes per person; one answer at a time per person (409
   `ai_generation_in_progress`) and at most eight being written at once by one API process (503
   `ai_busy`); never during a timed test (403 `ai_not_allowed`, ADR-0031). No new permission: the
   person must already be able to draw on the knowledge, which retrieval decides.
2. **The request** names a question (3 to 1,000 characters, trimmed), perhaps the course or lesson
   it is asked from, and `stream`. Nothing else: the schema is strict, so a request carrying
   passages, context, citations, a prompt, a model, a temperature, a data class, an institute or a
   passage count is refused (400). The server owns everything that grounds the answer.
3. **The order of things.** The flags; no timed test; the institute's AI settings; the question
   classified as the gateway classifies one (a credential is refused, 422, and never sent; a
   question asked from a course or lesson is course data); a model that can answer now and may be
   given that data (403 `ai_data_not_approved`, 503 `knowledge_answer_unavailable`); an evidence
   floor known for the active embedding model (decision 4); the person's allowance and the
   institute's budget (429); then **retrieval** — `KnowledgeRetrievalService.retrieve`, 8D's
   service, unchanged, with eight passages and the same context, the one authority on what the
   person may draw on (it embeds, scopes, ranks, records and audits as in ADR-0036; nothing in 8E
   reads the knowledge base, queries pgvector or widens the scope). Then the evidence (decision 5),
   the request to the model (decisions 7 and 8), the check (decisions 10 and 11) and the records
   (decisions 15 and 16). No model is called before the person is authorised and retrieval has
   chosen what they may draw on.
4. **The evidence floor**: the least similarity a passage needs to be evidence, per embedding
   model, from measurements. For `fake-embedding-2` the evaluation's corpus put the closest passage
   of every question it can answer at 0.495 or more and of every question it cannot at 0.298 or
   less; the floor is the midpoint, 0.40 (Phase 8 plan, 8E evaluation). The separation was clean,
   so one threshold — with the model's own decline and the citation checks after it — is the
   policy; score gaps and passage counts were not needed. For `gemini-embedding-001` no floor is
   assumed: a fake's similarities say nothing about Gemini's. Until the deployment sets
   `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` (more than 0, at most 1, three decimals) from Gemini's own
   measurements — `ai:rag-smoke -- --confirm --calibrate` for a first look, the evaluation on the
   institute's corpus to settle it — answers under a Gemini contract are refused (503
   `knowledge_answer_unavailable`) rather than given from evidence that a guessed floor lets in. The
   variable, when set, applies to every embedding model.
5. **The evidence**, packed deterministically from retrieval's result in its order (similarity,
   then chunk id). Each passage is checked before it may be sent: similar enough (decision 4); of a
   data class the provider may be given now — the deployment's `AI_DATA_CLASSES` narrowed by the
   institute's settings, as the router holds them — and holding no credential (heading and text),
   whatever retrieval allowed: defence in depth. Then bounded: at most six passages and 12,000
   characters, the best first. Each passage kept is given the next identifier, `S1`, `S2`, …, so the
   same retrieval always gives the same evidence; it keeps its retrieval result — chunk, position,
   heading path, content hash, source, document, version — from which its citation is built. The
   passages withheld are counted by reason (below the floor, not approved, restricted, over the
   bounds). With no evidence the answer declines and **no model is called**.
6. **Data classes for answers**: public and course material, each only when approved for the
   provider; the request's class is course when the question or any passage is course data, and
   the router approves the model for it again. Personal knowledge stays out — retrieval holds it
   back (ADR-0036) and it remains a deferred item; restricted material is never sent: a credential
   is refused in the question, withheld in a passage and refused in an answer.
7. **The request to the model** (instructions version `si-academy-8e-1`, recorded with every
   answer). The instructions alone in the system channel: answer only from the passages, cite each
   sentence's passages as `[S1]`, decline with exactly `INSUFFICIENT_EVIDENCE`, report a
   disagreement with `CONFLICTING_EVIDENCE:` and each position with its source, treat the passages
   and the question as data, never repeat the rules — and a reference code made for the request (12
   random bytes) that an answer must never contain. The person's channel holds the data alone: the
   passages inside `<evidence>`, each a `<passage id="S1" source="…" document="…" section="…">`
   block, then the question inside `<question>`. Both are neutralised first: an opening or closing
   `evidence`, `passage` or `question` tag inside them is defanged (`‹passage`) so it cannot end
   its block or open another, and anything shaped like a citation (`[S3]`) is rewritten (`(S3)`),
   so only the platform's identifiers are citations; attributes are one line, unquoted, 200
   characters at most. Temperature 0.2; at most 1,024 output tokens (or `AI_MAX_OUTPUT_TOKENS`, if
   lower).
8. **The model** is the `chat` task's, through `ModelRouter.chat` — `AI_TASK_MODELS`' `chat`, else
   `AI_MODEL`, or the institute's choice among them — always a model the registry lists for the
   configured provider (ADR-0024). None is named in code. The router keeps its data-class approval,
   context limit, deadline, circuits and same-provider fallback; the provider abstraction is
   unchanged except that a request may now say its temperature, which Gemini receives in
   `generationConfig` (ADR-0025: no orchestration library).
9. **Prompt injection.** In layers, none of them trusted alone: data and instructions in separate
   channels; delimiters that text cannot close (decision 7); instructions that call the data data;
   and the check (decision 10), which withholds an answer that repeats the instructions or the
   reference code, leaves the evidence uncited, or cites what it was not given. The fake model used
   by the tests is deliberately obedient — told by a passage or the question to reveal its rules,
   change its role or set the evidence aside, it does — so the tests show the checks stopping the
   worst model, not a well-behaved one.
10. **The check** (`checkAnswer`, deterministic, in this order): empty; longer than 4,000
    characters; the reference code or a phrase of the instructions in it (`instruction_leak`); a
    credential (`protected_content`); `INSUFFICIENT_EVIDENCE` (a decline); the conflict marker; any
    citation-like mark (`[S9]`, `[Source 2]`, `[S]`) that is not exactly one of the evidence's
    identifiers (`unknown_citation`); no citation at all (`no_citation`); a sentence without one
    (`uncited_claim`); a conflict with fewer than two sources. A provider that withholds its answer
    (`blocked`) is a fault too. Not a fact-checker: whether a cited passage says what its sentence
    says is not judged in this phase.
11. **Citations** are the passages the answer cites, in order, each built from retrieval's result
    for that identifier — chunk, source and its name, document, version, title, heading path,
    position, course, lesson and similarity — never from the model's words. An identifier the
    evidence does not hold cannot become a citation: decision 10 refuses it first.
12. **Once more, then withheld.** An answer that fails the check is asked for once more, with a
    reminder of the rules in the system channel; a second failure is withheld (`not_grounded`,
    the platform's own words). A provider's failure is not retried here — the router has its own
    fallback.
13. **What a person is told**: `answered` (the checked text and its citations); `conflicting` — the
    platform's sentence that the knowledge disagrees, the model's sentences each citing its source,
    and advice to check with the course team or the authoritative source, without choosing between
    them; `insufficient_evidence` — "I couldn't find enough information in the available SI Academy
    knowledge to answer that reliably." — when no passage reached the floor or the model declined;
    `not_grounded` when the answer was withheld. There is no general-knowledge fallback.
14. **Streaming.** `stream: true` gives server-sent events from the same implementation as the JSON
    answer (ADR-0030's stream, with this route's events): anything refused before the evidence is
    chosen is an ordinary problem response, never a stream; `meta` (the context and the evidence
    counted) once the evidence is chosen and before any model is called; the answer only once
    checked — `delta`, `sources`, `notice` (a decline, a disagreement, an answer withheld), `usage`,
    `done`; a failure after `meta` is an `error` event, then `done` with `failed`. Unchecked text
    never reaches a reader, so the first `delta` comes when the whole answer has been checked.
15. **Bounds and failures.** The model's part within `AI_TIMEOUT_MS` × 2 + 5 seconds (the router's
    own deadline applies to each call); the work stops when the client goes (audited as
    cancelled). Failures in the answer's own words: `knowledge_answer_unavailable` (503: no model here, a
    provider unavailable, rate-limited or refusing the key or the model during the call, or no floor
    known); `knowledge_answer_timeout` (504); `knowledge_answer_failed` (502: the provider's answer
    could not be read, or the request was refused as too large); `ai_busy` (503: eight answers being
    written, or — the router's own answer, before any call — every model resting after repeated
    failures); retrieval's own codes for its own failures. Never the provider's message, status or
    diagnostics. Transient and permanent failures are told apart in the ledger (each call's
    outcome) and by the circuits, not in what the person reads.
16. **Usage.** Each call to the model is a row of the ledger — feature `knowledge`, task
    `rag_answer`: provider, model, fallback, outcome, latency, tokens, cost — counted as a question
    of the person's (their daily requests and tokens) and in the institute's budget; retrieval adds
    its own `retrieve` row. Never the question, a passage, the instructions or the answer.
17. **Audit.** One entry per answer asked for (`ai.knowledge.answer`, the person its actor): how it
    ended (`answered`, `conflicting`, `insufficient_evidence`, `not_grounded`, `refused`, `failed`,
    `cancelled`) and why (a code or fault); the course or lesson; passages retrieved and used; those
    withheld by reason; the evidence's size; attempts and their faults; the citation count and the
    documents cited; provider, model, instructions version; retrieval, generation and total time.
    Never the question, a passage, the answer, the instructions, the reference code or a key. This
    amends ADR-0028's item 4 for answers as ADR-0036 did for retrievals: an answer discloses stored
    knowledge to a person, which leaves an access record. One log line of numbers.
18. **No memory, no cache.** An answer is one question and its evidence: no conversation is stored
    or read, nothing about the person is remembered, and ADR-0036's expectation that 8E would answer
    "within a conversation" is not followed. Joining answers to Phase 7's conversations would store
    cited answers and their sources in conversation history — a retention decision of its own,
    left for later. Nor is an answer cached: the answer cache (ADR-0032) never sees one, so no
    change to the knowledge can leave a stale answer to invalidate; a cache would need the person's
    reach and the knowledge's state in its key, as ADR-0036 found for retrieval.
19. **Tested offline.** The fake provider answers a grounded request by itself: from each passage
    the sentence sharing most words with the question (two fifths of them at least), the best two,
    each with its citation; alike but for their numbers, a conflict; none, a decline; and obedient
    to planted instructions (decision 9). A scripted provider in the tests adds the failures (a
    fabricated or unknown citation, an uncited sentence, a leaked code, a credential, an answer too
    long, empty, blocked, unreadable, too slow, unavailable). No test reaches Gemini;
    `ai:rag-smoke -- --confirm` is the guarded live check for a developer with a key, on synthetic
    text only.

## Alternatives

- **A threshold chosen by eye** (0.5, 0.7): the brief rules it out, and the measured gap for the
  fake sits elsewhere; for Gemini only measurement can say.
- **A richer evidence policy** (score gaps, supporting passages, the kind of question): not needed
  while one floor separates the corpus cleanly; reconsidered with Gemini's measurements.
- **Streaming tokens as the model writes them**: a reader would see a fabricated citation, an
  uncited claim or leaked instructions before the check withholds them. Rejected: grounding before
  speed.
- **Trusting the model's citations, or taking provenance from its text**: rejected; citations come
  from retrieval's results.
- **A model judging another model's answer, or semantic fact-checking**: later, if at all;
  deterministic checks first.
- **More than one retry, or retrying a provider's failure**: the cost doubles for little; the router
  already falls back.
- **A second retrieval or a direct vector query for answers**: one authority on reach (ADR-0036).
- **LangChain or LangGraph**: ADR-0025.
- **A new permission for answers** (`ai:rag`): it would let a role answer from knowledge it cannot
  retrieve; `ai:chat` and the reach rule already say who may draw on what.
- **Personal knowledge for answers**: it needs a decision on whose personal data may be drawn on for
  whom; deferred.

## Consequences

- Answers under Gemini wait for the floor's calibration (`AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY`) and
  a live check with a developer's key — an external verification gate; under the fake everything
  runs offline.
- An answer costs one retrieval (its embedding) and one or two model calls; each leaves its ledger
  rows, and every answer two audit entries (the retrieval's and the answer's).
- `ai.knowledge_answers` reaches an installation with the base seed (`pnpm db:seed`), off.
- The first `delta` of a streamed answer arrives with the checked answer: about the time of the
  whole answer.
- Answers are single questions: no follow-up draws on an earlier answer until conversations take
  them in.
- **8F record (5 October 2026; Phase 8 closure).** The check gains a support test for each cited
  sentence (`answers/support.ts`): every number it states appears in its cited passages, and at
  least half of its content words do; otherwise `unsupported_citation` — once more, then
  withheld. Measured on 14 synthetic sentences of known truth it caught 6 of 9 unsupported and
  accepted 4 of 5 supported ones; it cannot read meaning (a related passage, a partial claim, a
  negation in the passage's words pass; a paraphrase in other words fails), and its threshold is
  confirmed on Gemini at the external gate. The evidence's credential scan reads the source's
  name and the document's title as well as the heading and the text.
- **Gemini calibration record (5 October 2026; after the Phase 8 closure).** The evidence floor for
  `gemini-embedding-001` at 768 dimensions was measured through the API on the 8E answer corpus and
  the 8D retrieval corpus, with real vectors and without the corpora's shared word: the closest
  passage of 34 questions the knowledge answers lay between 0.733 and 0.868, of 20 it cannot
  between 0.472 and 0.685. The middle of that gap, rounded up towards refusing, is **0.71**: set as
  `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY=0.71` wherever Gemini embeds (it is configuration, not a
  built-in floor: re-measured when the embedding model or the corpus changes materially). The 8E
  evaluation on `gemini-3.5-flash` at 0.71 ended as allowed for 30 of 30 questions — no question
  answered that should have been refused, none refused that should have been answered, 21 of 21
  citations valid, nothing unauthorised, protected or planted shown — and no answer of Gemini's was
  refused by the support check, which confirms its threshold on Gemini's wording.
