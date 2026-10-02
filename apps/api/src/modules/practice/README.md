# practice module — the Labs

Roadmap Phase 1 (ADR-0018 to ADR-0021): coding, SQL, debugging and web labs, the code playground,
drafts kept on the server, and the staff's view of labs and of learners' attempts. The module key
stays `practice`, so permissions, the run context and everything that counts practice solves
(streaks, the leaderboard, placement kits) count lab solves too.

| Aspect            | Detail                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The model         | A lab **is** a question of the bank of type `coding`, `sql`, `debugging` or `web`. Nothing is authored twice: one set of test cases, one reference solution, one validation. A web lab's files travel as one encoded bundle (`web/1`) and each of its checks is a test case whose input is the check and whose expected output is `pass`    |
| What learners see | Only a lab that is published, passes its own check (`validation.ok`) and is in the catalogue — or one a course lesson opens (`LIVE_LAB` in `practice.service.ts`). Hidden cases and checks are never sent: a learner gets their verdicts only                                                                                               |
| Learner routes    | `GET /practice/driver`, `GET /practice/summary` (with labs by type), `GET /practice/in-progress`, `GET /practice/problems` (`type`, `status`, `difficulty`, `language`, `topic`, `q`), `GET /practice/problems/:slug`, `POST …/run`, `POST …/submissions`, `GET …/submissions`, `GET …/submissions/:id` (the learner's own, with code)      |
| Playground        | `POST /practice/playground/run`: Java, Python, JavaScript, PHP or SQL on the learner's own input, in the sandbox, 5 s of CPU and 256 MB (`PLAYGROUND_LIMITS`). SQL starts from an empty database. Nothing is recorded                                                                                                                       |
| Drafts            | `GET`, `PUT`, `DELETE /practice/drafts` with `scope` (`playground` or a lab's question id) and `language`: one draft per person, scope and language (`lab_drafts`). A lab the learner cannot reach is not found, so the store says nothing about labs they cannot see                                                                       |
| Staff routes      | `GET /practice/labs` (an author's own labs; a manager's, all; a reviewer's, also every published lab, read-only), `GET /practice/labs/:id/preview` and `POST …/preview/run` (the lab as learners see it; nothing recorded), `POST /practice/labs/:id/catalogue`, `GET /practice/labs/:id/attempts`, `GET /practice/runs/:id`                |
| Permissions       | `practice:use` (learners), `questions:read` (the staff list and preview), `practice:publish_own` (own labs into the catalogue; `practice:manage` for any, on the question bank's route), `practice:review` (attempts and submissions: `batch` for trainers, `all` for admins). Outside the reviewer's scope a submission is not found       |
| Running           | Everything runs in the sandbox runner (ADR-0016). Run tries the visible cases (or the learner's own input; not for a web lab) and records nothing. Submit runs every case, is recorded in `execution_runs` with context `practice`, and counts as solved when every case passes on a trusted driver                                         |
| Limits            | One run at a time per person (`ExecutionGate`, 429 `execution_in_progress`, held in this process). Rate limits per person: runs and playground 30, submissions 20 and draft saves 120 in five minutes. A web bundle's files hold 20,000 characters each                                                                                     |
| Lab lessons       | The courses module opens a lab from a lesson (`/lessons/:id/lab…`), with the lesson's own access rules; passing it completes the lesson. The progress module listens for `execution.completed` and completes every lab lesson that opens the lab, wherever it was passed                                                                    |
| Events            | `execution.completed` `{ runId, questionId, userId, context, verdict, trust }`                                                                                                                                                                                                                                                              |
| Logs              | A run is logged at debug and a submission at info with the person, the lab, the language, the verdict and the time — never the code, a case or a check                                                                                                                                                                                      |
| Module flag       | `module.practice`, off by default for a new institute (operating rule 35); SI Academy's configuration turns it on                                                                                                                                                                                                                           |
| Tests             | `test/labs.e2e-spec.ts` (the twelve-step journey, drafts, the gate, review scope, lab lessons, refusals), `test/assessment.e2e-spec.ts` (practice judging); `apps/runner/src/labs.sandbox.spec.ts` (web checks and SQL restrictions in real containers); `apps/web/e2e/labs.spec.ts` (the journey and the preview's isolation in a browser) |

## Web labs (ADR-0019)

A web lab's page is shown in the browser and judged in the sandbox. The preview (apps/web,
`lib/labs/web-preview.ts`) is a `sandbox="allow-scripts"` srcdoc frame under its own policy: it has
an opaque origin, so no cookies, storage, forms, popups, navigation or network, and it decides
nothing. A check runs in the sandbox image: `infra/sandbox/web/webpage.js` loads the page in jsdom,
runs its scripts and the check's steps, and prints only a snapshot of the page; the harness then
stops every process the page left behind, and `webcheck.js`, which runs none of the page's code,
decides each check against the snapshots. A page that subverts jsdom can only misdescribe itself:
it is never given what a check expects.

## Phases 3 and 4 (3 October 2026)

- **Staff views** of a lab's attempts and runs go through `readableLab` (SEC-05).
- **Debugging and web labs in assignments (TRN-11).** The visible-check wording is one shared
  helper (`webCheckViews`), used here and by assignments; the Labs' debugging note, check list and
  check results now live in the web app's shared workspace module.
