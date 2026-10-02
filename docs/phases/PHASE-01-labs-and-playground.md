# Phase 1 — Labs and Playground

| Field    | Value                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status   | **In progress** — started 2 October 2026                                                                                                                                                                                 |
| Scope    | The client's Phase 1 brief of 2 October 2026 ("Phase 1 implementation — Labs & Playground"); the items below are its approved backlog (operating rule 2)                                                                 |
| Roadmap  | `docs/ROADMAP.md`, Phase 1                                                                                                                                                                                               |
| ADRs     | ADR-0018 (labs model), ADR-0019 (Web Lab), ADR-0020 (SQL Lab), ADR-0021 (playground and limits)                                                                                                                          |
| Decision | Course placement: admins and content managers place labs in course modules; trainers author, validate, preview and publish their own labs to the Labs catalogue and see their batches' attempts (client, 2 October 2026) |

## 1. Assessment: what exists and what is reused

Inspected before any change: the practice, questions, assignments, execution, courses and progress
modules; the runner, the sandbox image, the harness and the SQL runner; RBAC, scope and audit; the
schema; the tests; the learner workspace, the question editor, the course player and the design
system.

**Reused as it is**

- **Running code.** The execution path: learner → API → sandbox runner → one locked-down container per
  job (ADR-0016). It covers Java, Python, JavaScript and PHP, plus SQL on SQLite. Time is judged on
  CPU time, and output is capped. Expected outputs never leave the API.
- **Exercises.** The question bank, with versions, authorship, validation of the reference solution
  in the sandbox, and publish / unpublish (back to draft) / retire. Test cases carry visibility,
  weights, positions and per-case limits. An exercise is a question; it is never written twice.
- **The catalogue.** The practice catalogue: `inPractice` and points, run and submit, and
  `ExecutionRun` history with trust levels.
- **Progress.** The progress model: lesson completion, course percentage, the events
  `lesson.completed` and `course.completed`, and module unlock rules.
- **Access and records.** Permission and scope guards, author ownership of questions, batch reach for
  staff, and audit records.
- **The web workspace.**
  - `CodePanel` (editor, console, run, submit, keyboard shortcuts);
  - `SplitPanes`;
  - `RunResult` and `ResultTable`;
  - `ProblemStatement`;
  - `History` (put a previous answer back);
  - the CodeMirror wrapper;
  - the question editor's sections and its sandbox check.

**Missing** (the work of this phase)

- **Free-form running.** No playground: a run always needs a problem.
- **Lab types.** No Web Lab and no debugging challenges; HTML and CSS cannot even be edited (no
  CodeMirror language for them).
- **SQL Lab.** No schema browser and no labelled free query against a lab's dataset.
- **Drafts.** Drafts live only in the browser's storage, so unfinished work does not follow the
  learner to another device.
- **Courses.** There are no lab lessons: a coding question in a lesson points the learner away to the
  catalogue.
- **Staff views.** No trainer can see learners' lab attempts; no staff view of labs; no preview of a
  lab as a learner sees it.
- **Execution guards.** No per-learner concurrency limit on executions.
- **Output.** Output is cut at 8,000 characters without saying so.

**Defects found and fixed in this phase**, because Labs depend on them:

- `sqlrun.py` ran a case's own statements, which are the learner's in a custom run, before the
  authoriser and the step budget were installed.
- The catalogue's status filter ran after pagination, so it filtered one page and miscounted the
  total.
- A lesson's `questionId` was never checked: it could name a missing or unpublished question.

**Found and assigned elsewhere** (not fixed here; recorded in
`docs/product/IMPLEMENTATION_ROADMAP.md` §4):

| Finding                                                                            | Phase |
| ---------------------------------------------------------------------------------- | ----- |
| A practice lesson can be marked complete without answering its question            | 2     |
| `Enrollment.progressPct` goes stale after an outline edit                          | 5     |
| A timed test accepts code up to 100,000 characters, more than the sandbox's 64,000 | 6     |
| Two concurrent first solves can both report "newly solved"                         | 6     |
| Rate limits and the new execution gate live in one process (see ADR-0021)          | 6, 12 |

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                               | Record             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| D1  | Labs are question-bank questions. Two new types, `debugging` and `web`, join `coding` and `sql`. The practice module becomes the Labs area, behind its module flag, which is off by default and on for SI Academy                      | ADR-0018           |
| D2  | **Web Lab.** The preview runs in a sandboxed `srcdoc` iframe with an opaque origin and its own restrictive CSP, with no change to the app's CSP. Checks run in the sandbox runner against a headless DOM (jsdom), never in the browser | ADR-0019           |
| D3  | **SQL Lab.** It stays on SQLite inside the sandbox, isolated from PostgreSQL by the container. The authoriser now covers the learner's statements                                                                                      | ADR-0020           |
| D4  | **Playground and labs.** Execution, rate, concurrency and size limits, each with its reasoning                                                                                                                                         | ADR-0021           |
| D5  | **Course placement.** Admins and content managers place labs as lab lessons; trainers publish their own labs to the catalogue                                                                                                          | client, 2 Oct 2026 |

## 3. Items (the approved backlog of this phase)

| ID     | Item                                                                                                                                                                                                                                                                         | Brief |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| LAB-01 | **Code Playground.**<br>- Any code language the driver offers: write, run on your own input, and see stdout, stderr, compile errors, verdict, CPU time, memory and limit failures.<br>- Reset, and drafts kept on the server.                                                | A     |
| LAB-02 | **SQL Lab.**<br>- A schema browser derived in the sandbox.<br>- A free query against the lab's dataset, shown as a table.<br>- Checks against the examples, submit and history; every run starts from the dataset.                                                           | B     |
| LAB-03 | **Web Lab.**<br>- HTML, CSS and JavaScript editors with an isolated live preview and its console.<br>- Checks run in the sandbox, with structured feedback; submit and history.                                                                                              | C     |
| LAB-04 | **Debugging challenges.**<br>- A first-class type: broken starting code, what it should do, tests, and the existing hints.<br>- Validation requires that the starting code fails and the fix passes.                                                                         | D     |
| LAB-05 | **Exercise model and authoring.**<br>- The `debugging` and `web` types: web files and checks, expected behaviour, schema caching, migration.<br>- In the question editor: create, edit, save draft, validate, preview, publish, unpublish and retire.                        | E     |
| LAB-06 | **Trainer and admin management.**<br>- A Labs page: catalogue state, use in courses, attempts within scope, and preview as a learner.<br>- Trainers publish their own labs to the catalogue (`practice:publish_own`) and review their batches' attempts (`practice:review`). | F     |
| LAB-07 | **Learner experience.**<br>- The Labs hub (by type, status and topic, plus continue-where-you-left-off) in place of the old practice page.<br>- Lab lessons in the course player.<br>- Every state the brief lists.                                                          | G     |
| LAB-08 | **Execution results.**<br>- A standard result shape with truncation flags and the limits that applied.<br>- Hidden checks and tests show their verdict only.                                                                                                                 | H     |
| LAB-09 | **History and progress.**<br>- Attempt history for each lab.<br>- Lab lessons (`lab` type, `pass` completion rule) completed by a passing, trusted submission, in the lesson or in the catalogue, through the existing progress model.                                       | I     |
| LAB-10 | **Security and limits.**<br>- The per-learner execution gate, payload and output limits, and rate limits.<br>- The SQL authoriser fix, Web Lab isolation, server-side authorisation of every route, and audit of authoring.                                                  | J     |
| LAB-11 | **Tests.**<br>- Unit, API, sandbox, SQL Lab, Web Lab security, browser journeys, and property and invariant tests.<br>- The full regression.                                                                                                                                 | K     |
| LAB-12 | **Documentation.**<br>- ADRs, module READMEs, runbooks, the roadmap and implementation baseline, the progress log, and the OpenAPI document.                                                                                                                                 | —     |

## 4. Design summary

**Data** (one migration; only additive):

- **Enum values:** `QuestionType` gains `debugging` and `web`; `LessonType` gains `lab`;
  `CompletionRule` gains `pass`.
- **`coding_problems`:** gains `expected_behaviour` (text, default empty) and `sql_schema` (jsonb,
  nullable: the cached schema browser).
- **`lab_drafts`:** a new table holding a learner's unfinished work per lab, or for the playground,
  per language. Unique on user, scope and language; deleted with the user.

**API.** The practice module (route prefix `/practice`, unchanged):

- the catalogue for every lab type, with its status filter fixed;
- run and submit for every type;
- `POST /practice/playground/run`;
- drafts: `GET`, `PUT` and `DELETE /practice/drafts`;
- staff routes:
  - `GET /practice/labs`;
  - `GET /practice/labs/:id/preview`;
  - `POST /practice/labs/:id/preview/run`;
  - `POST /practice/labs/:id/catalogue`;
  - `GET /practice/labs/:id/attempts`;
  - `GET /practice/runs/:id`.

The courses module adds the lesson routes `GET /lessons/:id/lab`, `POST /lessons/:id/lab/run`, and
`GET` and `POST /lessons/:id/lab/submissions`.

**Permissions** (new; ADR-0009 grants them to the existing roles):

| Key                    | Scopes     | Granted to                      |
| ---------------------- | ---------- | ------------------------------- |
| `practice:publish_own` | own        | trainer, content manager, admin |
| `practice:review`      | all, batch | trainer (batch), admin (all)    |

**Web routes:**

- learners:
  - `/labs`;
  - `/labs/playground`;
  - `/labs/[slug]`;
  - `/courses/[id]/lessons/[lessonId]/lab`;
  - `/practice` and `/practice/[slug]` redirect to the matching `/labs` pages;
- trainers:
  - `/trainer/labs`;
  - `/trainer/labs/[id]/preview`;
  - `/trainer/labs/[id]/attempts`;
- admins: the same pages under `/admin`.

## 5. Quality gate

The phase is complete only when all of these hold:

- type-check, lint and unit tests pass;
- API tests pass;
- sandbox tests and the question-bank check pass;
- browser journeys pass on Chromium and the phone, including the Labs journeys and the Web Lab
  security tests;
- the build passes;
- the existing regression still passes;
- the migration applies cleanly to a copy of the sample data;
- the seeds stay valid;
- no secrets are introduced and no security control is weakened;
- the documentation is updated;
- the diff has been reviewed, with no temporary code left.

## 6. Deferred, with the phase that owns it

| Item                                                                           | Phase         |
| ------------------------------------------------------------------------------ | ------------- |
| Web and debugging questions inside assignments and timed tests                 | 3             |
| Lab analytics beyond attempts (difficulty insight, time on task)               | 3             |
| Visual or layout checks for the Web Lab (a real browser engine in the sandbox) | later, by ADR |
| AI hints and explanations for labs                                             | 9             |
| Shared, multi-instance stores for rate limits and the execution gate           | 6, 12         |
