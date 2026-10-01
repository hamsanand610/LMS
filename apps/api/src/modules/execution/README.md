# execution module

Running learner code, and turning what happened into marks (ADR-0007, ADR-0016).

This module has no permissions, no navigation and no manifest. It is machinery the assessment
modules share, chosen by configuration, in the same way they share object storage.

| Aspect        | Detail                                                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration | `EXECUTION_DRIVER` is `runner` (the default; `RUNNER_URL`, `RUNNER_TOKEN`), `judge0` (`JUDGE0_URL`, `JUDGE0_TOKEN`) or `none`. The pre-ADR-0016 value `browser-sandbox` is read as `none`                            |
| The rule      | **The API process never compiles, evaluates or spawns learner code.** It builds a job (code, case inputs, limits) and sends it to a driver                                                                           |
| runner        | `apps/runner`: one throwaway, locked-down container per job (no network, read-only root, no capabilities, CPU, memory and process limits). Java, Python, JavaScript, PHP and SQL. Results are `trusted`              |
| judge0        | A Judge0 host on a private network; SQL is not offered there. Results are `trusted`                                                                                                                                  |
| none          | Nothing runs anywhere; coding answers wait for a person. `available` is false and the workspace says so                                                                                                              |
| Hidden cases  | A job carries inputs only. Expected outputs never leave the API, which compares in `compare.ts` (exact, trimmed lines, tokens, unordered lines, floating point; SQL result tables in or out of order)                |
| Marks         | Computed here, from the weights stored against the question. A result for a case the question does not have is dropped, and a case nobody reported counts as failed, so a short result list cannot inflate a score   |
| Records       | Every run is written to `execution_runs` with its driver, trust level, verdict and per-case detail, whether it came from practice, an assignment, a test or a validation                                             |
| Limits        | Time (judged on CPU time, with a wall-clock backstop) and memory per question and per case, output caps, and the runner's own deadline per job; a busy runner answers 503 and the caller is told to try again        |
| Unavailable   | `ExecutionUnavailableError` (503 to the caller). Run says the sandbox is unavailable; a submission stays "being checked" and the evaluation job retries                                                              |
| Tests         | `compare.spec.ts`; `test/assessment.e2e-spec.ts` through a stand-in driver (`test/setup/fake-execution.driver.ts`); the real sandbox in `apps/runner` (`test:sandbox`) and `pnpm --filter @lms/api verify:questions` |

Runs recorded before ADR-0016, when a learner's browser reported its own verdict, keep their
`untrusted` label and never count as solved (`ACCEPTED_PRACTICE_RUN`).
