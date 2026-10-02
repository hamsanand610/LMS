# tests module

Timed papers: the builder, the window, the attempt engine and the results (journeys J-10, J-11).

| Aspect      | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes      | `GET/POST /tests`, `GET/PATCH /tests/:id`, `PUT /tests/:id/paper`, `POST /tests/:id/status`, `GET/POST /tests/:id/schedules`, `DELETE /tests/:id/schedules/:scheduleId`, `GET …/results`, `POST …/release`, `GET …/monitor`, `GET /tests/:id/grading/queue`, `POST /tests/:id/attempts`; attempts: `GET /attempts/:id/state`, `PATCH /attempts/:id/answers`, `POST /attempts/:id/events`, `POST /attempts/:id/submit`, `GET /attempts/:id/result`, `PATCH /attempts/:id/answers/:answerId/grade`; learner: `GET /me/tests` |
| Permissions | `tests:read`, `tests:attempt` (own), `tests:manage`, `tests:schedule`, `tests:grade`, `tests:release`, `tests:monitor`; all but read and attempt take scope `all` or `batch`                                                                                                                                                                                                                                                                                                                                               |
| The clock   | `expiresAt` is written when the attempt starts, from the server's time, and never later than the window closes. Every save is refused after it, and a job every minute submits anything still open. A client whose clock is wrong changes nothing (plan AC-07.1)                                                                                                                                                                                                                                                           |
| Autosave    | Answers are written as the learner types, debounced. `GET /attempts/:id/state` returns them, so a dropped connection costs at most one interval (plan AC-07.2)                                                                                                                                                                                                                                                                                                                                                             |
| One attempt | Starting again hands back the attempt already open, and the unique index on (schedule, student, attempt) settles a race between two tabs (plan AC-07.4)                                                                                                                                                                                                                                                                                                                                                                    |
| Marking     | Objective answers are marked on submission, with negative marking applied to a wrong answer and never to a blank one; a paper never scores below zero. Written answers go to the queue. A coding answer is marked on the server where the driver allows it, and otherwise joins the written queue rather than trusting a client report (ADR-0016)                                                                                                                                                                          |
| Release     | Staff see scores as soon as they exist; a learner sees nothing until the results are released, and the release is refused while any written answer is unmarked (`grading_incomplete`, plan AC-07.3)                                                                                                                                                                                                                                                                                                                        |
| Review      | `full` shows the paper with the answers and explanations, `score_only` shows the number, `none` shows neither                                                                                                                                                                                                                                                                                                                                                                                                              |
| Integrity   | Tab switches and full-screen exits are counted and shown to staff on the monitor and the results table. They are never used to block: a browser cannot be trusted to report them, so acting on them would be acting on a guess                                                                                                                                                                                                                                                                                             |
| Safety      | The paper and the settings cannot change while anybody is sitting the test (`test_in_progress`), and a window with attempts against it cannot be removed                                                                                                                                                                                                                                                                                                                                                                   |
| Events      | `test.scheduled`, `attempt.submitted`, `test.released`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Audit       | `test.created`, `test.updated`, `test.paper_saved`, `test.published`, `test.scheduled`, `test.unscheduled`, `test.released`, `attempt.started`, `attempt.submitted`, `attempt.answer_graded`                                                                                                                                                                                                                                                                                                                               |
| Tests       | `test/tests.e2e-spec.ts` (AC-07.1 to AC-07.4, the release gate, the monitor, auto-submission); `apps/web/e2e/assessment.spec.ts` (sitting a test through the pages)                                                                                                                                                                                                                                                                                                                                                        |

## Phase 2 (2 October 2026)

- **Results (D7).** A paper still being answered has no result for its owner
  (`attempt_in_progress`). Section scores follow the score: nothing before the release. Until
  every window of the test has closed (in every batch it was given to), a learner has the total
  and the section totals only: no question list, no key, no explanation, not even which answers
  were right, whatever the release policy. The result says when that changes (`reviewOpensAt`,
  the last window's close).
- **Papers** take only the types a timed test can answer: choices, written answers and code.
- **The countdown** is the server's: the browser subtracts the time since it fetched the attempt.
- **Learner list** carries the description, instructions and attempt history.
- **Reminders.** `tests.window-reminders` (hourly at :20) tells the learners who have not sat a test
  that its window closes within a day, once per window.
- **Tests:** `test/tests.e2e-spec.ts` (J-11: the key held until the window closes);
  `test/learner.e2e-spec.ts` (one test in two batches: nothing until both windows close).

## Phases 3 and 4 (3 October 2026)

- **Windows (TRN-05).** `PATCH /tests/:id/schedules/:scheduleId` moves a window before it opens;
  once it has opened it can only be extended, and the batch is told (`test.window_extended`). A
  test cannot go back to draft or be archived while anyone is sitting it (`test_in_progress`).
- **Grading (TRN-05).** The queue has `state=pending|marked`; re-marking a released answer is
  audited with the marks before (`attempt.answer_remarked`) and tells the learner; an attempt
  moves to graded when no answer waits.
- **Run inside a test (TRN-12).** `POST /attempts/:id/questions/:testQuestionId/run`
  (`tests:attempt`, 40 runs in 5 minutes) runs a coding answer on the question's visible cases or
  on the learner's own input, only for the attempt's own learner, only while it is open and only
  for a coding question. Nothing is saved or marked, hidden cases never run (asking for one runs
  nothing, `no_visible_cases`), and one run at a time per person (ADR-0021). The paper's coding
  answer uses the same code editor and console as assignments and the Labs, without Submit: the
  answer is what the editor holds, saved with the paper and marked on submission.
- **Tests:** `test/test-run.e2e-spec.ts`; `test/trainer-workflows.e2e-spec.ts` (windows,
  grading).
