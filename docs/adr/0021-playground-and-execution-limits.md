# ADR-0021 — Playground and lab execution limits

- **Status**: accepted (proposed on 2026-10-02 and built in Roadmap Phase 1)
- **Approved**: 2026-10-02, by the client, at the Phase 1 gate
- **Date**: 2026-10-02
- **Phase**: Roadmap Phase 1 (Labs and Playground)
- **Keeps**: ADR-0016 (isolation and CPU-time judging); the sandbox's own limits (`SANDBOX_LIMITS`)

## Context

The playground runs any code a learner writes, with no problem attached, and Labs make every run
and check cheaper to request. Each request starts a container on the runner, which runs two jobs at
a time and queues 32 more by default. Before Phase 1, rate limits were the only per-person control:
nothing stopped one learner holding both runner slots with parallel requests. Output was cut at
8,000 characters without saying so.

## Decision

| Limit                    | Value                                                                       | Why                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Playground languages     | the code languages and SQL the driver offers                                | Only runtimes the sandbox actually has; `web` has its own lab                                                           |
| Playground time          | 5 s of CPU, plus the runtime's start-up                                     | The sandbox default; CPU time, so a busy host cannot fail a correct program                                             |
| Playground memory        | 256 MB                                                                      | A JVM heap that fits ordinary teaching programs; the sandbox allows up to 512                                           |
| Source size              | 64,000 characters                                                           | The sandbox's own cap (`SANDBOX_LIMITS.maxCodeChars`)                                                                   |
| Web files                | 20,000 characters each; 64,000 encoded                                      | Room for a teaching page; the bundle must fit the sandbox's code cap                                                    |
| Playground input (stdin) | 16,000 characters                                                           | The harness writes input in one write; this stays under the 64 KiB pipe buffer even at four bytes a character           |
| Output kept per stream   | 64 KiB                                                                      | Unchanged; more is cut and reported as "Output too long"                                                                |
| Output shown             | 8,000 characters, **with a "cut" flag**                                     | Enough to read; the flag tells the learner the rest was cut                                                             |
| Runs (each endpoint)     | 30 per 5 minutes per person                                                 | About one every 10 s sustained, with bursts; unchanged from practice                                                    |
| Submissions              | 20 per 5 minutes per person                                                 | Unchanged from practice                                                                                                 |
| Executions at once       | **1 per person**                                                            | A second request while one is running is refused (429, "already running"), so one person cannot take both runner slots  |
| Draft saves              | 120 per 5 minutes per person                                                | Autosave every few seconds of typing, no more                                                                           |
| Web page time            | the lab's limit (2 s by default) + 4 s start-up                             | The page's own scripts get the lab's CPU time; loading jsdom and the page (about a second of CPU) has its own allowance |
| Web check settle time    | 300 ms after `load`; 60 ms after each step                                  | Lets short timers finish; the CPU limit still bounds everything                                                         |
| Web page snapshot        | 20,000 elements, 4 MB                                                       | A bigger page is reported as too large to check rather than judged                                                      |
| Web checker              | 10 s of CPU, 256 MB, 25 s of wall clock, once per job                       | The harness's own limits, not the learner's: the checker runs none of the page's code (ADR-0019)                        |
| SQL                      | 5 million steps; 50 statements in an answer, 200 in a case's rows; 500 rows | The step budget and the authoriser now cover a case's own rows too (ADR-0020)                                           |

**The execution gate.**

- It is held in the API process, keyed by user, and released when the run finishes, however it
  ends.
- Run, submit, check, playground and preview runs all pass through it.
- Validation of a reference solution by staff does not.

## Consequences

- **Fairness.** One learner cannot crowd others out of the runner; the queue serves many learners
  rather than one learner's many tabs.
- **One process.** The gate, like the rate limiter, lives in one API process. With more than one
  instance, each would allow one run per person. A shared store belongs to Roadmap Phases 6 and 12
  (`docs/product/IMPLEMENTATION_ROADMAP.md` §4).
- **Observability.** Execution is logged with the user, the lab, the language, the verdict and the
  time, never the code, the input or the output.
- **Nothing outlives a case.** After every case the harness stops whatever the program left running,
  in any session, so nothing a learner starts can act during a later case or a web lab's checker.
- **Deadlines.** The runner and the API size their deadlines on one shared function
  (`caseWallMs` in `packages/shared`), which mirrors the harness, a web check's checker included.

## Alternatives considered

- **A per-person queue instead of a refusal.** It would hide an abuse pattern and hold HTTP
  requests open. Rejected.
- **Larger playground limits.** Each extra second or megabyte is multiplied by every learner.
  Teaching programs fit easily.
