# ADR-0036 — Access-controlled knowledge retrieval

- **Status**: proposed (built in Roadmap Phase 8D on 4 October 2026); accepted when the client
  approves slice 8D
- **Date**: 2026-10-04
- **Phase**: Roadmap Phase 8 (RAG knowledge system), slice 8D
- **Builds on**: ADR-0033 (the knowledge base and its reach rule), ADR-0035 (embeddings and the
  embedding contract), ADR-0024 (providers and data classes), ADR-0025 (the model router), ADR-0029
  (usage, quotas and budgets), ADR-0031 (where AI is allowed)
- **Amends**: ADR-0028, item 4 (what the audit log records), for retrievals

## Context

Phase 8C keeps a vector for each chunk of what may be drawn on. Phase 8D turns a person's question
into the passages they may draw on, best first, with enough provenance for Phase 8E to cite them.
The property that matters above all: a passage the person may not draw on must never be returned,
however close it is to the question — and must never take the place of one they may, as it would
if the search ranked everything and the application filtered the top afterwards.

## Decision

1. **The route.** `POST /ai/knowledge/retrieve` (200), for `ai:chat` — "ask SI Academy AI, within
   what you may already see", which every role holds — while `module.ai` and `ai.knowledge` are on;
   at most 30 times in five minutes per person. No new permission and no new flag: the knowledge
   base's own switch covers drawing on it, and Phase 8E's answers will have a flag of their own.
2. **The request** names a question (3 to 1,000 characters, trimmed), how many passages (1 to 20,
   5 by default), and, optionally, the course or lesson it is asked from. Nothing else: the schema
   is strict, so a request that names an institute, data classes, publication, archived material,
   versions, a model, a vector or a filter is refused (400).
3. **The scope is the server's.** `KnowledgeReachService.reachOf` (ADR-0033) — the person's
   institute; published sources; public and course data; the audiences that include them (the
   institute; staff alone for staff; a course they reach, as a learner enrolled or a trainer whose
   batch it was published to); no document about a lesson they cannot open now — resolved for each
   request, every such lesson asked about at once (`LessonsService.openLessonIds`, the lesson
   player's own rule walked once per course: one lesson at a time cost about 15 milliseconds a
   lesson, 3 seconds for 200). A course given as context must be one they reach, a lesson one they can open, as the
   course and the lesson player decide (403 `knowledge_retrieval_forbidden` otherwise, whether it
   exists or not). Context only narrows: from a course, course material of that course alone,
   beside the institute's and staff's; from a lesson, of its course's lesson documents, that
   lesson's alone.
4. **The question as a vector.** Classified as the gateway classifies a question (ADR-0024): a
   credential is refused (422) and never sent; a question asked from a course or lesson is course
   data, any other public; refused (403 `ai_data_not_approved`) when the provider may not be given
   it. Embedded through the model router with the purpose `query` — `RETRIEVAL_QUERY` for Gemini —
   under the active embedding contract, the stored vectors' own provider, model, dimension and
   embedding version, and checked by the router like every vector (one, of the dimension, finite,
   at unit length). The person's allowance and the institute's budget are checked first; with a
   budget set, the embedding model needs a price.
5. **The search** (`KnowledgeVectorSearch`) is one transaction with one snapshot (repeatable
   read), in which every rule is a condition on the rows before they are ranked, so nothing is
   filtered afterwards:
   - **what may be ranked, now** — the database finds, from the scope, the sources that are
     published and of a retrievable data class (and, asked from a course, that course's or none);
     the documents to leave out (inactive, about a lesson the person cannot open, or, asked from a
     lesson, about another one); and the versions to leave out (any not current and fully chunked
     that still has vectors);
   - **the ranking**, on the vectors' table alone — the institute, the active contract, those
     sources, none of those documents or versions — by cosine distance; each candidate is then
     joined to its chunk, and kept only while its hash is its chunk's, and to its provenance.

   Ranking on the vectors' own columns lets the planner see what the scope holds. A broad scope is
   ordered by the HNSW index with pgvector's iterative scan — `hnsw.iterative_scan` set to
   `relaxed_order`, and `hnsw.ef_search` to at least the candidates asked for — so that filtering
   cannot starve it, and the candidates are sorted again by distance; a narrow scope is ranked
   exactly from the (institute, source) index. A first design ranked with every table joined in
   one statement: the planner misjudged the joins and ranked every vector exactly, 1.6 seconds at
   50,000 vectors against about 21 milliseconds once ranked on the vectors alone (Phase 8 plan,
   Performance). The candidates are ordered by distance, then chunk id, for a deterministic order,
   and each statement is bounded by `statement_timeout` within the retrieval's deadline.

6. **Selection.** The search returns four candidates per passage asked for (at most 100); then a
   chunk once, a text once (the same content hash in two documents gives one passage, the
   better-ranked), at most two passages of one document, and the first K. It only orders and thins
   what the search allowed; it never widens it.
7. **The result** for each passage: the chunk (id, position, heading — its section's path —
   content, content hash), its similarity (1 − cosine distance, six places), its source (id, name,
   audience, course, data class), document (id, title, reference, lesson) and version (id, number,
   parser and chunker versions); and the context drawn for. Never a vector, a distance, a model or
   a database detail.
8. **Bounds and failures.** The whole retrieval within 10 seconds (the router's own deadline
   applies to the embedding too), and stopped when the client goes. Failures in the retrieval's own
   words: `knowledge_retrieval_unavailable` (503: nothing can embed a question here, or the
   provider cannot now), `knowledge_retrieval_timeout` (504), `knowledge_retrieval_failed` (502: the
   provider's answer is not a usable vector; 500: the search failed); never SQL, Prisma, a stack or
   the provider's words.
9. **No cache.** A retrieval's answer depends on the person's reach and on the knowledge's state
   at that moment; a shared cache would need every dimension of both in its key, and a stale entry
   would outlive a revoked grant. None is built, and no question vector is cached either.
10. **Usage.** The question's embedding is a call like any other in the ledger (feature
    `knowledge`, task `retrieve`): provider, model, outcome, latency, tokens and cost — never the
    question or a passage. It is the person's own use, so it counts in their daily allowance (the
    institute's embedding work does not, ADR-0035) and in the institute's budget.
11. **Audit.** One entry per retrieval (`ai.knowledge.retrieval`, the person its actor): succeeded,
    refused (with the reason) or failed (with the code); K; the course or lesson asked from; the
    result count, candidates, the documents drawn on, the duration and the contract. Never the
    question — not even its hash, which a short question's guessable words would reverse — a
    passage or a vector. This amends ADR-0028's item 4 for retrievals: an answer is a call, which
    the ledger records; a retrieval discloses stored institutional knowledge to a person, which
    leaves an access record.
12. **The fake embeds by words** (`fake-embedding-2`): words in common make vectors close, so
    retrieval is tested and measured offline. Not meaning — synonyms are not close — so Gemini's
    quality is measured once a key is configured.
13. **Personal knowledge stays out** until Phase 8E weighs it against the institute's approvals;
    restricted material never enters the knowledge base.
14. **Each vector kept in its row; no new index.** A vector of 768 dimensions is 3,080 bytes, and
    pgvector stores it EXTERNAL: above PostgreSQL's 2 KB threshold each one was moved out of its
    row into the TOAST table, and an exact ranking read every vector back from there — at 10,000
    vectors a broad scope took about 240 milliseconds. The 8D migration sets
    `toast_tuple_target = 8160` on the vectors' table, so rows up to a page's limit stay whole, two
    to a page: the same exact ranking takes about 18 milliseconds, and the planner, seeing the
    table's true size, now orders that scope by the HNSW index in about 15. It applies to rows
    written from then on — older ones move into their rows when re-embedded or when the table is
    rewritten (runbook) — and a vector too large for a page would still be stored out of line,
    not refused. No index was added: the joins are on primary keys, the exact ranking uses the
    (institute, source) index, and the HNSW index orders broad scopes (Phase 8 plan,
    Performance).

## Alternatives

- **Ranking everything, then filtering in the application**: an unauthorised passage would take a
  place in the top K, or drop an authorised one out of it. Rejected by the brief and by this ADR.
- **The audience rules written again in SQL**: a second copy of the reach rule to keep in step. The
  scope reuses `reachOf`; the search adds the state conditions it must hold at the moment of
  search.
- **One statement joining every table to rank**: correct, but the planner ranked every vector
  exactly (decision 5).
- **Forcing the index with planner switches** (`enable_sort = off`): it used the index but chose
  sequential joins, and a planner switch hides the cost model rather than giving it the facts.
- **A partial HNSW index per institute or audience**: one institute per installation; iterative
  scanning keeps filtered searches full.
- **`SET STORAGE PLAIN` on the vector column**: it also keeps vectors in their rows, but the rows
  stay above PostgreSQL's toast target, so the next largest value — the content hash — was moved
  out of line instead, and a vector too large for a page would be refused.
- **More B-tree indexes** (the contract's columns, documents, versions): every vector of an
  institute shares the contract, so they would narrow nothing; the (institute, source) index
  already narrows a scope, and the documents and versions left out are few.
- **A new permission or flag for retrieval**: `ai:chat` and `ai.knowledge` already say it.
- **Caching results or question vectors**: see decision 9.
- **Returning the vectors or distances**: nothing would use them, and vectors are never exported.

## Consequences

- Phase 8E answers from `KnowledgeRetrievalService` within a conversation, cites from the result's
  provenance, and decides which passages it may send to the provider by their data class.
- Gemini's similarities differ from the fake's: a minimum similarity for answers, if any, is
  calibrated with real embeddings in 8E.
- Every retrieval leaves one audit entry and one ledger row.
- The reach rule asks about a person's lessons at once on each request: about 30 milliseconds
  with 200 lesson documents (Phase 8 plan, Performance). Its load testing with many people at once
  stays a deferred item.
- Vectors written before the 8D migration stay out of line until re-embedded or the table is
  rewritten; on 4 October 2026 `lms` and `lms_preview` held none.
- Performance is measured to 100,000 synthetic vectors on one development machine (Phase 8 plan,
  Performance); real volumes, Gemini's vectors and many people at once are measured later, with
  Phase 12.
- **8E record (4 October 2026; ADR-0037).** Grounded answers call `retrieve` unchanged, for
  eight passages, and build their citations from its results; nothing else reads the knowledge
  base. They are single questions, not answers within a conversation (ADR-0037, decision 18).
  The minimum similarity is calibrated per embedding model: 0.40 for the fake, measured on the
  8E evaluation corpus; for Gemini none until it is measured with a key
  (`AI_KNOWLEDGE_ANSWER_MIN_SIMILARITY`), and answers are refused meanwhile. Personal knowledge
  stays out.
