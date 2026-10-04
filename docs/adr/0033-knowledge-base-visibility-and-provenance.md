# ADR-0033 — The knowledge base: visibility and provenance

- **Status**: proposed (built in Roadmap Phase 8A on 4 October 2026); accepted when the client
  approves slice 8A
- **Date**: 2026-10-04
- **Phase**: Roadmap Phase 8 (RAG knowledge system), slice 8A
- **Builds on**: `docs/architecture/AI_ARCHITECTURE.md` §4 (the knowledge system); ADR-0005
  (storage), ADR-0006 (jobs), ADR-0010 (enrolment derived from publication), ADR-0023 (course
  staff), ADR-0024 (data classes), ADR-0026 (vector storage), ADR-0027 (embeddings), ADR-0031
  (where AI is allowed)

## Context

Phase 8 grounds SI Academy AI's answers in the institute's own material. Before anything is
ingested, embedded or retrieved, the knowledge base needs one answer to "can this person retrieve
this chunk?", enforced where it cannot be bypassed, and every chunk must say where it came from, so
that a passage can be cited, checked and withdrawn. The architecture plan (§4) lists what
authorisation needs: the institute, the source, the course and lesson, visibility and audience,
publication, version and checksum.

## Decision

1. **Four tables, one chain.** Source → document → version → chunk.
   - A **source** is a body of knowledge: one institute, one audience, one data class, one state
     (draft, published, archived). Its type says where it comes from: `authored` in SI Academy,
     `uploaded`, or `course` material (ingested from the course in Phase 8B).
   - A **document** is one piece of a source, named by a reference unique in the source
     (`canonical_ref`), perhaps about one lesson of the source's course; active or archived.
   - A **version** is one content of a document: numbered from 1, hashed, kept as a file, and taken
     through ingestion: `pending` → `processing` → `chunked` or `failed`. At most one version of a
     document is current, and only a chunked one.
   - A **chunk** is one passage of a chunked version: its position, heading, text and hash.
2. **Provenance the database enforces.** Each row carries its parents' whole key, and composite
   foreign keys hold the copies to their parents: a document to (source, institute), a version to
   (document, source, institute), a chunk to (version, document, source, institute). A chunk that
   names one institute and belongs to another's version cannot be written. Deletion is restricted
   along the chain, except that a version's chunks go with it. Without a valid chain there is no
   row: no knowledge without provenance.
3. **Who may draw on a chunk.** `KnowledgeReachService` is the one rule, and Phase 8D's retrieval
   filters by it in the same query. All of these, read from the database when asked:
   - the person's own institute;
   - a published source;
   - a data class the provider may be given: `public` or `course`. `personal` is held back until
     Phase 8E weighs it against the institute's approvals (ADR-0024); `restricted` is refused by
     the database;
   - an audience that includes the person: `institute`, everyone; `staff`, whoever has no student
     profile; `course`, the people `CoursesService.reachableCourseIds` gives the course to (enrolled
     and not withdrawn, or teaching a batch it is published to), and for a document about one lesson,
     only while `LessonsService.aiContextFor` would open that lesson to them;
   - the current, chunked version of an active document.
4. **Publication.** A source is written as a draft. Its audience, course and data class are settled
   before it is published and fixed after: a different audience is a different source. A source is
   published once. Archiving is final: nothing in an archived source changes or is added, and it is
   never drawn on again.
5. **Content hashes.** SHA-256 of the text normalised: Unicode NFC, LF line ends, no trailing spaces
   or tabs on any line, no blank lines at either end. The same content in another form has the same
   hash, and a document never holds the same content twice (unique document and hash); any change
   of words is a new version. Chunks are hashed the same way, so Phase 8C can tell which passages
   need embedding again.
6. **Storage.** A version's normalised text is kept through the platform's storage driver
   (ADR-0005) in the private bucket, with a `files` row: owner type `knowledge-version`, its
   checksum the content hash, no uploader. No second storage abstraction. The files API never
   serves it by id: a file that no upload context describes is reached only through the module that
   wrote it, so `files:read`, which administrators and content managers hold for every file, does
   not open the knowledge base.
7. **Privacy.** The knowledge base holds the institute's material, not a person's data. Its files
   name no uploader, so a person's erasure, which purges that person's uploads, never reaches them;
   their export does not include it. Personal knowledge is not ingested in 8A. The audit log records
   ids, counts, hashes and states, never content.
8. **Ingestion is a contract in 8A.** The jobs `ai.knowledge.ingest` (8B) and `ai.knowledge.embed`
   (8C) carry `{ versionId }` alone. The database's state decides: one worker claims a version
   (pending or failed → processing), records its chunks (processing → chunked; the newest chunked
   version becomes the current one) or records a failure code. A repeated or doubled job changes
   nothing twice (operating rule 39). No handler is registered in 8A.
9. **Management.** The permission `ai:knowledge_manage` (scope `all`), the Super Admin's alone in
   8A through the complete bundle (no other role's bundle changes), and the option flag
   `ai.knowledge`, off, beside `module.ai`. Routes under `/ai/knowledge`. No web page in 8A.
10. **The embedding boundary.** Chunks have no vector and nothing specific to a model or provider.
    Embeddings will have a table of their own beside the chunks, with the model's name and the
    dimension beside each vector (ADR-0026, ADR-0027). A change of model embeds again into new
    rows.

## Alternatives

- **Visibility on each chunk.** A chunk's audience could drift from its source's. One rule on the
  source, inherited by everything under it, is checked once.
- **Visibility by role name.** Roles are configurable. Reach by student profile, enrolment and
  teaching follows the services that already decide it (ADR-0010, ADR-0023).
- **The institute on the source alone.** Every retrieval would need joins to filter by institute.
  Carrying it on every row lets each table be filtered on its own, and the composite keys keep the
  copies true.
- **Content in the database.** Large text in the rows that queries scan. The storage driver already
  keeps files with checksums.
- **Hashing the raw bytes.** A change of line ends or trailing spaces would be a "new" version.
- **A separate vector database.** Rejected by ADR-0026.

## Consequences

- Phase 8B writes chunks only through the claims and `recordChunks`; Phase 8D filters by
  `whereRetrievable` in the similarity query; nothing else decides reach.
- 8A's audiences are institute, staff and course. Batch or role audiences, topics and skills
  (architecture plan §4) are not in 8A; a later slice adds them with a migration if the client
  wants them.
- Personal knowledge reaches nobody until Phase 8E.
- Knowledge is not erased with any person. In 8A a source is withdrawn by archiving it; purging
  knowledge is not built.
- The reach rule asks the lesson services once per lesson-bound document's lesson; Phase 8D
  measures this under load before it filters every retrieval with it.
