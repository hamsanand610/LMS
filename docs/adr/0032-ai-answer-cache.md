# ADR-0032 — The Phase 7 answer cache: exact normalised keys

- **Status**: accepted (decided in the client's Phase 7D brief, 4 October 2026)
- **Date**: 2026-10-04
- **Phase**: Roadmap Phase 7 (AI foundation), slice 7D
- **Builds on**: ADR-0027 (embeddings belong to Phase 8), ADR-0024 (data classes), ADR-0029
  (quotas and budgets), ADR-0031 (where AI is allowed); the `ai.semantic_cache` flag (7A)

## Context

Learners ask the same general questions again and again — "what is inheritance in Java", worded
a dozen ways. Each answer costs tokens and time. A cache that reuses answers must never become a
way around the platform's rules: an answer kept for one person must not reach another, an answer
drawn from material someone may not open must not reach them, and a cached answer must never be
treated as permission. ADR-0027 left the Phase 7 foundation to exact matching of normalised
questions; similarity matching needs embeddings, which belong to Phase 8.

## Decision

1. **Two architectures, two phases.**
   - **Phase 7 (this ADR): a normalised exact key.** A question is normalised by fixed,
     documented rules, and an answer is reused only for a question with the same key. No
     embeddings, no vectors, no pgvector, no similarity, no Redis: one PostgreSQL table,
     `ai_cache_entries`.
   - **Phase 8: embedding similarity with pgvector**, under its own ADR (ADR-0026, ADR-0027). It
     may reuse this table's scopes, rules and invalidation interface; it does not change what a
     Phase 7 key is.
2. **The key** is SHA-256 of, in a fixed order: the normalisation's version, the institute, the
   scope, the person (user scope only), the surface (purpose), the data class, the language, the
   model family, the prompt version, the knowledge version and the normalised question. Any part
   that differs is another key.
3. **Normalisation** folds only differences of form: case, spacing, typographic quotes, sentence
   punctuation; question framings ("what is", "explain", "define", "describe", "tell me about",
   "meaning of"; "meaning" or "definition" at the end); the articles a, an and the; and where a
   question names its one language or technology ("inheritance in Java" and "Java inheritance").
   It keeps the order of the words — no sorting — every other word, and the punctuation inside a
   word, so "Java faster than Python" and "Python faster than Java", `c`, `c++` and `c#`, and `=`
   and `==` stay apart. Under-merging costs a call; over-merging would answer the wrong question.
4. **Scopes.**
   - `shared`: a general question with nothing of the asker in it — no first person ("I", "my",
     "we"…). The entry names no person, conversation or message.
   - `user`: any other cacheable question, for its asker alone; it goes with the conversation it
     was answered in and is erased with its person.
5. **What is never cached.** A question with a line break, code (`{`, `}`, `;`, code fences), an
   e-mail address, a number of six digits or more, or a link; a question asked after earlier
   messages or notes (its answer depends on them); anything but the `public` data class — lab hints
   (`personal`), course material (`course`), anything `restricted`; a lab hint, course or lesson
   subject; an answer that did not complete, was cut short, withheld, cancelled or failed.
6. **Writes** happen after the answer has closed, in a background job (`ai.cache.write`) that reads
   the answer back from the database and checks every rule again. The key is unique: of two writes
   at once one keeps the answer, and an entry is replaced only when it can no longer be reused.
7. **Every hit** comes after the whole policy — flags, permission, timed tests, data class approval,
   quotas — never instead of it. The entry is then checked: in date, not invalidated, written by the
   model that routes now, and every source it drew on (`sources`) still within the asker's reach,
   checked by the services that decide reach. Anything that cannot be confirmed is a miss. An entry
   is never authority.
8. **Invalidation.** Expiry (`cacheTtlHours` in the AI settings, 168 by default); another model
   version of the family (stale at the next lookup, replaced at the next write); a new prompt or
   knowledge version (part of the key; the old entries are never found and the retention sweep
   removes them); the Super Admin's purge (`POST /ai/admin/cache/purge`, audited); and
   `AiCacheService.invalidate(reason, sources?)`, the one interface Phase 8's knowledge events need.
9. **Switching.** The cache works only for people the `ai.semantic_cache` flag reaches, with
   `module.ai`. A reused answer calls no provider, so it counts against no allowance.

## Alternatives

- Embedding similarity now: needs an embedding model, a vector store and an evaluation of what
  "similar enough" means — Phase 8's work (ADR-0026, ADR-0027).
- An in-memory or Redis cache: lost on restart, or a new service; no per-entry scope, audit or
  erasure.
- Sorting words to merge reorderings: merges questions whose order is their meaning.

## Consequences

- Phase 7's hit rate is modest by design; Phase 8 raises it with similarity, under these rules.
- Course and lesson sources are checked from Phase 7E, when answers can draw on them; until then an
  entry naming one is never reused.
