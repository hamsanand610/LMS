# Task 4 — Assignments: reference, gap analysis and architecture

The Task 4 brief makes Assignments the next priority: one assignment system that works end to end for
learners, trainers and administrators, with a professional coding workspace, server-side evaluation,
real curriculum content and a security review. This document is the result of steps 1–10 of the brief
(audit, reference inspection, gap analysis, architecture). Decisions that change approved plans or
earlier ADRs are in ADR-0016.

## 1. How the audit was done

- **SI Academy**: four read-only audits of the working tree (API assessment stack, web assignment
  screens, curriculum/seeds/governing documents, authentication and authorisation). Findings quoted
  here are re-checked in code as each one is fixed.
- **Reference portal**: inspected read-only through the signed-in browser session the institute
  provided. Nothing was run or submitted there; no question text, branding, media or personal data
  was recorded (operating rule 43). What follows is structure, in our own words.
- **Inspo**: searched for coding platforms and learning dashboards. Its archive is marketing pages,
  so it informs principles (the editor as a dark plane in both themes, mono type for code accents,
  dense but calm lists) rather than workspace layouts. **21st** is not connected in this environment
  and was not used.

## 2. The reference, in brief

| Area              | What it does                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meaning           | An "assignment" is a large subject question set split into ordered topic modules (nine sets, about 1,900 questions), not a single dated task                                                                                                        |
| List              | Summary band (overall progress, sets done, questions attempted, marks); tabs All / In progress / Completed; one search box; cards with icon, level, modules, questions, marks, progress. No filters, no sorting, no due states                      |
| Set page          | Four stat tiles; numbered module rail with sequential unlock; per-module due state and module tests; question rows with type, attempts, time spent, difficulty, marks, bookmark, Solve / Review                                                     |
| Coding question   | Statement tabs (description, submissions, discussions) beside a Monaco-style editor with language, hint, reset, fullscreen, Run and Submit; a console with Custom input and Results; resizable panes; submissions open the submitted code read-only |
| Narrow screens    | Statement as the page; the editor as a separate full view; the console as a bottom sheet; a bottom action bar                                                                                                                                       |
| Other types       | Objective questions as a card with lettered option rows; HTML/CSS labs in an embedded editor workspace; the SQL set is objective questions only                                                                                                     |
| Topic progression | Language basics → control flow → methods → arrays → strings → OOP → exceptions → threads; a language-agnostic programming set that grows into data structures and algorithms; SQL from modelling to joins and normalisation; HTML, CSS, aptitude    |

The brief asks for more than the reference has: filters and sorting, computed due states, SQL with
an editor and result tables, written/file/practical/project types, hidden tests with run-versus-submit,
submission history with metrics, trainer review and admin analytics.

## 3. What SI Academy has today

- **Model**: `Assignment` → `AssignmentModule` (unlock rule) → `AssignmentQuestion` (a placement of a
  bank `Question`, with marks); `AssignmentPublication` per batch with an optional due date;
  `Submission` per attempt with `SubmissionResult` per test case. Questions are `mcq_single`,
  `mcq_multi`, `true_false`, `descriptive`, `coding`; coding carries languages, starter code,
  reference solution and test cases with a sample flag and weight.
- **Learner**: a card list filtered in the browser; a set page with modules and questions; a question
  screen with a plain text area for code, "run the examples" in the browser and one result panel.
- **Staff**: a list, a builder (modules, placements, marks), publish to one batch, a progress table,
  a marking queue for written answers, a question editor and a CSV import.
- **Execution**: JavaScript and Python only, run in the learner's browser; the server recomputes
  marks from its own case weights and stores the verdict as untrusted (ADR-0011). A Judge0 driver
  exists without infrastructure or tests.
- **Reports**: completion and overdue per publication; dashboard counts.

## 4. Gap analysis

`REUSE` keep as is · `IMPROVE` change what exists · `ADD` new · `REMOVE` delete.

| Area               | Existing                                                          | Verdict      | Required change                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container model    | Assignment → modules → placements → bank questions                | REUSE        | Same shape as the reference; no second system                                                                                                                              |
| Learning context   | Only a free-text subject                                          | ADD          | Course link, technology (the subject taxonomy), level, kind, topic and course-module link per module                                                                       |
| Rules              | Attempts per question, late policy, explanation policy            | IMPROVE      | Instructions, pass mark, open and close dates, per-module due offsets, estimated time; all editable after creation                                                         |
| Targeting          | One batch per publication                                         | IMPROVE      | Batch or individual learners; one targeting service instead of five copies of the same query                                                                               |
| Types              | Five question types                                               | ADD          | `sql`, `file_upload`, `practical`, `project`; module and final tests for quiz-linked work; one submission model with type-specific content                                 |
| Question content   | Title, body, options, starter, solution, cases                    | IMPROVE      | Input/output format, constraints, hints, per-case limits and enable flag, comparison mode, SQL setup; stable case ids on save; staff can see hidden cases they are editing |
| Status             | Per-question status; set status guessed in the browser            | IMPROVE      | Server-computed: not started, in progress, submitted, passed, failed, completed, overdue, locked, upcoming                                                                 |
| Learner list       | Unpaged array, browser filtering                                  | IMPROVE      | Server-side search, filters (course, topic, technology, level, status, type), sorting, paging, summary and facets                                                          |
| Code editor        | Plain text area                                                   | REMOVE + ADD | CodeMirror 6 workspace: highlighting, line numbers, folding, indentation, reset, re-indent, shortcuts, font size, language tab; loaded only on workspace pages             |
| Workspace          | Three separate variants (assignment, practice, test)              | IMPROVE      | One workspace: statement / editor / console (test cases, custom input, output, result) / submissions / feedback; resizable panes; bottom sheet on phones                   |
| Execution          | Browser only, JavaScript and Python, hidden cases sent to browser | REMOVE + ADD | Server-side sandbox behind the existing driver interface; Java, Python, JavaScript, PHP, SQL; hidden cases never leave the server                                          |
| Run and submit     | Submit only on assignments; both client-reported                  | ADD          | Run (visible cases and custom input, no record) and Submit (queued full evaluation, immutable record)                                                                      |
| Submission history | Stored per attempt, never shown; marking overwrites               | IMPROVE      | History list and detail (attempt, language, status, score, passed/failed cases, time, memory); reviews append, content never changes                                       |
| Feedback           | Comment stored, never returned                                    | IMPROVE      | Review decisions (graded, approved, resubmission requested) with comments shown to the learner                                                                             |
| Trainer review     | Queue of unmarked written answers only                            | ADD          | Review screen for every submission type with code, results and history; progress with failed attempts and struggling learners                                              |
| Admin analytics    | Completion per publication                                        | ADD          | Totals, published/draft, completion, overdue, average score, pass rate, submission volume, by course, module, learner and trainer                                          |
| Content            | 132 questions, 85 of them generated filler; boilerplate lessons   | REMOVE + ADD | Original, verified question sets by technology and topic; filler removed                                                                                                   |
| Product wording    | Environment chip, "prototype", "the demo…" strings, seeded notes  | REMOVE       | No development or demo wording in the product                                                                                                                              |
| Security           | Sound foundations; gaps listed in section 9                       | IMPROVE      | Fix the high and medium findings with deny tests                                                                                                                           |
| Responsive         | Workspaces stack into one long column below 1280 px               | IMPROVE      | Tabbed workspace with a sticky action bar and a console sheet on phones and tablets                                                                                        |

## 5. Architecture

### 5.1 One assignment model

Nothing is duplicated: an assignment stays a container of question placements, the question bank
stays the only place content lives, and a submission stays one row per attempt.

```
Programme ─ Batch ─┐
Course ─ CourseModule ─ Lesson (topic)      AssignmentPublication (batch | learner, opens, due, closes)
   │           │                                  │
Assignment ────┴─ AssignmentModule (topic, due offset, module test) ─ AssignmentQuestion (marks)
   kind, technology, level, course,                                          │
   instructions, pass mark, resources                                    Question (type, spec, hints)
                                                                             └ CodingProblem ─ TestCase
Submission (attempt, content, question version, evaluation) ─ SubmissionResult (per case)
        └ SubmissionReview (append-only: graded | approved | resubmission requested)
```

- **Types share the model.** The question type decides what a submission contains and how it is
  marked: options (objective), text (written), code (coding, SQL), files and links (file upload,
  practical, project). Automatic marking covers objective, coding and SQL; the rest go to review
  with a rubric. A module or the whole set can require a linked test (quiz-linked work).
- **Status is computed on the server** from publications, attempts and reviews: `upcoming` before it
  opens, `locked` when closed or gated, then `not_started`, `in_progress`, `submitted` (waiting for
  evaluation or review), `completed` / `passed` / `failed` against the pass mark, and `overdue` when
  the due date has gone with work outstanding.
- **Submissions are immutable.** Content and evaluation results are written once. A trainer's
  decision is a new `SubmissionReview`; the effective marks are cached on the submission. Removing a
  placement that has submissions is refused.

### 5.2 Evaluation

```
Learner ── Run ─────▶ Assignment API ─▶ Execution service ─▶ driver ─▶ sandbox      (visible cases, custom input; nothing recorded)
Learner ── Submit ──▶ Submission service ─▶ queue ─▶ Evaluation service ─▶ driver ─▶ sandbox
                           │ immutable record                         │ all cases, hidden ones included
                           ◀──────────── results, marks ──────────────┘
```

- The API never compiles or runs learner code (ADR-0007). It talks to a **driver**:
  `runner` (new, a separate sandbox service), `judge0` (kept, more languages mapped) or
  `browser-sandbox` (planned to stay for Run where no server sandbox exists). _As delivered (§10,
  ADR-0016) the browser driver is retired: `none` replaces it and the old name is read as `none`._
- **Hidden cases never reach the browser.** The sandbox receives inputs only; expected outputs stay
  in the API, which does the comparison. Learners see pass or fail for hidden cases, and input,
  expected and actual output for visible ones.
- **SQL** is a language of the sandbox: schema and data are created in a throwaway in-memory database
  for each run, the learner's query runs against it, and the result table is compared with the
  reference query's. It can never touch the application database.
- **Limits**: time and memory per problem and per case, output size caps, a rate limit on Run and
  Submit, a request-size limit set explicitly, language checked against the question.

### 5.3 Interfaces

- Learner: `GET /me/assignments` (search, filters, sort, paging, summary, facets), set detail,
  question view, `run`, `submissions` (create, list, detail).
- Staff: assignment metadata, structure, resources, publications (batch or learners, dates), progress,
  per-question analytics, review list and review decisions, analytics overview.
- Question bank: new types and fields, stable ids, server-side validation of reference solutions.
- Every route declares a permission and a scope; batch scope is intersected, never overridden.

### 5.4 Web

- **Learner**: a list that answers "what is pending, completed, due, next" (summary, filters in the
  URL, dense rows with a featured next step); a set page with rules, resources, modules and status;
  one workspace for every question type.
- **Workspace**: statement, editor and console in resizable panes on wide screens; tabs with a sticky
  action bar and a console sheet on narrow ones. The editor loads only there.
- **Trainer**: builder with settings, structure (reordering, topics, due offsets), publishing, progress,
  review. **Administrator**: the same plus analytics.

## 6. Content plan

Original SI Academy questions, written for this product and checked by running reference solutions
(quality over quantity; nothing copied from the reference). Sets follow the topic progression:

| Set                                 | Type                       | Topics                                                                                                                     |
| ----------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Core Java: coding                   | Coding (Java)              | Input/output, operators and control flow, methods, arrays, strings, classes, inheritance, exceptions, collections, streams |
| Core Java: concepts                 | Objective                  | The same topics, with output prediction and debugging                                                                      |
| Programming and DSA                 | Coding (several languages) | Arrays, strings, searching, sorting, recursion, stacks and queues, hashing, complexity                                     |
| SQL                                 | SQL + objective            | Selection, aggregation, joins, subqueries, constraints, normalisation, transactions                                        |
| Python                              | Coding (Python)            | Fundamentals, functions, collections, OOP, files and exceptions, iterators and generators                                  |
| JavaScript                          | Coding (JavaScript)        | Values, functions, arrays and objects, asynchronous code                                                                   |
| HTML and CSS labs                   | Practical                  | Structure, forms, tables, selectors, box model, flexbox, responsive layout                                                 |
| PHP                                 | Coding (PHP) + objective   | Fundamentals, arrays, functions, OOP, forms and sessions                                                                   |
| Advanced Java, Spring and Hibernate | Objective + written        | JDBC, servlets, Spring, Spring Boot, REST, JPA                                                                             |
| Full-stack project                  | Project                    | Milestones from data model to deployment                                                                                   |
| Interview preparation               | Mixed                      | Medium and hard problems with complexity analysis                                                                          |

## 7. Delivery order

1. Security fixes that the module depends on (section 9), with deny tests.
2. Schema and shared schemas; targeting, status and submission services; question-bank changes.
3. Sandbox service and driver; run, submit, evaluation queue.
4. Learner list, set page and workspace with the new editor; submission history and feedback.
5. Trainer builder, publishing, progress and review; administrator analytics.
6. Curriculum structure and question sets; removal of filler and demo wording.
7. Visual refinement, both themes, responsive pass, accessibility.
8. Role, security and end-to-end tests; typecheck, lint, tests, build; report.

## 8. Decisions needed before building

1. **Password hashing on this machine.** Windows Smart App Control blocks the native argon2 binary,
   so the API, seeds and tests cannot run here. Either the institute turns that setting off, or the
   product gains a WebAssembly fallback with the same algorithm and hash format.
2. **The sandbox.** Judge0, the engine named in the plan, cannot run under Docker Desktop on this
   machine. A small first-party runner that starts one locked-down container per run can, and can be
   verified end to end; Judge0 stays available as a driver.

## 9. Security findings to fix with this work

| Severity | Finding                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | A learner can read classmates' unreleased test results and the answer key through two `tests:read` routes                                                                                                                                      |
| Medium   | Trainers can reach batches they do not teach (assignment progress, withdraw, archive, structure, marking; a `batchId` query that overrides scope in sessions, attendance and the reports dashboard; the trainer dashboard is open to learners) |
| Medium   | "Reveal after the due date" reveals answers immediately                                                                                                                                                                                        |
| Medium   | Lesson HTML is rendered without sanitising; the web app sends no security headers                                                                                                                                                              |
| Medium   | Login throttling keys on unparsed input; the lockout counter is not atomic                                                                                                                                                                     |
| Medium   | A batch-scoped trainer can broadcast to the whole institute                                                                                                                                                                                    |
| Medium   | Practice runs are graded from a client report; a sample-only run counts as solved                                                                                                                                                              |
| Low      | File ids are not checked against owner and context; type sniffing fails open; open redirect after sign-in; account existence leaks; query cache kept after sign-out; invitation token in the URL path                                          |

Anything not fixed in Task 4 is listed as a remaining limitation in the final report.

## 10. As delivered

| Area                | Outcome                                                                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model and targeting | Kind, technology, level, course and programme links, instructions, pass mark, estimated time, resources; modules with topic, course-module link, due offset and gating; publications to a batch or to named learners with open, due and close dates                           |
| Types               | Nine question types in one submission model: objective three, written, coding, SQL, file upload, practical, project                                                                                                                                                           |
| Status              | Computed on the server for every learner (`learnerState`), never taken from the client                                                                                                                                                                                        |
| Learner             | Server-side list with summary, facets, search, filters, sorting and paging in the address; set page; one workspace for every type with CodeMirror 6, run, submit, history and feedback                                                                                        |
| Execution           | `apps/runner` on Docker (ADR-0016): Java, Python, JavaScript, PHP and SQL; hidden cases and expected outputs never leave the API; run versus submit; queued, idempotent evaluation that waits out a sandbox outage; time limits judged on CPU time with a wall-clock backstop |
| Deployment          | Runner image (`apps/runner/Dockerfile`) and sandbox image built and published by CI; staging runs the runner beside the API with the host's Docker socket, no published port; CI proves the sandbox and every reference solution on each change                               |
| Staff               | Builder (structure, details and rules, resources, publishing, progress with struggling learners, reviews), review queue and review page for every type, append-only decisions, analytics                                                                                      |
| Question bank       | Editor for all nine types with hints, hand-in requirements, per-case limits and weights, comparison modes, SQL setup and check queries; stable option and case ids across edits; sandbox check before publishing                                                              |
| Content             | 151 original questions across the programme's tracks (47 coding and SQL, each reference solution run in the sandbox by `verify:questions`); 14 assignments; the generated filler is gone                                                                                      |
| Security            | Every finding in section 9 fixed with deny tests, except that an invitation token still travels in its link (it is now kept out of request logs); plus reviewer mark schemes kept from learners and a stricter Content Security Policy                                        |
| Product wording     | No environment chip, demo or seeded wording in the product; the integrations page reports the code-execution driver that is really running                                                                                                                                    |

**Not delivered in Task 4**

- Quiz-linked modules (a module that requires a test) — tests and assignments stay separate.
- Question bookmarks and per-question discussions from the reference.
- Seeded hand-ins with uploaded files: seeded learners hand in links only, because a file cannot be
  seeded honestly without a real upload.
- A seeded learner's coding answers carry the verdicts measured in the sandbox but not per-case
  output, which only a live evaluation records.
