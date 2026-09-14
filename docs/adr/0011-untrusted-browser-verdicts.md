# ADR-0011 — What a browser-run verdict is worth, and what it costs

- **Status**: accepted
- **Date**: 2026-09-14
- **Phase**: 4 (Assessment)

## Context

ADR-0007 chose an execution adapter with two drivers: `browser-sandbox` for the demo and `judge0`
where a Linux host is available. Phase 4 had to make that real, and doing so forced two questions
the earlier decision left open.

**Who decides whether a case passed?** With a server-side driver the server runs the code and knows.
With the browser driver the learner's own machine runs it and reports back. A report is a claim.

**Where do the hidden test cases live?** A coding question carries sample cases, which are shown,
and hidden cases, which decide the mark. A driver running in the browser has to be given every case
it runs. There is no way to hide a case from the machine that executes it.

## Decision

**1. The API never executes learner code.** `BrowserSandboxDriver.run` throws rather than falling
back to anything, and an API test asserts that it throws. There is no path by which a submission
causes the API process to compile, evaluate or spawn anything.

**2. A browser-run verdict is recorded, and labelled untrusted.** Every run is stored in
`execution_runs` with its driver and a trust level. Every place a coding mark appears carries the
badge: "verified in your browser" or "verified by the server". A learner who tampers with the
report gets a mark the platform never claimed was checked.

**3. Marks are computed from the server's own weights.** The client reports pass or fail per case;
the server maps those onto the cases the question actually has, drops anything unrecognised, counts
an unreported case as failed, and applies the weights stored against the question. The client
cannot claim a case is worth more than it is, nor invent a case.

**4. With the browser driver, hidden cases are sent to the client to be run.** The endpoints that
do this say so in their own documentation, and hand back only the samples when the configured
driver runs on the server. A learner who looks at the network traffic can read the hidden cases.

**5. Tests are different.** A coding answer inside a timed test is marked after submission, on the
server. When the configured driver cannot run there, the answer goes to the written-answer queue
for a person rather than being marked from a client report. A test paper therefore never sends its
hidden cases anywhere.

## Consequences

- The demo works on any machine, with no Linux host and no cost, and shows honestly what it knows.
- Practice and assignment coding marks are worth what an untrusted verdict is worth. For practice
  that is fine: the learner is the only person who loses by cheating. For an assignment it is a
  stated limitation, visible on every mark.
- Hidden cases in practice and assignment questions are not secret under the browser driver. An
  institute that needs them to be secret configures Judge0; nothing else changes.
- Tests, where the marks matter most, never leak their cases and never trust a client report.
- The trust badge is not decoration. It is the only honest way to show a mark whose provenance the
  platform cannot vouch for.

## Alternatives considered

- **Grade practice and assignment coding on samples only, keeping hidden cases server-side.**
  Rejected: the learner would see "3 of 3 passed" and a mark that ignored most of the problem, and
  the hidden cases would exist without ever being used.
- **Refuse coding questions entirely without Judge0.** Rejected: it removes a feature the brief
  asks for from every deployment that cannot run a Linux host, which is the demo and most trials.
- **Trust the browser and drop the badge.** Rejected: it states something the platform does not
  know, which is the one thing this project does not do.
- **Run the code on the server in a sandbox of our own.** Rejected by ADR-0007 already: a correct
  sandbox is a large, ongoing security commitment, and getting it wrong is worse than not having it.
