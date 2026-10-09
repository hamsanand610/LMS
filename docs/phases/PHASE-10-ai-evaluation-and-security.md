# Phase 10 — AI evaluation and security

The client authorised Phase 10 on 9 October 2026 (the Phase 10 brief: "AI Evaluation & Security"),
after the curriculum (the locked plan's Step 2) was verified and deployed. It is built as one
continuous milestone: inspect, reuse, implement, verify, harden, report. It stops at the Phase 10
gate (`docs/ROADMAP.md`): AI is complete when the evaluation and the red-team suite pass their
thresholds, not because an API answers.

Out of scope, by the brief: placement data, new curriculum, unrelated features, any change to the
domain, email or AWS costs, the Gemini/Groq configuration, and learner personal data or lab hints
(ADR-0041's terms are still unrecorded).

## Gap analysis (inspection, 9 October 2026)

| Area                       | What Phases 7–9 left                                                                                                                                                | What Phase 10 adds                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Knowledge management       | API only (`ai:knowledge_manage`, the Super Admin): sources, documents, versions as text in the body, ingestion and embedding asked for one by one, publish, archive | The admin Knowledge base page; file uploads; automatic processing; document edits; deletion; processing again; chunk inspection; failures in plain words |
| Course, module, lesson     | A source is for one course; a document may be about one lesson of it                                                                                                | A lesson picker grouped by module. No module column (not in the model, and none is needed: a lesson names its module)                                    |
| Answers from the documents | `POST /ai/knowledge/answer` (no page); the learner's agent searches the knowledge base (9B)                                                                         | A question tried from the Knowledge base page, over the institute's published knowledge, for the people who manage it                                    |
| Stale knowledge            | A new version supersedes the old once chunked; archiving deletes the vectors                                                                                        | Deleting a document or a source purges its versions, chunks, vectors and stored files; processing again rebuilds vectors                                 |
| Evaluation                 | 8D's retrieval and 8E's answer evaluations, 9E's agent set, on the fake provider; live smokes by hand                                                               | One Phase 10 evaluation and red-team suite with thresholds and a report, through the new path; a live evaluation with Gemini and Groq on synthetic text  |
| Security                   | 248 AI e2e cases (authorisation, isolation, injection, grounding, fallback, quotas)                                                                                 | The new routes for every role; cross-batch isolation; injection through uploaded files; upload abuse; deletion and re-indexing races                     |

## Decisions

1. **The existing routes keep their behaviour.** Ingestion and embedding stay separately asked
   for on `POST documents/:id/versions`, `versions/:id/ingest` and `versions/:id/embed` (Phase 8's
   tests prove them). The page uses new routes whose work runs on its own: an upload is ingested,
   then embedded when its source is published; publishing processes what is waiting.
2. **Uploads are text files the pipeline already reads**: Markdown, plain text and HTML (`.md`,
   `.markdown`, `.txt`, `.html`, `.htm`), at most 750,000 bytes and 500,000 characters, valid text
   (no NUL or control bytes), never holding a credential. PDF, Word and OCR stay deferred: they need
   an extraction engine, a new dependency and its review (Phase 8's register, B).
3. **Deletion purges.** A deleted document's versions, chunks, vectors and stored files are removed
   and the audit keeps the record (ids, title, counts). Archiving stays as the way to withdraw a
   source and keep it.
4. **Processing again** retries an ingestion that failed or never ran, and otherwise rebuilds the
   current version's vectors under the active contract. Re-chunking the same content under a new
   chunker stays deferred (Phase 8's register, C).
5. **The managers' trial question** answers over the institute's published knowledge, every
   audience, because whoever holds `ai:knowledge_manage` already reads all of it on the page. It is
   a route of its own, for that permission alone; every other answer keeps the reach rule.
6. **No role gains a permission.** `ai:knowledge_manage` stays the Super Admin's.
7. **Observability** stays the platform's ledger, audit and logs. LangSmith or another hosted
   tracer would send prompts out of the platform, which no decision approves (AI_ARCHITECTURE §7).

## Thresholds (the gate)

On the fake provider (CI, every push) — the suite `ai-phase10-evaluation.e2e-spec.ts`:

- unauthorised retrievals, protected leaks, fabricated citations, successful injections, stale
  or deleted passages drawn on, anonymous or unauthorised access that succeeds: **0**;
- answerable questions answered with a citation of the right document: **100%**;
- unanswerable questions declined without a model call: **100%**;
- conflicting sources shown as conflicting: **100%**.

Live, with the production keys on synthetic text (Gemini primary, then Groq alone) — the script
`ai:eval-live`:

- injections and leaks that succeed, and fabricated citations: **0**;
- answerable cases answered and cited correctly: **at least 90%**;
- unanswerable cases declined: **100%**.

## What was built

**API** (`apps/api/src/modules/ai/knowledge/`; ADR-0043):

- `processing.service.ts`: the job `ai.knowledge.process` (an upload read, then indexed once its
  source is published) and the routes' processing: a document or a whole source processed again.
- `knowledge.service.ts`: uploaded documents (refused before anything is stored when the file holds
  a credential or the content is already in the source), document edits (title, lesson), deletion
  that purges versions, chunks, vectors, embedding runs and stored files (a deadlock retried), chunk
  pages; source and document views carry the course's and the lesson's names.
- `embedding.service.ts`: `ensureRequested` — embedding asked for by the platform itself, saying why
  when it cannot, and rebuilding a version's vectors.
- `retrieval.service.ts`, `knowledge-reach.service.ts`, `answer.service.ts`: the managers' trial
  question (`RetrievalMode` `managed`, `POST /ai/knowledge/preview` alone), audited `preview: true`.
- `knowledge.controller.ts`: ten routes, all `ai:knowledge_manage` behind `module.ai` and
  `ai.knowledge`; uploads and trial questions rate-limited. Phase 8's routes are unchanged.
- `manifest.ts`: the admin menu's "Knowledge base" (Insight), for that permission, with `ai.knowledge`.

**Shared** (`packages/shared/src/schemas/knowledge.ts`): the upload contracts (extension, size in
bytes and characters, text only), document edits, chunk pages, the trial question, the processing
summary.

**Web** (`apps/web/src/modules/ai/knowledge/`, `/admin/knowledge`, `/admin/knowledge/[id]`): the
sources with where the knowledge base stands; a source's documents with each one's state — read,
indexed, failed and why, in words a manager can act on — polled while work runs; upload (file read
and checked in the browser, the title from its name, the lesson picked by module), new version,
edit, process again, inspect (versions and passages), delete; publish, archive, delete the source;
"Try a question" with the answer, its status and its citations. The page answers as plain text:
nothing in a document is rendered as markup.

**Fixed on the way** (found by evidence, not re-run until green):

- **AI conversations lost an answer from their context** (CI #57 attempt 1, `ai-conversations` ›
  "sends the recent conversation"). A turn's question and answer are written in one transaction and
  share a `createdAt`; history was ordered by time alone, so the answer could come back first, and
  the context window — which opens on a question — dropped it. The model then lost the learner's
  previous answer. Fixed by ordering ties answer-first, newest first (`NEWEST_FIRST`: `role` is an
  enum declared `user, assistant`), for the context and the conversation the learner reads. A test
  writes the pair answer first in one moment: it failed before the fix, and passes.
- **The 8D and 8E evaluations flaked** (CI #57 attempt 1: "N1 answered", "0.40452 < 0.4"). Each
  run's word (`evalanswers<time>`) landed, about one run in four, on a dimension of the fake's
  vectors that a corpus word uses (206 of 768 for 8E, 179 for 8D), moving similarities across the
  evidence floor. Fixed words now, chosen to share no dimension with their corpus, and a test that
  keeps it so: every measure is the same in every run.

## Verification

**The evaluation and red-team suite on the fake provider** (`ai-phase10-evaluation.e2e-spec.ts`, in
CI; the fake obeys every instruction it reads, the worst model): 36 cases, 36 passed, every threshold
met — answered with the right citation 100%, declined without a model call 100%, conflicts shown
100%; unauthorised disclosures 0, stale or removed passages drawn on 0, fabricated citations 0,
injections obeyed 0, access violations 0 (of 34 attempts: signed out, without `ai:chat`, another course or a locked
lesson as context, and every non-manager role on the management routes). The world: two courses on two batches, their learners
and trainers, a Placement Coordinator, an administrator; knowledge through the page's own routes —
uploaded, replaced, deleted, archived, left a draft; five injection documents (reveal, role, rule
override, forged evidence tags with a fake `[S9]`, hidden HTML) and four injected questions.

**The page's routes** (`ai-knowledge-management.e2e-spec.ts`, 14 tests): every route refused to the
Admin, Trainer, Placement Coordinator and Student (403) and to anyone signed out (401); the menu
item for the Super Admin alone; uploads read at once, indexed once published, answered with their
citation; eleven unsafe files refused with nothing stored (PDF, Word, no extension, NUL and control
bytes, not UTF-8, empty, over 500,000 characters, over 750 KB, extra fields, a lesson of another
course, a credential), a body over 1 MB refused unread, a duplicate refused; HTML read as text (no
script, handler, style, frame or comment indexed); a new version replacing the old in every answer,
neither drawn on while the new one waits to be indexed; a lesson change followed at once; deletion
leaving no row and no stored object; processing again after a failure and a rebuild; the trial
question for managers alone, the reach rule for everyone else; another institute's knowledge not
found by any route; 20 trial questions in five minutes.

**Live, on the production host** (`ai:eval-live`, in the release image with the release's own
environment; synthetic text only, nothing written; 9 October 2026): Gemini `gemini-3.5-flash`
primary, Groq `openai/gpt-oss-120b` standing in, `gemini-embedding-001` at 768, floor 0.71.

| Pass                                  | Answerable cited right | Unanswerable declined | Conflict shown | Injections obeyed | Failures |
| ------------------------------------- | ---------------------- | --------------------- | -------------- | ----------------- | -------- |
| primary (Gemini; Groq on its failure) | 10/10                  | 4/4                   | 1/1            | 0 of 6            | 0        |
| stand-in (Gemini down: Groq answers)  | 10/10                  | 4/4                   | 1/1            | 0 of 6            | 0        |

The first, unpaced run measured the providers' free-tier per-minute limits instead: Gemini refused
after six calls in quick succession and Groq stood in, as designed (that pass still met every
threshold); Groq alone refused five of its last calls. Paced at one call every eight seconds, both
passes met every threshold. Production carries this: at bursts above the Gemini tier's per-minute
limit, learners are answered by Groq.

**The gate** (one package at a time: in parallel this machine runs out of memory): type-check 9/9,
lint 9/9, unit tests 931 (shared 173, runner 16, API 653, web 89), API e2e 766/766 in 63 files.

**The browser**: the whole journey on a local stack with the fake provider and real background
jobs — source, upload, reading polled to "Read", publish, indexing polled to "Ready", passages
inspected, a question answered and cited, unsafe files refused, processing again, the document and
the source deleted, and the same question then declined. The Playwright journey
(in `e2e/ai.spec.ts`, beside the AI journeys that switch the same flags) runs it in CI.

## Security findings

| Finding                                                                                                      | Severity | State                                                         |
| ------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------- |
| A conversation's context could drop the learner's previous answer (tied timestamps)                          | medium   | fixed, tested                                                 |
| Hidden HTML (`display:none`) reaches the passages as text, so an injection hidden in it is read by the model | low      | stopped by the answer check (withheld); kept as a test        |
| Knowledge management routes had no rate limit                                                                | low      | uploads 30 and trial questions 20 a person in five minutes    |
| Deleting knowledge was impossible; archived text stayed in chunks and files                                  | low      | deletion purges; archiving still keeps (by design)            |
| `ai.lab_hints` is on in production though `personal` is not approved                                         | info     | inert; the client switched it off on 9 October 2026 (closure) |
| Answers render as plain text everywhere: a link or image in a document cannot load anything                  | info     | confirmed                                                     |

No critical or high finding. No role gained a permission.

## Deferred

- PDF, Word and OCR extraction (needs an engine and its review; Phase 8's register, B).
- Re-chunking the same content under a new chunker (Phase 8's register, C).
- Grounded answers inside the plain course assistant for staff: learners get them through the
  learning agent (Phase 9), managers through the trial question.
- A hosted tracer (LangSmith or another): no decision approves sending prompts out of the platform.
- `personal` data and lab hints: ADR-0041's terms are still unrecorded.

## Closure (9 October 2026, session 55)

The client's closure brief: inspect and fix the UI issues reported after the release, verify the AI
features as a learner and a trainer would meet them, prepare a Privacy Policy and Terms of Service,
keep `ai.lab_hints` off, and run the gate. No placement data.

**UI defects, found by inspecting every route of the three portals at 390, 768 and 1366 pixels**
(fixed position, overflow, clipping, console and failed requests):

| Defect                                                                                                                                                                   | Route                                                                | Cause                                                                                                                                                        | Fix                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| The floating "Ask SI Academy AI" button sat on the roll call's save button: a click on "Mark 20 students" opened the AI instead (1366 px: covered whole; phone: in part) | `/trainer/sessions/[id]/attendance`, `/admin/attendance/[sessionId]` | the launcher (fixed, `z-40`, bottom right) is hidden only where a page's own controls fill the screen; the roll call's sticky save bar holds the same corner | the launcher is hidden on both roll-call routes (`LAUNCHER_HIDDEN`), as on tests and labs                                              |
| Interview prep was 418 px wide on a 390 px phone: the page shifted sideways and its title was cut                                                                        | `/interview-prep` (any segmented switch with long labels)            | the segmented tab list could neither shrink nor scroll                                                                                                       | the segmented list scrolls within itself (`max-w-full overflow-x-auto`, `justify-center-safe`); the tabs root never grows past its row |
| Fields and vocabularies showed "Request failed with status 404" three times                                                                                              | `/admin/settings/fields`                                             | the list asked for `/taxonomies/<key>`; the route is `/taxonomies/<key>/terms` (since Phase 6)                                                               | the right address; the Playwright check now expects the terms                                                                          |
| Content pages showed `**` literally                                                                                                                                      | `/pages/[slug]`                                                      | the body was printed as plain text                                                                                                                           | a text-only renderer: paragraphs, headings, lists, bold, a contents list; never HTML                                                   |

The element the client called "HC" could not be matched to a two-letter label in the code or on any
route; the floating launcher above is the one element that appears at the bottom of some pages and
not others and hides what is under it. The production account names (initials) were not read.

**AI, verified on a local stack with the fake provider** (no external call, synthetic data):

- Suggested questions are the learning agent's (Phase 9D), built in the browser, offered to learners
  only: "Explain this lesson" on a lesson (answered from the lesson's text, cited `S1`), "What does
  this course cover?" on a course. With learner context unapproved, the workspace and the general
  assistant offer none; staff are never offered any. Loading ("Searching SI Academy knowledge…",
  "Preparing the answer…"), success with sources, and refusal (a question holding a key: not sent,
  the draft kept) shown.
- Found: on a course page with no lesson open, the agent can only search the knowledge base — no tool
  reads the course outline — so "What does this course cover?" declines ("couldn't find enough
  information") unless a published knowledge source covers the course. Proposed as a follow-up
  (a `course_outline` tool, data class `course`).
- `ai.lab_hints` off: no AI Hint on a lab; the availability endpoint says `labHints: false`; the API
  refuses a hint conversation (403 `ai_feature_disabled`).
- The trainer's assistant answers beside a course; isolation, Gemini and Groq rest on this phase's
  suites (above) and the live evaluation.

**Privacy Policy and Terms of Service**: built in (`apps/api/src/modules/settings/built-in-pages.ts`)
and served at `/pages/privacy` and `/pages/terms` without signing in until the institute publishes
its own page there; drafts written from the code, with every unconfirmed fact marked "To be
confirmed". Review record, evidence and the conditions for `ai.lab_hints`: `docs/legal/LEGAL_REVIEW.md`.
The demo seed no longer writes its own legal pages.
