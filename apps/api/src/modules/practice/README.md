# practice module

Coding practice: a catalogue of problems and a workspace to solve them in.

| Aspect       | Detail                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routes       | `GET /practice/driver`, `GET /practice/summary`, `GET /practice/problems`, `GET /practice/problems/:slug`, `GET …/samples`, `GET …/cases`, `GET …/submissions`, `POST …/run`, `POST …/submissions`                             |
| Permissions  | `practice:use` (own) for learners; `practice:manage` decides which questions appear, and lives on the question bank's own endpoint                                                                                             |
| The model    | A problem **is** a published coding question whose author put it in the catalogue. Nothing is authored twice, so a problem used in an assignment and offered for practice has one set of test cases and one reference solution |
| Running      | "Run" checks the sample cases only and is recorded as an attempt. "Submit" runs every case and counts towards the learner's solved total                                                                                       |
| Verdicts     | Recorded in `execution_runs` with the driver and its trust level. The workspace shows which ran it, in those words                                                                                                             |
| Hidden cases | Under the browser driver `GET …/cases` includes them, because the browser cannot run what it has not been given. See ADR-0011; with a Judge0 host it returns only the samples                                                  |
| Points       | Each problem carries a point value, awarded once it has been solved                                                                                                                                                            |
| Status       | Solved, attempted or not tried, worked out from the learner's own runs rather than stored                                                                                                                                      |
| Events       | `execution.completed`                                                                                                                                                                                                          |
| Tests        | `apps/web/e2e/assessment.spec.ts` solves a problem end to end in the browser and checks the verdict and its badge                                                                                                              |

The plan's languages are JavaScript and Python. JavaScript runs in a blob Worker; Python arrives
through Pyodide on first use, which is a several-megabyte download the workspace warns about.
