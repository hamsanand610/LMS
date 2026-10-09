# ADR-0043 — The Knowledge base page: uploads processed on their own, deletion that purges, and the managers' trial question

- **Status**: accepted — built on 9 October 2026 under the client's Phase 10 brief ("AI Evaluation &
  Security")
- **Date**: 2026-10-09
- **Phase**: Roadmap Phase 10 (AI evaluation and security)
- **Builds on**: ADR-0033 (sources, documents, versions, the reach rule), ADR-0034 (ingestion),
  ADR-0035 (embeddings), ADR-0036 (retrieval), ADR-0037 (grounded answers)

## Context

Phase 8 built the knowledge base as an API alone: the Super Admin (`ai:knowledge_manage`) creates
sources, adds documents and versions as text in the request, and asks for each version's ingestion
and embedding one step at a time. Nothing deleted knowledge, no page showed it, and a manager could
not see what the AI would answer: through the reach rule, a Super Admin who teaches no batch draws
on no course's knowledge. The Phase 10 brief asks for an admin interface — upload, list, inspect,
update, delete, re-ingest — joined end to end to the RAG pipeline, with stale knowledge never
answering, within the existing permission model and without unnecessary dependencies.

## Decision

1. **New routes for the page; the old ones keep their behaviour.** Phase 8's routes stay exactly
   as they are: a version added through `POST documents/:id/versions` waits until its ingestion is
   asked for, and so on (Phase 8's tests prove each step alone). The page uses its own routes, all
   for `ai:knowledge_manage` behind `module.ai` and `ai.knowledge`:
   - `POST sources/:id/uploads` (a new document from a file), `POST documents/:id/uploads` (a new
     version), at most 30 a person in five minutes;
   - `GET`/`PATCH`/`DELETE documents/:id`, `DELETE sources/:id`;
   - `POST documents/:id/process`, `POST sources/:id/process`;
   - `GET versions/:id/chunks` (a page of a version's passages);
   - `POST preview` (decision 5).
2. **Processing runs on its own.** An upload queues `ai.knowledge.process` (a version id alone):
   the version is ingested as in ADR-0034 and, once it is its document's current version and its
   source is published, embedded as in ADR-0035 — through the same claims, leases, checks, limits
   and records — counted to whoever added the version. Publishing from the page also processes what
   is waiting. Processing a document again reads its newest version again when it failed or never
   ran; otherwise it rebuilds the current version's vectors under the active contract (deleted
   first, so a document being rebuilt is drawn on by nobody rather than on stale vectors).
   Re-chunking the same content under a new chunker stays deferred (Phase 8's register, C).
3. **Uploads are text files the pipeline reads**: `.md`, `.markdown`, `.txt`, `.html`, `.htm`; at
   most 750,000 bytes of UTF-8 and 500,000 characters (inside the API's 1 MB request limit); no
   NUL, control bytes or replacement characters (a binary file, or one not in UTF-8); never a
   credential (ADR-0036's restricted material); never content already in the source. The browser
   reads the file and sends its text; the API checks it again and stores it as Phase 8B stores any
   version — privately, hashed, never served by the files API. HTML is sanitised when it is read
   (ADR-0034), so no markup, script, handler or comment reaches a passage. PDF, Word and OCR stay
   deferred: they need an extraction engine and its security review (Phase 8's register, B).
4. **Deletion purges.** Deleting a document removes its versions, chunks, vectors, embedding runs
   and stored files, in one transaction that locks the document first, as ingestion's recording
   does (a deadlock with a writer is tried again); the stored objects go once the records are gone.
   Deleting a source does the same for every document in it, and the source. The audit keeps the
   record: ids, title and counts, never content. Archiving stays the way to withdraw a source and
   keep it listed. A document's title and lesson can change at any time; retrieval reads both at
   every question, so who may draw on it follows at once.
5. **The managers' trial question.** `POST /ai/knowledge/preview`, for `ai:knowledge_manage` alone,
   answers exactly as a grounded answer does (ADR-0037: the same flags, timed-test refusal, data
   classes, evidence floor, model, checks, citations, ledger and audit) over the institute's
   published knowledge of a retrievable class, every audience, or one source of it, or a course or
   lesson of the institute's. Whoever holds the permission already reads all of that knowledge on
   the page, so the AI tells them nothing the product does not. It is a retrieval mode of its own
   (`managed`), chosen only by that route; every other route keeps the reach rule. Its audit entries
   say `preview: true`.
6. **No role gains a permission**: `ai:knowledge_manage` stays the Super Admin's alone.

## Alternatives considered

- **Automatic processing on Phase 8's routes**: one path instead of two, but it changes what those
  routes promise and what their tests prove (a version waiting to be ingested, a version chunked but
  not yet embedded). Rejected: the page's routes say what they do.
- **Multipart file uploads, or presigned uploads to storage**: the pipeline reads text, and the
  JSON route already stores it as a private object; a second storage path would add a context and
  checks for no gain at these sizes.
- **Soft-deleting documents (status `archived`)**: keeps text the institute asked to remove, and a
  reference no new upload could reuse. Rejected for deletion; archiving a whole source remains.
- **Testing questions through a learner's account**: the real path, still the way to check what a
  learner sees, but no help to a manager checking a draft course's material before it is published
  to anyone.

## Consequences

- The knowledge base can be run from the browser; Phase 8's API stays for scripts and tests.
- Embedding happens without a separate request, so the provider's embedding calls (and any budget)
  follow uploads and publications. They are counted to the uploader and bounded by the upload limit.
- Between a new version being read and being indexed, its document answers nothing: never the
  stale version.
- A deleted document cannot be recovered except by uploading it again.
