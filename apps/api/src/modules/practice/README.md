# practice module

Coding practice: a catalogue of problems and a workspace to solve them in.

| Aspect       | Detail                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routes       | `GET /practice/driver`, `GET /practice/summary`, `GET /practice/problems`, `GET /practice/problems/:slug`, `GET …/samples`, `GET …/cases`, `GET …/submissions`, `POST …/run`, `POST …/submissions`                             |
| Permissions  | `practice:use` (own) for learners; `practice:manage` decides which questions appear, and lives on the question bank's own endpoint                                                                                             |
| The model    | A problem **is** a published coding question whose author put it in the catalogue. Nothing is authored twice, so a problem used in an assignment and offered for practice has one set of test cases and one reference solution |
| Running      | "Run" checks the visible cases (or the learner's own input) in the sandbox and records nothing. "Submit" runs every case, hidden ones included, is recorded, and counts towards the solved total when every case passes        |
| Verdicts     | Recorded in `execution_runs` with the driver and its trust level; only a trusted submission that passes every case counts as solved                                                                                            |
| Hidden cases | Never sent to the browser: `GET …/cases` returns the samples only, and a hidden case comes back from a submission as a verdict and a cost (ADR-0016)                                                                           |
| Points       | Each problem carries a point value, awarded once it has been solved                                                                                                                                                            |
| Status       | Solved, attempted or not tried, worked out from the learner's own runs rather than stored                                                                                                                                      |
| Events       | `execution.completed`                                                                                                                                                                                                          |
| Tests        | `test/assessment.e2e-spec.ts` (run, submit, hidden cases, solved status); `apps/web/e2e/assessment.spec.ts` solves a problem in the sandbox end to end and checks the recorded verdict                                         |

The plan's languages are JavaScript and Python. JavaScript runs in a blob Worker; Python arrives
through Pyodide on first use, which is a several-megabyte download the workspace warns about.
