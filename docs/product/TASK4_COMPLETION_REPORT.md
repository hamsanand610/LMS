# Task 4 — Assignments: completion report

1 October 2026, sessions 11 to 13 (see `docs/PROGRESS_LOG.md`). Plan and gap analysis:
`TASK4_ASSIGNMENTS_GAP_ANALYSIS.md`. Decision record: ADR-0016 (proposed).

## Status

**TASK 4 — ASSIGNMENTS MODULE: COMPLETE**, implemented and verified on this machine, and committed
locally (session 13). The release gate passed everything that can run here; pushing, CI and the
staging deployment could not run because no Git remote is configured (see Release gate). ADR-0013
to ADR-0016 await the client's approval.

## Implementation

- **One assignment model**: assignment → modules (topic, due offset, gating) → placements of bank
  questions (marks); publications to a batch or to named learners with open, due and close dates;
  resources; instructions, pass mark, attempts, late and explanation policies.
- **Nine question types in one submission model**: single choice, multiple choice, true/false,
  written, coding, SQL, file upload, practical, project.
- **Learner status computed on the server**: upcoming, not started, in progress, submitted,
  passed, failed, completed, overdue, locked.
- **Workspace** for every type: CodeMirror 6 editor (Java, Python, JavaScript, PHP, SQL), Run,
  Submit, history and feedback; tabs, a sticky action bar and a console sheet on phones.
- **Staff**: builder (structure, details, resources, publishing, progress with struggling
  learners, reviews), review queue and review page, analytics, question editor for all types with
  a sandbox check before publishing.
- **Sandbox runner** (`apps/runner`, `infra/sandbox`) wired into staging, CI and the deploy
  workflow; the browser runner is gone.
- **Content**: 151 original SI Academy questions (47 coding and SQL) and 14 assignments across the
  programme's tracks; every reference solution proved in the sandbox.

## Student flow

Assignment list (summary, search, filters, sorting, paging) → assignment page (rules, resources,
modules, status) → question workspace (statement, examples, hidden-case count) → Run (visible cases
or own input; nothing recorded) → Submit (immutable record; objective answers marked at once, code
queued and checked against every case, written and hand-in work sent for review) → result (verdict
per visible case; hidden cases as verdict and cost only) → submission history (every attempt,
reopenable) → trainer's decision and comment → progress and dashboard figures.

## Trainer flow

Question bank (author, check the reference solution in the sandbox, publish) → assignment builder
(structure, details, resources) → publish to their batches or named learners with dates → progress
(per learner, struggling learners) → review queue → review page (answer, every case including
hidden ones, mark scheme, every attempt) → decision (marks, approve, or ask for another attempt
with a comment; append-only) → learner sees the feedback. A trainer reaches only the batches and
learners they teach.

## Admin flow

The trainer flow across every batch, plus assignment analytics (totals, finished share, average
score, pass rate, waiting for review, overdue, submissions per week, by course, topic, question and
author), the "Assignment status" report with filters and export, Settings › System health and
Integrations (both report the sandbox that is really running).

## Sandbox

- **Languages**: Java 21, Python 3, JavaScript (Node.js), PHP, SQL (SQLite, in-memory, per case).
- **Model**: learner → API → runner (bearer token, constant-time check) → one throwaway container
  per job → result → API compares → learner. The API never runs learner code.
- **Isolation**: no network, read-only root, all capabilities dropped, no-new-privileges, user
  `65534`, 128 processes, 256 files, memory without swap, one CPU, size-limited tmpfs, no logging,
  `--pull never`, `--rm`, a job deadline; a queue with a concurrency limit (503 when full).
- **Hidden tests**: a job carries inputs only; expected outputs never leave the API. Learners see
  hidden cases as a verdict and a cost; reviewers see everything.
- **Time**: judged on CPU time (limit plus runtime start-up), so a cold or busy host cannot fail a
  correct answer; a wall-clock backstop (twice that plus 2 s) stops code that waits.
- **Outage**: Run answers 503 with a message to try again; a submission stays "being checked" and
  is evaluated when the runner returns.
- **Staging**: the runner runs as a container on the VM's Docker socket, in the docker group,
  read-only, without capabilities or a published port; only the API reaches it.

## Security

Verified in code, tests and live calls: no secrets in source (all from validated environment;
local defaults refused outside local); argon2id (64 MiB, 3 passes); httpOnly cookies, SameSite,
Secure outside local, CSRF header on mutations; every route public or permission-checked (route
table test); object-level checks (another learner gets 404, a trainer of another batch 403, a
learner 403 on staff routes); hidden cases and mark schemes never in learner responses; upload
type sniffing; sanitised lesson HTML and text-only rendering of authored content; http(s)-only
links; CSP without `unsafe-eval`, frames and objects disallowed, `X-Frame-Options: DENY`, nosniff,
Referrer- and Permissions-Policy, HSTS on the API; 1 MB request bodies (6 MB for imports), 4 MB
jobs; problem+json errors without stack traces; sign-in, Run and Submit rate limits; secrets and
cookies redacted from logs; the sandbox isolation above.

## Database and API

Eight migrations (Task 4: `20260930120000_task4_assignments`); a freshly migrated database matches
`schema.prisma` exactly. Models: `Question`, `QuestionOption`, `CodingProblem`, `TestCase`,
`QuestionVersion`, `Assignment`, `AssignmentModule`, `AssignmentQuestion`, `AssignmentPublication`,
`AssignmentResource`, `Submission`, `SubmissionResult`, `SubmissionReview`, `ExecutionRun`.
Endpoints: staff `/assignments…`, reviews `/submissions…`, learner `/me/assignments…` and
`/me/submissions…` (listed in `apps/api/src/modules/assignments/README.md`). Persistence verified:
immutable submissions, append-only reviews, idempotent submit, evaluations recorded with verdict,
cases, time and memory.

## Tests (final runs, one at a time)

| Check                        | Result                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Typecheck, lint              | 9/9 packages                                                                               |
| Unit                         | 220: shared 77, runner 16, web 4, API 123                                                  |
| API end-to-end               | 17/17 files, 223 tests (assessment 38, tests 17, permissions 12, settings 6, and the rest) |
| Production build             | 6/6 packages                                                                               |
| Schema drift                 | none                                                                                       |
| Runner, real containers      | 13/13                                                                                      |
| Question bank in the sandbox | 101/101 language runs                                                                      |
| Live API + runner checks     | 58/58, outage 8/8                                                                          |
| Browser sweep                | 498 views, then 190 after fixes: no console errors, failed calls, error screens            |
| Loading and error states     | 32/32                                                                                      |
| Playwright journeys          | desktop 59 passed, phone 59 passed; 4 one-time journeys skip by design                     |

## Browser

Widths 360, 390, 768, 1024, 1280, 1440, 1920, light and dark: 35 pages (learner list, empty and
missing states, assignment page, workspaces for objective, coding, SQL, written and hand-in
questions, practice, progress, dashboard; staff lists, the builder and each of its tabs, reviews, review
pages, analytics, question bank and editor, report, System health, Integrations).

## Release gate (session 13)

| Step             | Result  | Evidence                                                                                                                                          |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository audit | PASS    | 515 changed paths, all intended Task 1–4 work; no QA files, session state, logs or screenshots; `.gitignore` covers `*.env`, `**/.auth/`, `*.har` |
| Security audit   | PASS    | No secrets in the change set: only the published local defaults, CI's throwaway values and test placeholders                                      |
| ADR review       | PASS    | ADR-0013 to ADR-0016 match the code; ADR-0007, ADR-0011 and gap analysis §5.2 now point at ADR-0016                                               |
| Docker           | PASS    | LMS PostgreSQL, MinIO and Mailpit healthy; volumes intact; sandbox and runner images present                                                      |
| Sandbox          | PASS    | 13/13 real-container tests; 101/101 reference solutions; a job through the hardened runner image                                                  |
| Local checks     | PASS    | Typecheck 9/9, lint 9/9, unit 220, API e2e 17/17 files and 223 tests, build 6/6                                                                   |
| Git commit       | PASS    | Local commits on `main`: product code, CI and staging, documentation, preview launch configurations, the generated OpenAPI document (see the log) |
| Push             | BLOCKED | No Git remote is configured, and the brief forbids changing remote configuration                                                                  |
| CI               | NOT RUN | Needs a push; the workflows were validated locally (jobs, images, runner in smoke)                                                                |
| Staging          | NOT RUN | No remote or staging VM; the resolved compose file was checked: runner internal-only and hardened, API on the runner, token required              |

## Databases

| Database       | Role                                | State                                                                                                                                           |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lms`          | Main (`apps/api/.env`)              | **Not reset.** Phase 6 "Demo Institute" data: 79 `demo.local` accounts, 132 questions, 10 assignments; 7 of 8 migrations (Task 4's not applied) |
| `lms_task4`    | Task 4 preview (`api-runner-task4`) | SI Academy seed, all 8 migrations                                                                                                               |
| `lms_task4_qa` | Automated browser checks            | SI Academy seed plus test runs; its generated passwords were deleted; can be dropped                                                            |
| `lms_test`     | API e2e tests                       | Rebuilt by the test setup on every run                                                                                                          |

`pnpm demo:reset` on `lms` would drop and recreate every table, apply the 8 migrations, and seed SI
Academy (organisation, roles, branding, 71 accounts on `siacademy.example`, courses, the question
bank and assignments) plus the Super Admin; it does not clear MinIO. It waits for the client's
approval (and Prisma refuses it to agents without explicit consent).

## Not delivered in Task 4

Quiz-linked modules, question bookmarks and discussions, and seeded hand-ins with uploaded files.
System health shows the client overlay key `demo` (kept by the Task 2 decision).

## Technical debt

| Priority | Item                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Blocker  | None in the code. The push, CI and staging steps above need a Git remote and a staging VM                                       |
| High     | Prove CI and staging outside this machine; CI builds `linux/amd64` images, so an Arm VM needs arm64 builds                      |
| Medium   | Request bodies sent without `Content-Length` are capped by the 6 MB parser limit instead of 1 MB                                |
| Medium   | `apps/api/prisma/seed/client.js` is stale compiled output that seeds load instead of `client.ts` (functionally identical today) |
| Low      | An invitation token travels in its link (kept out of logs; `Referrer-Policy` limits leakage)                                    |
| Low      | Seeded finishers are mostly the diligent learners, so analytics show 100% average and pass rate                                 |
| Low      | Sign-in allows five attempts per account per 15 minutes, successful ones included                                               |
| Low      | No generated API client (the web uses `@lms/shared` types; `api:types` is unused)                                               |
| Low      | This machine (7.2 GB RAM, Docker disk on `D:`) needs heavy checks run one at a time                                             |

## Recommended next phase

1. **Finish the release steps that need the client**: approve ADR-0013 to ADR-0016, configure a
   Git remote and push, let CI run, deploy staging once with the runner, approve `pnpm demo:reset`.
2. **Next module, from the roadmap's future phases**: Labs and Playground, built on the sandbox
   runner just delivered. Not started.

## Proposed next-task scope (to confirm before starting)

- **Code playground**: run Java, Python, JavaScript or PHP with custom input in the sandbox; no
  grading; per-user rate limit; recent snippets kept.
- **SQL lab**: practice datasets with schema browser; queries run in the sandbox's SQLite; result
  tables; saved queries.
- **Web lab**: HTML, CSS and JavaScript editor with live preview in a sandboxed `iframe`; lab tasks
  handed in as practicals and reviewed.
- **Debugging exercises**: coding questions with broken starter code and hidden tests.
- **Staff**: lab authoring and usage figures; navigation and a feature flag (off in production
  until approved).
- **Out of scope**: Judge0, AI assistance, certificates.
- **Done when**: unit, API and journey tests, sandbox tests, browser sweep at all seven widths in
  both themes, and a security review of the preview `iframe`.
