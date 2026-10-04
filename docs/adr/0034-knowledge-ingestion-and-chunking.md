# ADR-0034 — Knowledge ingestion and chunking

- **Status**: accepted (proposed and built in Roadmap Phase 8B on 4 October 2026)
- **Approved**: 2026-10-04, by the client, with slice 8B (the Phase 8C brief, which keeps this ADR
  the authoritative ingestion and chunking decision)
- **Date**: 2026-10-04
- **Phase**: Roadmap Phase 8 (RAG knowledge system), slice 8B
- **Builds on**: ADR-0033 (the knowledge base: visibility and provenance), ADR-0005 (storage),
  ADR-0006 (jobs), ADR-0026 and ADR-0027 (vectors and embeddings, Phase 8C), ADR-0031 (where AI is
  allowed)

## Context

Phase 8A defined the knowledge base and the contract of its ingestion. Phase 8B turns a version's
stored content into chunks that Phase 8C can embed without reading the file again. The pipeline
must be deterministic (the same content always gives the same chunks), idempotent (a job repeated,
retried or run twice at once changes nothing twice), bounded (no version can hold a worker or
exhaust its memory), and it must never make knowledge visible: publication decides that
(ADR-0033).

## Decision

1. **Formats.** A version is written in Markdown (when none is named, as in 8A), plain text or HTML,
   named when it is created and stored with its media type. PDF, Word and the like are not read:
   the platform has no engine that reads text out of them (pdf-lib only writes certificates), and
   8B adds none. A PDF is refused when the version is created; content stored in a type ingestion
   does not read fails as `unsupported_format`. No OCR.
2. **Normalisation**, the same for every format: strict UTF-8 (anything else is
   `malformed_content`), Unicode NFC, LF line ends, control characters and the zero-width space,
   word joiner and byte-order mark removed (the zero-width joiner and non-joiner stay: Indic scripts
   need them). Nothing is lowercased, no punctuation removed, no line reflowed.
3. **Structure.** Every format is read into blocks — headings, paragraphs, quotations, lists with
   their nesting, code with its language, tables — and every chunk is written from blocks in one
   form, Markdown.
   - **Markdown** is taken as written: CommonMark's blocks with GitHub's tables. HTML inside
     Markdown stays text, because a lesson about HTML must keep its tags.
   - **HTML** goes through the platform's sanitiser (`sanitize-html`, already a dependency) with a
     structure-only policy: scripts, styles, navigation, footers, forms, frames, images, comments
     and every attribute go, with the content only a browser would show; entities are decoded and
     whitespace folded; code keeps its spacing.
   - **Plain text** is paragraphs, every line kept as written.
4. **Chunking** (`sections-1`), in characters, because the platform counts text in characters and
   estimates tokens from them (no tokenizer is added): a target of 1,200, a maximum of 2,000, a
   minimum of 200, an overlap of at most 200.
   - Sections first: each heading opens one, and a section within the maximum is one unit, whole.
   - A longer section is cut between its blocks, and a block longer than a chunk by its own grain:
     a paragraph between sentences (then words), a list between items (an item with the items
     nested under it), a table between rows (its header repeated), code between lines (fenced
     again). Every part of a cut section opens with its heading.
   - Consecutive units join while they fit the target; a unit below the minimum joins its
     neighbour while the two fit the maximum.
   - Overlap only where a paragraph is cut: its last sentence, when 200 characters or fewer, also
     opens the next chunk. Nothing else is repeated.
   - Nothing is dropped. The chunker's version names its sizes (`sections-1/1200-2000-200-200`), so
     a change of either is a new version.
5. **A chunk's heading** is its section's path, its headings joined by `' > '` (the headings its
   sections share when it holds several), for citations.
6. **Identity.** A chunk's id is a name-based UUID (version 5) of its version, its position and its
   content's hash: ingesting the same version again gives the same ids, texts and hashes, so an
   embedding keyed by a chunk (8C) stays valid while the chunk does.
7. **Lifecycle**, as ADR-0033 set it: pending → processing → chunked or failed. There is no
   separate "parsed" state: parsing and chunking are steps of one job and leave nothing durable
   between them, a version becomes chunked in the same transaction that writes every one of its
   chunks, and a failure records the stage it stopped at.
8. **The job** (`ai.knowledge.ingest`, on pg-boss; ADR-0006):
   - does nothing while `module.ai` or `ai.knowledge` is off;
   - claims a version of its own institute — pending, failed, or processing past a 10-minute lease
     — and the claim's time is a token every later write checks, so an ingestion that lost its
     lease records nothing;
   - checks the source and the document are not archived, a lesson document's lesson is in its
     source's course, no newer version is current, and the file is the version's own (owner type,
     owner, institute, folder, private, ready), in a format it reads, within the size limit;
   - reads at most the limit through the storage driver, verifies the content's hash, extracts,
     and records every chunk and the chunked state in one transaction, holding the version and its
     document locked; chunks an interrupted ingestion left are replaced, never added to;
   - records any failure as a code, never the content: `storage_unavailable` and `persist_failed`
     are tried again by the queue (twice); every other code holds until the version is fixed or
     replaced.
9. **Limits:** 500,000 characters of source per version (the API), 2 MiB read from storage,
   200,000 characters of text, 1,000 chunks, 60 seconds per ingestion, a 10-minute lease.
10. **Asking for it.** `POST /ai/knowledge/versions/:id/ingest` (202) and
    `GET /ai/knowledge/versions/:id`, for `ai:knowledge_manage` with both flags on, in the caller's
    institute. The request is refused for an archived source or document, a chunked version, one an
    ingestion holds, and one older than the current version. Creating a version does not ingest it.
11. **The hand-over to 8C** (`KnowledgeIngestionService.chunksForEmbedding`): a chunked version's
    chunks with their provenance (ids, position, heading), text, hash, counts, parser and chunker
    versions, the document's title, reference and lesson, and the source's visibility — from the
    database alone. None for an archived source or document, another institute, or data the
    provider may not be given (personal).
12. **Visibility is unchanged.** Ingestion grants nothing: a draft stays a draft, personal knowledge
    is chunked but reaches nobody and is not handed to 8C, and the files API never serves a
    knowledge file (8A).
13. **A source's course stays** while documents of it are about lessons (409), and ingestion refuses
    a lesson document outside its source's course (`document_mismatch`).

## Alternatives

- **Sizes in tokens, with a tokenizer:** a new dependency, tied to a model not yet chosen (8C).
- **Fixed windows of N characters:** they cut code, lists and tables through their middle.
- **A separate parse job with a stored parsed document (a "parsed" state):** a second copy of every
  document, which nothing reads.
- **A PDF library:** a second document engine the brief asked not to build; better documented as
  unsupported until a reliable one is chosen.
- **Random chunk ids:** ingesting a version again would orphan its embeddings.
- **Ingesting on version creation:** hidden work inside a request. An explicit request keeps it
  visible and testable, and can be joined to creation later.

## Consequences

- Phase 8C embeds what `chunksForEmbedding` hands it, keyed by chunk id, with the chunker version
  recorded.
- Ingesting course material automatically — lessons as documents, kept current by publish events —
  is not built in 8B, although the Phase 8 plan first placed it there. It awaits the client's
  decision (Phase 8 plan, "Deviation").
- A sentence or word longer than a chunk is cut between words, or within the word.
- A new chunker version calls for the versions ingested before it to be ingested again: a path a
  later slice builds when it is needed.
- **Phase 8C** (ADR-0035) embeds exactly what `chunksForEmbedding` hands over, keyed by chunk id,
  and keeps a vector valid only while its content hash equals its chunk's. This ADR's migration
  reached `lms` on 4 October 2026, under the database gate, before any 8C work (progress log,
  session 37).
