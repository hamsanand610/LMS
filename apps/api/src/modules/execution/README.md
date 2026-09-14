# execution module

Running learner code, and turning what happened into marks (ADR-0007, ADR-0011).

This module has no permissions, no navigation and no manifest. It is machinery the assessment
modules share, chosen by configuration, in the same way they share object storage.

| Aspect          | Detail                                                                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration   | `EXECUTION_DRIVER` is `browser-sandbox` (the default) or `judge0`; the Judge0 driver reads `JUDGE0_URL` and `JUDGE0_TOKEN`                                                                                                   |
| The rule        | **The API process never compiles, evaluates or spawns learner code.** `BrowserSandboxDriver.run` throws, and an API test asserts that it does                                                                                |
| browser-sandbox | The learner's browser runs the code: JavaScript in a blob Worker at an opaque origin, Python through Pyodide. It posts back what happened, and the result is recorded as `untrusted` and badged as such                      |
| judge0          | The code is posted to a separate service over a private network and the verdict comes back `trusted`. Nothing changes in the assessment modules when the driver changes                                                      |
| Marks           | Computed here, from the weights stored against the question. A result for a case the question does not have is dropped, and a case nobody reported counts as failed, so a short result list cannot inflate a score           |
| Records         | Every run is written to `execution_runs` with its driver, trust level, verdict and per-case detail, whether it came from practice, an assignment, a test or a validation                                                     |
| Limits          | Time and memory limits live on the question. The browser driver enforces the time limit for JavaScript by terminating the worker; Python runs on the page, so a runaway loop there freezes the tab and the workspace says so |

## What the browser driver cannot do

A driver that runs in the learner's browser has to be given whatever it runs, hidden test cases
included. That is why its verdicts are recorded as untrusted, and why the trust badge appears
wherever a coding mark is shown. Configuring a Judge0 host moves execution off the learner's
machine, and the same pages then say "verified by the server". ADR-0011 sets out the reasoning.
