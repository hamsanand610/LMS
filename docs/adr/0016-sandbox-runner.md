# ADR-0016 — Learners' code runs in a sandbox runner; the browser never judges it

- **Status**: proposed (awaiting approval with ADR-0013, ADR-0014 and ADR-0015)
- **Date**: 2026-10-01
- **Phase**: Task 4 (Assignments)
- **Supersedes**: ADR-0011. Keeps ADR-0007's rule that the API never executes learner code.

## Context

ADR-0011 accepted two limitations of the browser driver as the price of running anywhere: a
verdict the learner's own machine reported, labelled untrusted, and hidden test cases sent to the
browser so it could run them. The Task 4 brief removes both: _hidden test cases must never be
exposed to the browser_, answers must be evaluated in a sandbox, and learner code must never run
inside the API process (no `eval`, no `new Function`, no `child_process` against learner code).

The machine the institute runs on is Windows with Docker Desktop. Judge0 (ADR-0007's server
driver) needs cgroup v1 and privileged containers and does not run there. The owner chose a
first-party runner on Docker (answer recorded 2026-09-30).

## Decision

**1. A separate runner service executes code; the API only sends jobs.** `apps/runner` is a small
Node HTTP service (no framework) that accepts a job — language, code, case inputs, limits — over
a bearer-token API (`RUNNER_TOKEN`, at least 32 characters, compared in constant time), and starts
**one throwaway container per job** from the `lms-sandbox:1` image (`infra/sandbox`: JDK 21,
Python 3, Node.js, PHP CLI, SQLite). Each container runs with `--network none`, a read-only root,
`--cap-drop ALL`, `no-new-privileges`, a PID limit, memory and swap limits, one CPU, an open-file
limit, a non-root user, size-limited `tmpfs` for the work directory, no logging driver, and a
deadline after which it is killed. A case's time limit is judged on the CPU time it uses (plus the
runtime's start-up), so a cold or busy host cannot fail a correct answer; the wall clock is only a
backstop, at twice that allowance plus two seconds, for code that waits instead of computing. Jobs are queued with a concurrency limit; a full queue answers
503 so the API retries later.

**2. Expected outputs never leave the API.** A job carries inputs only. The harness in the
container reports what the program printed, how it ended and what it cost; the API compares that
with the expected output it keeps (`execution/compare.ts`: exact, trimmed lines, tokens, unordered
lines, floating point; SQL result tables in or out of order). Nothing inside a container — and
nothing in the browser — can learn what a hidden case expects.

**3. Run and Submit are different.** _Run_ executes the visible cases (or the learner's own input)
and records nothing. _Submit_ creates an immutable submission in `evaluating`, and a queue job
(`assignments.evaluate`, idempotent, retried on runner outages, swept every five minutes) runs
every enabled case and writes the verdicts, marks, time and memory. A learner sees hidden cases as
a verdict and a cost only; reviewers with access see everything.

**4. SQL runs in SQLite inside the same sandbox.** The question's tables and rows load into an
in-memory database per case, the learner's statements run under an authoriser that refuses
`ATTACH`, unsafe pragmas and extension loading, with a step budget, and the result table (or the
question's check query, for questions that change data) is printed as JSON.

**5. Drivers.** `runner` (the default), `judge0` (for Linux hosts that already run it; SQL not
offered there) and `none` (code questions wait for a person; `browser-sandbox` is accepted as an
alias so old configuration still starts). The browser runner and its Pyodide download are removed,
and the Content Security Policy no longer allows WebAssembly, third-party scripts or blob workers.

**6. The editor is CodeMirror 6, loaded only where code is written.** Syntax colours come from
design tokens (`--code-*`, on the ink plane), so the editor follows the theme in both modes.

**7. Seeded content is proved, not asserted.** `pnpm --filter @lms/api verify:questions` runs every
reference solution in the bank through the same runner and comparison; the seed marks a coding
question as validated, and records a seeded learner's run, only from the outcomes that run wrote
(`prisma/seed/content/verified-runs.json`, fingerprinted so an edited question falls back to draft).

## Consequences

- Hidden cases are secret for practice, assignments and tests alike, and every coding mark is
  trusted. ADR-0011's untrusted badge disappears; runs recorded before this change keep their label
  and do not count as solved.
- The deployment gains a service: the runner needs Docker on its host and the sandbox image. It
  holds no data and needs no database. In staging (`infra/compose.staging.yml`) it runs as a
  container that reaches the host's Docker through the mounted socket, as a member of the docker
  group rather than root, with a read-only root, no capabilities and no published port. Holding the
  socket is holding the host, so that container gets nothing else (no database, storage or secret
  but its token), only the API can reach it, and the sandbox image is pulled at deploy time because
  a job never pulls one (`--pull never`). CI builds and publishes `lms-runner` and `lms-sandbox`
  with the other images and proves the sandbox and the question bank on every change.
- A container per job costs roughly a second to start (more for the JVM). The limiter keeps a
  classroom's burst of submissions from starving the host; evaluation is asynchronous, so learners
  see "being checked" rather than a hung request.
- The runner's token is a secret shared by the API and the runner, set through the environment,
  never committed; `sharedEnvironmentProblems` refuses to start a non-local API without one.

## Alternatives considered

- **Judge0.** Rejected for this host: it cannot run on Docker Desktop for Windows. Kept as a driver.
- **Keep the browser driver for practice.** Rejected: the brief forbids sending hidden cases to the
  browser, and two judging paths would give two meanings to "solved".
- **Run code in a worker thread or `vm` inside the API.** Rejected outright: it is execution inside
  the API process, which ADR-0007 and the brief both forbid.
