# Phase 8 — completion report (slice 8F: hardening and closure)

| Field  | Value                                                                                                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | **Technically complete; not production-ready** — slices 8A to 8E approved, slice 8F built on 5 October 2026 and awaiting the client's gate review. Production waits on the external gate and the blockers below; Phase 9 has not started |
| Brief  | The client's Phase 8F brief (5 October 2026): "AI knowledge / RAG production hardening and Phase 8 closure"                                                                                                                              |
| Plan   | `docs/phases/PHASE-08-rag-knowledge.md` (slices, items, matrices); the progress log, session 40                                                                                                                                          |
| ADRs   | ADR-0033 (knowledge base), ADR-0034 (ingestion and chunking), ADR-0035 (embeddings), ADR-0036 (retrieval), ADR-0037 (grounded answers), each with its 8F record; ADR-0024, 0025, 0028 to 0031 (the Phase 7 rules Phase 8 keeps)          |

## 1. The four answers, kept apart

| Question                             | Answer                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is Phase 8 **technically complete**? | **TECHNICALLY COMPLETE.** Every slice's items are built and tested; the closure audit's findings that mattered are fixed (section 4); the regression passes (section 13) |
| Is it **verified**?                  | **VERIFIED with the fake provider only.** Every guarantee is proved by tests offline; nothing was verified against Gemini                                                |
| Is it **production-ready**?          | **NOT PRODUCTION READY.** One **EXTERNAL GATE** (real Gemini) and the **BLOCKERS** in section 2 stand between it and production                                          |
| What remains for the product?        | **DEFERRED** items, classified in section 14: before production (A), before a large-scale knowledge rollout (B), future product capabilities (C)                         |

## 2. External gates and production blockers

**EXTERNAL GATE — real Gemini (pending).** No developer key was configured on 5 October 2026, so no
call reached Gemini in any phase. Until a developer runs the steps in the runbook ("Gemini: the
external verification") the platform has not seen Gemini embed a chunk or a question, answer from
evidence, cite, decline, or fail. Answers under a Gemini embedding contract are refused (503) until
the evidence floor is set from Gemini's own measurements — by design, not by accident.

**BLOCKERS for production** (each an item in register A):

1. Real Gemini verified: `ai:embed-smoke` and `ai:rag-smoke` with a key (section 7).
2. Gemini's evidence floor measured and `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` set (section 8); the
   citation support threshold confirmed on Gemini's answers (section 9).
3. Prices for the Gemini models in `AI_MODEL_COSTS` if a monthly budget is to apply (section 11).
4. One answer at a time and the eight-at-once bound are held per API process; a deployment with more
   than one API replica needs them enforced across processes first (section 10).

None of these is a security defect: each is a verification or a production configuration the
platform cannot supply itself.

## 3. The architecture, end to end

```text
source (draft → published → archived; audience, data class)      ADR-0033
  → document → version (normalised, hashed, stored privately; no credential, 8F)      ADR-0033/34
  → ingestion job (claimed, leased, bounded read, hash verified, parsed, chunked)    ADR-0034
  → embedding job (contract; claimed, leased, fenced; batched through the router)     ADR-0035
  → vectors (pgvector, HNSW cosine, kept in their rows)                              ADR-0035/36
  → retrieval (flags, timed test 8F, context, credential, data class, quota; the reach rule
     resolved on the server; every rule a condition before ranking; provenance)       ADR-0036
  → evidence (floor per embedding model; data class; credential in any part 8F; bounds)  ADR-0037
  → the chat task's model through the router (instructions apart from data)          ADR-0037
  → the check (leaks, credentials, citations, every sentence cited, support 8F)       ADR-0037
  → citations from retrieval's results → the answer, JSON or a checked stream
  → ledger (embed, retrieve, rag_answer) · audit (ids, counts, codes) · logs (numbers)
```

Every boundary was read again in 8F (section 4); the joints between them are proved end to end by
the lifecycle spec (section 5).

## 4. The closure audit

Two read-only audits covered 8A–8B (knowledge, ingestion) and 8C–8E (embedding, retrieval, answers)
against ten categories: bypasses, duplicate implementations, inconsistent authorisation, stale
state, version handling, failure states, unbounded operations, secret leakage, logging and races.
Each finding was verified before it was acted on.

**Fixed in 8F** (each with a test, and each among the deliberate breaks of section 12):

| Finding (verified)                                                                                                                                                | Severity   | Fix                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /ai/knowledge/retrieve` ran during a timed test — ADR-0031: "No AI on any surface while an attempt is open"; answers checked it, retrieval did not          | Blocker    | Retrieval refuses (403 `ai_not_allowed`) before anything is embedded, audited as refused (`timed_test`)                                                                                |
| A paragraph of 200,000 closing brackets kept the sentence split busy for more than 40 seconds (a look-behind tried at every position: quadratic)                  | Blocker    | The split matches whitespace first and looks behind from it: the same breaks (identical on 50,023 fuzzed and corpus texts), in linear time — 12 ms for that paragraph                  |
| A code fence, a language name or a list nesting wider than a chunk left no room for a part: the cut looped, burning 4 to 6 seconds and much memory before failing | Should-fix | A part with no room fails at once (`chunking_failed`, in milliseconds); a one-place cut that would split a surrogate pair takes the whole character                                    |
| A credential in knowledge content was stored, embedded (sent to the embedding provider) and returned by retrieval; only answers withheld it                       | Should-fix | A version holding a credential is refused when it is created (422 `ai_restricted_content`): nothing is stored. The evidence scans the source's name, the title and the heading as well |
| A change of audience, course or data class read the source as a draft, then wrote it unconditionally — a publication in between was overwritten                   | Should-fix | The write holds only while the source is in the state it was read in (a draft for those fields); otherwise 409. Archiving holds only once                                              |

**Recorded, not changed** (no security consequence; each in the deferred register):

- A version can stay `processing`, or an embedding run `embedding`, after a crash on the last
  attempt, until its 10-minute lease lapses and a manager asks again; no sweeper re-queues it.
- A failed state write is swallowed, and an ingestion failure's log line has its code and stage but
  not the error's class.
- Two versions added at the same moment can collide on the version number and be told "duplicate".
- A table header wider than a chunk is dropped when the table has body rows (changing it changes the
  chunker's output: it waits for a new chunker version).
- Some refusals before any work (the flags) and a client leaving during retrieval are not audited as
  ADR-0036/0037 describe (the flags' refusal is not audited; the leaving is recorded as failed).
- Vectors written by a batch that commits while its source is archived can be left behind: never
  ranked (the search's own conditions), never purged.
- Flags and AI settings belong to the installation (one institute per installation, ADR-0036); every
  knowledge query is scoped by the person's institute.

## 5. Knowledge lifecycle, idempotency, failure and recovery

`test/ai-knowledge-lifecycle.e2e-spec.ts` lives a source's whole life through the API: created as a
draft; its document versioned; ingestion **failing** while the stored text is missing
(`missing_file`, nothing chunked) and **recovering** once it is back; published; embedding
**failing** while the provider is down (`provider_unavailable`) and **resuming**; retrieved and
answered from version 1; version 2 chunked and current while version 1 keeps its vectors — and
version 1 is **never drawn on meanwhile**; version 2 embedded, version 1's vectors deleted, the answer
version 2's; archived, its vectors gone and nothing of it drawn on. Asked or run again, each step
does nothing more: ingestion refused (`knowledge_version_chunked`) or skipped (`already_chunked`),
embedding refused (`knowledge_version_embedded`) or skipped twice at once; two ingestions and two
embeddings of one version at once — one does the work, the other finds it taken; one vector per
chunk, always.

Failures and recovery proved elsewhere and kept: the provider unavailable, rate-limited (429),
refusing the key, unreadable, empty, withheld, too slow (the deadline) — each in the answer's own
words, nothing of the provider's; a database statement past its timeout (8D); a lease taken over
after it lapsed (8B, 8C); a client gone mid-answer (the work stops, audited as cancelled) and a
**stream abandoned mid-way** over a real socket: the answer stops, is audited, and the person may ask
again at once (8F). Generation is retried once, never more; a provider's failure is not retried by
the answer. No job retries forever: the queue's retries are bounded and transient failures alone go
back to it.

## 6. Observability, usage and storage

**Logs** (the lifecycle spec captures every logger call through a whole life): one line per
ingestion (`Knowledge version ingested` / `not ingested` with the version, chunks or code and stage),
per embedding (`embedded` / `not embedded` with batches and whether the failure may pass), per
retrieval (`Knowledge retrieved`: results, candidates, embedding and search milliseconds) and per
answer (`Knowledge answered`: status, counts, attempts, retrieval and generation milliseconds); the
router logs each provider call with its outcome; rate limits answer 429 and are logged by the
request logger. None holds the knowledge's text, a question, an answer, the instructions or a key —
proved over the whole life.

**Usage.** Each provider call is a ledger row (`ai_requests`): embedding (`knowledge`/`embed`, the
institute's work, counted in its budget, not a person's allowance), retrieval (`knowledge`/
`retrieve`, the person's tokens and the budget) and answers (`knowledge`/`rag_answer`, a question of
the person's, their tokens and the budget). The institute's monthly budget applies to all three once
the models are priced; Gemini's prices are not configured (`AI_MODEL_COSTS`) and are not invented —
with a budget set, an unpriced model is refused (fails closed). Daily questions, daily tokens, 20
answers and 30 retrievals in five minutes per person, one answer at a time each and eight at once per
process are the limits; the load test holds them under concurrency (section 10).

**Storage.** The knowledge tables keep what was published to them: sources' metadata, documents,
versions (their text in private object storage), chunks and vectors. Since 8F no version can hold a
credential. The ledger's only text columns are names from fixed vocabularies (feature, task, data
class, provider, model, outcome, request id) — proved by the schema itself; the audit holds ids,
counts and codes; the institute's AI settings hold choices, never a key. No prompt, answer or
conversation is stored by Phase 8, and keys live in the environment alone.

## 7. Gemini verification — EXTERNAL VERIFICATION PENDING

No key was configured (`AI_PROVIDER`, `GEMINI_API_KEY`, `AI_MODEL` unset in `apps/api/.env` and the
environment). `ai:rag-smoke` without a key prints `NOT CONFIGURED — nothing was called` and exits 0;
with a key and no `--confirm` it refuses. The verification steps are in the runbook ("Gemini: the
external verification"): the embedding check, the grounded-answer check with `--calibrate`, the
floor, the support threshold, prices, and the evaluation on the institute's own corpus. Nothing in
this report claims Gemini works.

## 8. Gemini similarity calibration — DEFERRED to the external gate

Not performed: no Gemini embedding exists to measure. The fake's floor (0.40, from 0.298 and 0.495
measured in 8E) is **not** reused for Gemini. `AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY` stays unset, and
answers under `gemini-embedding-001` are refused (503 `knowledge_answer_unavailable`) until it is set
from Gemini's relevant and irrelevant score distributions — the method of 8E's calibration, on
Gemini's vectors.

## 9. Citation semantic validation

**What 8F adds.** Beyond "every citation is one of the evidence's and every sentence cites one"
(8E), each cited sentence must be supported by its cited passages as far as words can show
(`answers/support.ts`): every number it states appears in them (numbers written as words count), and
at least half of its content words do (stemmed; common words aside). A sentence that fails is a new
fault, `unsupported_citation`: the answer is asked for once more, then withheld. Deterministic, no
second model.

**Measured** on a synthetic evaluation of 14 sentences whose truth is known (`support.spec.ts`):

| Kind                                                  | Truth       | Check        | Word share / numbers |
| ----------------------------------------------------- | ----------- | ------------ | -------------------- |
| correct, the passage's words                          | supported   | accepted     | 1.00                 |
| correct, paraphrased with its key words               | supported   | accepted     | 0.90                 |
| correct, a number the passage writes in words         | supported   | accepted     | 1.00                 |
| multi-source claim citing both passages               | supported   | accepted     | 0.92                 |
| correct, paraphrased in other words                   | supported   | **refused**  | 0.00                 |
| irrelevant citation                                   | unsupported | refused      | 0.00                 |
| citation to the wrong passage, another topic          | unsupported | refused      | 0.00                 |
| citation to the wrong passage, a related topic        | unsupported | **accepted** | 0.50                 |
| a figure the passage does not give                    | unsupported | refused      | 1.00, 60 missing     |
| partially supporting, no number                       | unsupported | **accepted** | 0.67                 |
| partially supporting, with a number                   | unsupported | refused      | 0.57, 20 missing     |
| unsupported claim on the passage's topic              | unsupported | refused      | 0.33                 |
| unsupported claim in the passage's own words, negated | unsupported | **accepted** | 1.00                 |
| multi-source claim citing one of its passages         | unsupported | refused      | 0.45                 |

Unsupported citations caught: **6 of 9**; supported ones accepted: **4 of 5**. The fake's grounded
answers (its sentences are the passages') all pass; end to end, an off-topic citation of a real
passage and a changed figure are withheld (`unsupported_citation`, twice).

**Limitation, recorded honestly.** The check cannot read meaning: a related passage cited instead of
the right one, a claim only partly supported, and a negation in the passage's own words pass it; a
faithful paraphrase in entirely other words fails it. Reliable semantic validation (entailment, or a
second model judging) is **not** implemented — it is a register B item, and its threshold, like the
evidence floor, must be confirmed on Gemini's real answers at the external gate.

## 10. Load and concurrency (bounded, synthetic, the test database)

`test/ai-knowledge-load.e2e-spec.ts`, on one development machine with the fake model:

| Test                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 50 retrievals at once: 8 learners in two courses (40, over HTTP) and 2 learners of a second institute (10, through the service) | Every one served (no connection ran out, nothing failed); 90 results checked against the reach rule, every one reachable by its asker; a course's learners never given the other course's passage, nobody given the other institute's, the second institute's learners only their own. Each retrieval took 1.85 s at the median and 1.88 s at most while all 50 queued on the database pool; the process grew by 11 MB |
| 12 answers at once, 12 people (the model taking 400 ms)                                                                         | 8 served, 4 told `ai_busy` (503); never more than 8 calls with the model at once; every answer the asker's own, cited from what they may draw on                                                                                                                                                                                                                                                                       |
| One person asking 5 times at once                                                                                               | 1 served, 4 told `ai_generation_in_progress` (409)                                                                                                                                                                                                                                                                                                                                                                     |
| 12 answers at once through the service itself                                                                                   | Never more than 8 at once                                                                                                                                                                                                                                                                                                                                                                                              |
| 35 retrievals at once by one person                                                                                             | 30 served, 5 refused `rate_limited` (429): the limit of 30 in five minutes, exact under a burst                                                                                                                                                                                                                                                                                                                        |
| Jobs                                                                                                                            | Two ingestions and two embeddings of one version at once: one did the work, the other found it taken; one vector per chunk (the lifecycle spec)                                                                                                                                                                                                                                                                        |

Not a production benchmark: one machine, the fake model, the test database. The retrievals' time
under a burst is the database pool's queue, not the search (a single retrieval takes about 57 ms,
8E); production-scale load stays a register B item.

**Multi-process limits.** The API runs as one Node process per replica, with the job worker in the
same process (`WORKER_MODE=embedded`; `none` runs jobs inline). Process-local today: one answer at a
time per person and eight answers at once (in memory), the rate limiter's counters (ADR-0006) and the
model circuits. With one replica — local and the staging compose file — they hold. With more
replicas each would hold per process (a person could run one answer per replica; eight at once
becomes eight per replica). Phase 7's conversations already hold one answer at a time in the
database; grounded answers would need the same, or a shared store, before more than one replica runs.
Redis is not introduced for it (register A, item 4).

## 11. Cost

Prices: `fake-1` and `fake-embedding-2` are priced in the tests; Gemini's prices are not configured
and not invented. With a monthly budget set, any unpriced model is refused, so a budget cannot be
silently bypassed; without one, usage is recorded in tokens and counts.

## 12. Deliberate breaks

Thirty-seven rules were broken on purpose on the final, formatted code — 8E's 29 run again (their
patterns as 8F left the code) and 8F's 8 — each against the knowledge unit specs and the end-to-end
specs aimed at it (the answers spec; with the evaluation for the reach and evidence breaks; with the
lifecycle spec for 8F's own), and every file restored byte for byte, every code file's SHA-256 the
same after the run as before it: **37 of 37 caught**.

- 8E's, again: retrieval authorisation; the data-class check; a credential's passage sent; the
  no-evidence refusal; uncited claims; a fabricated citation; an unknown citation dropped quietly; the
  question in the system channel; passages not neutralised; the instruction-leak check; the
  credential check on answers; personal knowledge retrievable; staff material for learners; the
  institute scope; citation validation; the evidence's bounds; 25 attempts; the answer's own
  allowance check; the flag; the provider's error passed through; the question and the answer in the
  audit; the stream opened before retrieval; no evidence floor; two answers at once; help during a
  timed test; no usage recorded; the permission; a forged block out of the question.
- 8F's: no citation support check; a figure the cited passages do not give accepted; any share of a
  sentence's words taken as support; retrieval during a timed test; a credential stored; a source
  written over a publication it did not see; a source archived twice; the evidence's credential scan
  blind to names and titles.

Two fixes are proved by measurement rather than a break, because restoring them would hold the test
process itself (and, for the cut, gigabytes of memory on this machine): the old sentence split took
more than 40 seconds and the old cut 4 to 6 seconds on the inputs the unit test times, which allows
2 seconds and 1 second. The suite was stopped once, mid-break, to run faster (the unit specs first;
the end-to-end run skipped when they had already caught the break): the file under change was
restored by hand and every file checked against the fingerprint before it resumed.

## 13. API, database and regression

**API and OpenAPI.** Phase 8 has fourteen routes under `/api/v1/ai/knowledge`: the status; sources
(list, create, read, change, publish, archive); documents; versions (create, read); ingestion;
embedding; retrieval; answers. Each has a permission (`ai:knowledge_manage` for the twelve
management routes, `ai:chat` for retrieval and answers), sits behind `module.ai` (the module scope)
and `ai.knowledge` (and `ai.knowledge_answers` for answers), takes a strict schema (an unknown field
is refused, 400), and answers its errors as problem documents with the platform's own codes. All
fourteen are in the OpenAPI document — none undocumented — and since 8F every one declares its
cookie authentication: the twelve management routes did not (they required a session, as a live
call without one shows, 401, but the document did not say so). The regenerated document differs
from 8E's in those eleven paths alone: the management operations' authentication, version creation's
201 and 422 (`ai_restricted_content`), and retrieval's 403 (`ai_not_allowed`); no path added or
removed, no schema changed, the answer route unchanged.

**Databases.** `lms` and `lms_preview`: 19 migrations each, "Database schema is up to date!"; the
schema diff from either to `schema.prisma` is the one known line,
`DROP INDEX "knowledge_chunk_embeddings_embedding_hnsw_idx"` (Prisma cannot describe the HNSW index;
never apply it). No migration in 8E or 8F. Both hold no knowledge yet (no source, version, chunk or
vector), so no vector can be stale, no current version unchunked, no document current twice, nothing
`processing` or `embedding`, no vector of an archived source; 72 users each. The flag
`ai.knowledge_answers` is in `lms_preview` and not yet in `lms`: the module registry adds a missing
flag (off, never changing a setting) whenever the API starts, as it did on `lms_preview` for the 8E
OpenAPI run — 8E's record that `lms_preview` was only read missed that.

**Regression.** Type-check 9/9 and lint 9/9, one task at a time; formatting clean on every tracked
and new file (1,250); production builds 6/6 (the web app's 97 pages); unit tests 676 — API 436 (6
new: the support check 3, the answer check 1, the evidence 1, the ingestion pipeline 1), shared 159,
web 65, runner 16; the full API end-to-end suite **51 files, 638 tests, all 638 passing** (630
before; 8 new: the answers spec 1, the lifecycle spec 4, the load spec 3). The first full run failed
one test of Phase 7C's conversation stream, not one of Phase 8's: it forbade "503" anywhere in a
failed answer's stream, and that run's message id held "…-4503-…"; it now looks for a status
standing alone, and the second run passed whole. 37 of 37 deliberate breaks; the OpenAPI document
regenerated; the schema verified on both databases.

## 14. Deferred-items register (final for Phase 8)

**A. Must complete before production**

| Item                                                                 | Why                                                                                   | Where it stands                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Real Gemini verification                                             | No call has reached Gemini in any phase                                               | External gate; runbook steps ready; scripts guarded                 |
| Gemini similarity calibration (`AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY`) | Answers under Gemini are refused until it is set                                      | External gate; method in 8E's calibration                           |
| Citation support threshold confirmed on Gemini                       | Measured on synthetic sentences only; Gemini's paraphrasing may be refused more often | External gate; `SUPPORT_MIN_WORD_SHARE` (0.5)                       |
| Gemini prices in `AI_MODEL_COSTS` (if a budget applies)              | An unpriced model is refused under a budget (fails closed)                            | Institute's own billing; never invented                             |
| Cross-process limits before a second API replica                     | One answer at a time and eight at once are per process                                | Single replica today; the conversations' database gate is the model |

**B. Should complete before a large-scale knowledge rollout**

| Item                                                                                        | Notes                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF (and Word, PowerPoint) extraction — **if** uploaded lesson resources are to be drawn on | The authored corpus (lessons, descriptions, problem statements, trainer knowledge) is HTML or Markdown and is read today; the `lesson-resource` upload context accepts PDF, DOCX and PPTX (25 MB) — those need an extraction engine, ADR-0034 |
| Semantic citation validation (entailment or a judging model)                                | The lexical support check's limits (section 9)                                                                                                                                                                                                |
| Production-scale load: the reach rule and retrieval with many people and real volumes       | Measured to 100,000 synthetic vectors (8D) and 50 concurrent retrievals (8F) on one machine                                                                                                                                                   |
| Retrieval measured with Gemini                                                              | Measured with the lexical fake                                                                                                                                                                                                                |
| A sweeper for versions left `processing` and runs left `embedding` after a crash            | Today a manager asks again after the 10-minute lease                                                                                                                                                                                          |
| Diagnostics: the error class of an ingestion or embedding failure in its log line           | Codes and stages are logged today                                                                                                                                                                                                             |
| Audit entries for flag refusals and a client leaving during retrieval                       | ADR-0036/0037 promise one entry per request; these two are not yet audited as described                                                                                                                                                       |
| A version-number collision told "duplicate"                                                 | Two versions added at the same moment                                                                                                                                                                                                         |
| The answer's limits tuned on Gemini (temperature, tokens, passages, characters)             | Chosen with the fake                                                                                                                                                                                                                          |
| Automatic and bulk embedding                                                                | A version is asked for; a new contract version by version                                                                                                                                                                                     |
| Prisma and the HNSW index                                                                   | Raw SQL; a schema diff shows its `DROP INDEX`, never to be applied                                                                                                                                                                            |
| CI's database image from a registry                                                         | Built on each run                                                                                                                                                                                                                             |

**C. Future product capabilities**

| Item                                                      | Notes                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Automatic course-material ingestion                       | Manual, administrator-triggered ingestion serves a curated corpus; the architecture it needs is in section 15 |
| Personal knowledge                                        | Held back everywhere; needs a decision on whose personal data may be drawn on for whom                        |
| Topic, skill, batch and role audiences                    | Not in the model; a migration                                                                                 |
| Knowledge purging                                         | Archiving withdraws and deletes vectors; nothing deletes knowledge                                            |
| Re-chunking under a new chunker version (and its tooling) | Also where the dropped wide table header is corrected                                                         |
| OCR                                                       | With PDF extraction, for scanned material                                                                     |
| Answers in conversations; a page for answers              | Single questions through the API today                                                                        |
| A retrieval or answer cache                               | Only with a measured need, every scope in its key                                                             |

## 15. Decisions

**PDF support — deferred (register B), not a production blocker.** The intended corpus
(AI_ARCHITECTURE §4) is course descriptions, lessons and notes, documentation, the visible part of
assignment problem statements, approved learning resources and trainer-created knowledge. All but
the uploaded resources are authored in the LMS as HTML or Markdown, which ingestion reads today. PDF
(and DOCX, PPTX) appear only as uploaded lesson resources; drawing on those needs a text extraction
engine (ADR-0034 records none). No PDF parser is faked. It becomes a blocker the day the client
decides uploaded resources must be answerable.

**Automatic course-material ingestion — deferred (register C).** Administrator-triggered ingestion
is sufficient for the current plan: a curated corpus, published deliberately. When the product needs
it, the architecture is: an event for each lesson's or course's publication, change and withdrawal
(an outbox written in the same transaction as the change, so none is lost); one knowledge document
per lesson (`canonicalRef` `lesson:<id>`) bound to its lesson, so the reach rule's lesson gate holds;
each change a new version only when its normalised content's hash differs (idempotent by content);
the existing ingestion and embedding jobs, with their leases, fencing and bounded retries; a
withdrawal archives or retires the document; a reconciliation sweep compares published lessons with
their documents and repairs what an event missed; embedding bounded by the institute's budget.

## 16. Out of scope, and kept out

No Phase 9 work: no agent, tool calling, web search or crawling, long-term or learner memory, mock
interview, AI evaluation engine, Redis, LangChain, LangGraph or AWS.
