# Development progress log

One entry per working session. Newest first. IDs refer to the master report (F-/P-/Q-), the architecture plan (M-/DP-/J-/D-/DQ-) and the backlog (BL-). From 2 October 2026 phases are those of the active roadmap (`docs/ROADMAP.md`), written "Roadmap Phase N"; earlier entries use the original plan's foundation phases and the client's Tasks 1–4.

## 2026-10-03 (session 27) — Roadmap Phase 6: code quality and security hardening

**Brief.** The client's Phase 6 brief: a full security and code-quality pass — authentication,
sessions, authorisation, privacy and storage, validation, robustness, audit, jobs, concurrency, rate
limits, dependencies — in the order inspect, identify, prioritise, harden, test, regress, document,
commit; the known items (a suspended account and invitations, session revocation, the privacy
request workflow, the former trainer's `/me`, certificate fonts, browser-facing storage addresses,
remaining authorisation and concurrency findings); no Phase 7, no AI, no infrastructure added, no
push. From `3484cfc`; findings, decisions P6-1–P6-11 and the record:
`docs/phases/PHASE-06-hardening.md`.

**Built** (thirteen commits, `306f3e2`..`6466af7`, and this record). Access tokens end with their
session family; refresh keeps the family, the sign-in's lifetime and its remember-me choice, with a
30-second grace for two tabs refreshing together (`sessions.persistent`, `sessions.rotated_at`).
Invitations activate only invited accounts and reset links only active ones, each claimed once,
ending its siblings and sent at once rather than queued; a cross-site sign-in is refused by its
origin. Signed links name only public hosts (`S3_PRESIGN_ENDPOINT`; refused otherwise), SVG is gone
from shared images and `/files` serves only the public bucket, sandboxed; files go with the résumé,
photo or export that held them; only the uploader deletes through the files route; stored
integration secrets are sealed. Edits change only what they name (Zod 4 nested defaults); windows
compare instants; database rules a request breaks answer 409 or 404, not 500. Queued exports and
imports run as their requester is now; the last Super Admin is kept under a lock; announcements,
results releases and drive openings notify once; codes are allocated by number. Per-person limits
count the verified person, a successful sign-in is not counted, costly routes have limits. A former
trainer is no longer counted in the batches they taught. `next` 16.3.6 and `multer` ^2.4. One
additive migration, `20261006090000_phase6_hardening`.

**Verified.** Type-check and lint clean in every package; unit 316 (shared 124, runner 16, API 163,
web 13); API end to end 36 files and 477 tests in the final run, all passing (three new specs — auth-hardening, hardening, concurrency — and every
earlier suite as regression); the permission matrix unchanged (72); every tracked file formatted.
Browser, on the production build against a copy of the migrated `lms`, Chromium, all 11 suites (101
tests): 98 passed, 2 skipped by design, 1 passed on its retry (the trainer's question-bank search
box was not editable on the first attempt; the suite alone passed it cleanly); after the last two
fixes, five suites again on a rebuilt stack, 40 passed. Role journeys for all six roles against the
same API, 37 checks passed. The phone project was not run: no layout changed.

**Main local database (`lms`).** Backed up first (`E:\LMS-backups\lms-before-phase6.dump`, 570,890
bytes, SHA-256 beside it), restored into a scratch database and compared — all 79 tables, 4,315
rows, identical — and the scratch copy dropped. Target checked (`lms`, port 5433); one pending
migration. `db:migrate` applied `20261006090000_phase6_hardening` (13 of 13, none failed); both
columns present. Compared row by row over each table's earlier columns: 78 tables unchanged, the
migrations table one row more (4,315 → 4,316). The ET-EMS and SLTS containers: the same set,
stopped, same start and finish times before and after; every other database on the LMS server
untouched; the QA copy `lms_phase6_qa` dropped after the browser runs.

**Deferred**, each with its phase in the record (§6): a shared store for limits and caches (12), a
public storage host on staging and a least-privilege storage user (14), a CSP nonce for the web app
(12), the learner's privacy request queue (13), certificate fonts beyond Latin-1 (13), upload
scanning (14), an append-only trigger for the audit log (12), streaming for very large reports
(12), Prisma's parallel sub-queries on a transaction connection before pg 9 (12), and the tooling
advisories `pnpm audit` still reports (12). Found on the way and flagged as its own task: the
Branding page's font select shows no value.

**Not pushed.** The phase's commits stay local until the client decides the gate.

## 2026-10-03 (session 26) — Phase 5 approved and pushed

**Approval.** The client approved Phase 5 and accepted it as complete on 3 October 2026, and asked
for the final gate only: nothing further built, Phase 6 and AI not started.

**The gate.** The working tree was clean, `HEAD` was `3484cfc` and `origin/main` had not moved from
`9369b50`. The push of `9369b50..3484cfc` (the first pass, the completion pass and its record) was
a fast-forward, with the pre-push type-check and unit tests passing; afterwards the local `HEAD`,
`origin/main` and GitHub's `main` were the same commit,
`3484cfc5e5856a679b7865323d3df0d480c29ca8`. The push started the CI workflow on `main`; its result
could not be read from this machine (no `gh`, and the repository is private). The ET-EMS and SLTS
containers: the same set, stopped, with the same start and finish times; `lms` as the Phase 5
migration left it.

**Records.** The roadmap and the phase record were brought up to date with Phase 6's record
(session 27): Phase 5 complete and approved.

## 2026-10-03 (session 25) — Roadmap Phase 5: the final completion pass

**Brief.** The client stopped the Phase 5 gate and asked for every item the first pass had deferred
to be finished inside Phase 5 — deactivated accounts, completed and archived batches, reconciliation
of asynchronous effects, the list-read timeout, concurrent publication, notice read state, staff
search for labs and questions, a learner's document search, overdue notices — each inspected and
defined against the existing rules first, product questions settled by the safest consistent
behaviour and documented; no push, no Phase 6, no AI. From `637265d`; findings C1–C9, decisions
P6–P14, the lifecycle rule and the record: `docs/phases/PHASE-05-integration.md` §5–§8.

**Built** (eleven commits, `5beb8ba`..`88803ed`, and this record). List reads outside transactions
(21 lists; the 5-second limit is not raised). One live publication per audience, kept by partial
unique indexes (courses and assignments; racers answered `409`). One lifecycle in
`EnrollmentService`: deactivation ends batch places as a removal does and reactivation gives them
back (under the batch-row lock, once); archived batches and programmes end what they gave; completed
courses are never withdrawn; withdrawn courses neither complete nor certify; delivery skips
deactivated and erased accounts. `progress.reconcile` every 15 minutes, idempotent and audited,
failing the job when a learner cannot be settled; the certificates sweep no longer redraws revoked
certificates or issues to erased accounts. Overdue notices and per-learner due-soon notices from
`learnerState`, sent once (dedupe keys; queued deliveries keyed too). Opening a page reads the
notices that lead to it (`@ReadsNotices`, `POST /me/notifications/read-page`, the centre for
announcements). Staff search for labs and the question bank; a learner's Documents. One additive
migration, `20261005090000_phase5_integration`.

**Verified.** Type-check and lint clean in all six packages; unit 293 (shared 113, runner 16, API
151, web 13); API end to end 33 files and 437 tests in the final run (the six new specs —
list-reads, lifecycle, reconciliation, deadlines, notice-reading, search-reach — and the race tests
among them, every earlier suite as regression); the permission matrix unchanged (72); formatting
clean in every tracked file. Browser, on the production build against copies of the migrated `lms`,
Chromium, every suite (11 files, 95 tests): 93 passed and 2 skipped by design; one passed on its
retry (the engagement streak test: the learner's session was refused by the web server's own `/me`
check for a minute, before the page asked for its dashboard). After the last API fix, the two suites
that create learners again: 20 passed, 1 skipped. The phone project was not run: no layout changed.
Two older specs made the suite pass or fail by the clock and by file order, and this pass's runs
exposed both: the Phase 2 learner spec left a class two days ahead on the shared trainer's
timetable, which clashed with the sessions spec's morning series (reproduced at 10:47, fixed), and
the Task 2 engagement spec gave a learner a STU-2026-<six digits> code that derailed the year's code
sequence for the students spec (fixed).

**Main local database (`lms`).** Backed up first (`E:\LMS-backups\lms-before-phase5.dump`, 568,656
bytes, SHA-256 beside it), restored into a scratch database and compared — all 79 tables, 4,314
rows, identical — and the scratch copy dropped. Target checked (`lms`, port 5433). `db:migrate`
applied `20261005090000_phase5_integration` (12 of 12, none failed); the five indexes and the
nullable `notifications.dedupe_key` are present. Compared row by row over each table's earlier
columns: 78 tables unchanged, the migrations table one row more (4,314 → 4,315). The reconciliation
job has not run on `lms` (no API ran on it); on a copy of it, after the browser runs, its first run
made one enrolment, whose cause — a new learner made without a batch was not enrolled in what is
published to everyone — is fixed (`c667ad5`). The ET-EMS and SLTS containers: the same set, stopped,
same start and finish times as at the Phase 2 gate; every other database on the LMS server
untouched.

**Not pushed.** The phase's commits stay local until the client decides the gate.

## 2026-10-03 (session 24) — Roadmap Phase 5: cross-module integration built and verified

**Brief.** The client's Phase 5 brief (strict two-hour autonomous window, from `9369b50`):
cross-module correctness, data consistency, authorisation and scope integrity, workflow continuity,
notifications, search, report consistency and audit, verified rather than broad; no Phase 6, no AI,
no new infrastructure, no UI redesign. Plan, gaps, decisions P1–P5 and the record:
`docs/phases/PHASE-05-integration.md`. Received at 06:43 IST; built and verified by 08:00.

**Found and fixed** (each with API end-to-end tests): the dashboard counted course progress
differently from the progress report, and a trainer's dashboard showed another batch's course and a
shared learner's progress in it (D6); removing the learner role left the person's batch places
(rosters, roll calls, batch notices); new content could be given to an archived batch or programme;
staff search found no courses, assignments or tests and sent trainers' hits to admin pages; a
doubt's answer stayed unread in the bell after the thread was read. No migration, no new dependency,
no new infrastructure; the existing events, audit log and list services were reused.

**The integration spec** (`apps/api/test/integration.e2e-spec.ts`, 8 tests) follows one learner
across the modules and asks each side what it sees. Its first full-suite run failed once on an
order-dependent assertion (a course another spec left on the other batch reached the transferred
learner, as it should); the test now creates that condition itself and asserts it.

**Verified.** Type-check and lint clean in all six packages; unit 293 (shared 113, runner 16, API
151, web 13); API end to end 27 files and 405 tests (the 26 earlier files and the integration spec,
with every role-boundary, object-scope and Phase 1–4 suite as regression); the generated permission
matrix unchanged (72 permissions); formatting clean in every tracked file. Browser, on the
production build against a copy of `lms` (`lms_phase5_qa`, dropped afterwards), Chromium, every
suite (11 files, 95 tests): 93 passed and 2 skipped by design, the three journeys first (31 passed;
the phone layout skipped). The Labs suite failed once while the machine was starved of memory (the
sandbox runner gave up after 55 s; in the same minute two assignment-list reads hit Prisma's
5-second transaction limit, recorded for Phase 6) and passed 10 of 10 run on its own. The phone
project was not run: no web code changed in this phase. The OpenAPI document is re-committed in the
order the new module imports give it (the same 253 paths, equal once key order is ignored).

**Main local database (`lms`).** No migration and no seed in this phase; compared read-only with the
snapshot taken at the Phase 3–4 approval: 11 migrations applied, none failed, the newest still
`20261004090000_phase3_4_staff_and_operations`; all 79 tables row for row as they were (4,314 rows).
No backup was needed: nothing was written to it. The ET-EMS and SLTS containers: the same set,
stopped, with the same start and finish times as at the Phase 2 gate; the LMS containers were not
restarted either.

**Not pushed.** The phase's commits stay local until the client decides the gate.

## 2026-10-03 (session 23) — Phases 3 and 4 approved; ADR-0023 accepted; pushed

**Approvals.** The client approved and closed Phases 3 and 4 and approved ADR-0023 (course staff,
with its amendment of ADR-0009) on 3 October 2026. Phase 5 and any AI work wait for the client's
explicit approval.

**Checked again before the push** (read-only on `lms`, which the client asked to keep as
verified): the backup `E:\LMS-backups\lms-before-phase3-4.dump` still matches its SHA-256; 11
migrations applied, none failed or rolled back, the newest
`20261004090000_phase3_4_staff_and_operations`; all 79 tables row for row as after the migration
(4,314 rows); the working tree clean; GitHub's `main` still `3f9ec2c`. The ET-EMS and SLTS
containers: the same set, stopped, with the same creation and start times as before the phase.

**Cleaned up.** The QA copy `lms_phase34_qa` (no connections, its servers stopped) was dropped;
`lms` and every other database on the LMS server were left as they were.

**Pushed.** This record goes to `origin/main` with the 33 commits of Phases 3 and 4 and the two
Phase 2 records made after that phase's push (`4251a15`, `0684c21`), as a fast-forward from
`3f9ec2c`.

## 2026-10-03 (session 22) — Roadmap Phases 3 and 4: the trainer and the administrator completed

**Brief.** The client's combined Phase 3 + Phase 4 brief (autonomous): complete the trainer and
staff side and the administration and operations side, verify with role-boundary, object-scope,
cross-role and direct-API tests, browser journeys on a desktop and a phone, and the Phase 1 and 2
suites as regression; stop at the gate. Plan, five read-only audits, decisions D1–D10, items and
the record: `docs/phases/PHASE-03-04-trainer-and-admin.md`. Received at 00:21 IST; built,
verified and the main database migrated by 06:00.

**Built.** P0 security and data integrity first (SEC-01 to SEC-07: every route's role boundary,
tests and questions fixed once answered, no privilege granted by someone who lacks it, one path
into a batch, the trainer's reach from taught batches only, audit gaps closed, flag audiences on
the server). Then the trainer (TRN-01 to TRN-12: dashboard, batches and students, course staff
with lesson editing, attendance corrections, test windows and re-marking, late work, doubt
notices, announcements, report links, feedback, debugging and web labs in assignments, Run inside
timed tests) and the administrator (ADM-01 to ADM-13: unlock and sessions, the learner record,
batch and programme editing, individual enrolment, certificate administration, four new reports,
applicants' résumés and export, flag audiences, audit filters and export, failed jobs, privacy
export and erasure, retention, the certificate signatory). One migration
(`20261004090000_phase3_4_staff_and_operations`, additive); ADR-0023 (course staff, amends
ADR-0009) proposed; the permission matrix generated from the code
(`docs/architecture/PERMISSION_MATRIX.md`); a runbook (`docs/runbooks/operations.md`).

**Security review.** An independent read-only review of the whole change found two medium and
five low issues; all are fixed with tests (plan §6): a trainer's filter reaching a co-trainer's
figures, feedback figures that date ranges could narrow to one answer, learners' names shown to
course staff outside their batches, practice lessons embedding others' questions, certificates
outside course reach, a former trainer's views, and — wider than reported — Zod 4 filling defaults
into every partial update (a course settings save wiped its tags and picture).

**Verified.** Type-check and lint clean in all six packages; unit 293; API 26 files and 397 tests;
role boundaries on every route for five roles; sandbox 27; question bank 53 questions and 107
runs; browser on the production build: Chromium 96 passed (2 skipped by design), phone 97 passed
(1 skipped); the new staff journeys on both. The browser regression found one regression (a
correction's reason hidden by TRN-04), fixed.

**Main local database (`lms`).** Backed up first (`pg_dump`, custom format, outside the
repository: `E:\LMS-backups\lms-before-phase3-4.dump`, 556,101 bytes, SHA-256 beside it). The
backup was restored into a scratch database and all 75 tables (4,289 rows) matched the live
database, row counts and content fingerprints; the scratch copy was then dropped. `db:migrate`
applied `20261004090000_phase3_4_staff_and_operations` (11 of 11). Only the base seed ran.

- **Compared row by row (4,289 → 4,314):** 69 tables unchanged (users, students, enrolments,
  progress and submissions among them). Changed as intended: the migration record; four new, empty
  tables (`course_staff`, `attendance_corrections`, `feedback_forms`, `feedback_responses`); six
  permissions with their 16 role grants, and three permission descriptions refreshed; the
  `module.feedback` flag (on, as SI Academy's configuration says); the two RBAC settings (the
  watermark and the applied bundle changes). Flags and roles otherwise changed only their update
  times: no flag was switched and no role renamed.
- **Not touched:** the ET-EMS and SLTS containers (same set, same creation and start times) and
  every other database on the LMS server. The QA copy `lms_phase34_qa` was used for the browser
  runs.

**Not pushed.** The phase's commits stay local until the client approves the gate.

## 2026-10-03 (session 21) — Phase 2 approved; the main database migrated; Phase 2 pushed

**Approvals.** The client approved the Phase 2 gate and ADR-0022 on 3 October 2026; ADR-0022 is
accepted. The client then approved Phases 3 and 4 as one combined batch (trainer and staff
completion, admin and operations completion), started the same day.

**Main local database (`lms`).** Backed up first (`pg_dump`, custom format, outside the
repository: `E:\LMS-backups\lms-before-phase2.dump`, 551,234 bytes, SHA-256 beside it). The backup
was restored into a scratch database (`lms_backup_check`), and all 74 tables (4,282 rows) matched
the live database, row counts and content fingerprints. `db:migrate` applied
`20261003090000_phase2_learner_experience` (10 of 10, up to date). Only the base seed ran
(`db:seed`): it added `certificates:read` with its four role grants and the
`module.certificates` flag (on, as SI Academy's configuration says). The demo seed was not run:
Phase 2 adds no sample content, and it would re-date the sample history and reset the 71 sample
accounts.

- **Compared row by row:** 67 of 74 tables unchanged (users, students, the 240 enrolments, progress
  and submissions among them). Changed as intended: the migration record, the empty certificates
  table, the permission and its grants, the flag, the one practice lesson (`manual` to `pass`)
  and the seeded-permissions setting. Flags and roles otherwise changed only their update times,
  and the Labs flag's description was refreshed from its manifest; no flag was switched.
- **Not touched:** the ET-EMS and SLTS containers (identical start and stop times) and every other
  database on the LMS server.

**Pushed.** The nine Phase 2 commits (`4d0d353` to `3f9ec2c`) went to `origin/main` as a
fast-forward from `aad481c`; the pre-push hook passed (type-check 9 of 9, unit 279). GitHub's
`main` is `3f9ec2c`. CI's result could not be read from this machine.

**Found after the gate and fixed.** On a fresh database the demo seed created its practice lesson
with the `manual` rule, which Phase 2 no longer allows (D3); it now creates it with `pass`. The
main database was not affected (its lesson already existed and the migration moved it).

## 2026-10-02 (session 20) — Roadmap Phase 2: the complete learner experience built

**Brief.** The client's Phase 2 brief ("Phase 2 — Complete all learner modules"): audit all 19
learner modules, complete them, verify journeys J1–J18, stop at the gate. Plan, audit, decisions
D1–D8, items LRN-01 to LRN-23 and the record: `docs/phases/PHASE-02-learner-experience.md`.

**Audit first.** Every module was read end to end before any change (§1 of the plan): one broken
outright (lessons: the player's remount loop, client-asserted watch time), tests leaking the key
during an attempt, answer keys leaking under `after_due`, certificates missing, and partial flows
everywhere else.

**Built.** Server-measured watch time and completion rules per lesson type (D2, D3); one progress
model recomputed on outline changes (D1); course access per ADR-0010's own remedy, with
`withdrawn` enrolments (D4); certificates with a PDF and a public check (ADR-0022, proposed);
Projects, Certificates and Attendance pages; deadlines on the schedule; the dashboard's activity,
notifications, Labs and certificates; answer keys and scores never early (D7); late work recorded;
the attempt limit safe under races; notices for classes, due work, closing tests, reviewed
documents and certificates; search limited to what the caller can reach; documents downloadable by
their owner; a lost stored file answered as "not found".

**Security review.** An independent read-only review of the whole change found ten issues; eight
are fixed with tests, two are recorded (plan §7): join links readable early through other routes,
a test's key opening per batch rather than per test, per-question results before the window
closed, watch credit earned per lesson in parallel, the password-change limit counted per session,
duplicate certificate notices under a race, doubts on a course left behind, and the verify page's
session forwarding.

**Verified.** Type-check and lint clean; unit 279; API 295 (19 files, real PostgreSQL); sandbox
27; question bank 53 questions in 107 runs; browser: every spec passes on Chromium and the phone
(seven flaky under memory pressure, all passed on retry; two journey selectors fixed and rerun,
plan §7); build of every package; the
migration applied to a copy of the local sample data (`lms_phase2_qa`), changing only the one
practice lesson's rule. The QA copy, its fixture and the temporary launch entries stay outside the
repository; the main `lms` database was not touched, nor any ET-EMS or SLTS database or container.

**Not done here.** The main `lms` database is not migrated (it needs the client's go-ahead, as in
Phase 1); nothing is pushed.

**Next.** The Phase 2 gate: the client's approval of the phase and of ADR-0022. Phase 3 has not
started; AI implementation has not started.

## 2026-10-02 (session 19) — Phase 1 approved; the main database migrated; Phases 0 and 1 pushed

**Approvals.** The client approved the Phase 1 gate and ADR-0018 to ADR-0021 on 2 October 2026; the
four ADRs are accepted. Phase 2 has not started: it begins only on the client's explicit approval.

**Main local database (`lms`).** Backed up first (`pg_dump`, custom format, outside the
repository). `pnpm --filter @lms/api db:migrate` applied `20261002120000_phase1_labs` (recorded as
finished and not rolled back; `migrate status`: up to date, 9 of 9), then
`pnpm --filter @lms/api db:seed:demo` ran cleanly. Checked afterwards:

- **Phase 1 is there:** the six labs (three debugging, three web) published, validated and in the
  catalogue, with 31 cases; the two lab lessons, last in Core Java › The language and in Web
  Development › HTML, completed on `pass`; `practice:publish_own` and `practice:review` granted by
  role bundle (trainer, admin, content manager, Super Admin); `module.practice` on; `lab_drafts` in
  place and empty.
- **Existing data:** compared row by row with a snapshot taken before (72 tables, 4,172 rows), no
  row was removed. The migration changed no row. The seed changed existing rows only as every run of
  it does: the sample history's dates moved forward a day or two to centre on today; two past
  classes had their roll call marked (40 marks) and two of today's moved to completed; four
  enrolments' percentages fell a little (61 to 58, for example) because their courses gained a lab
  lesson; and the 71 sample accounts were reset, their password set again to the seed password that
  every one of them already had (checked against the old hashes) and their token versions moved on
  (no account was signed in). The Super Admin was not touched.
- **Correction to session 18:** on an existing database the demo seed is not "additive, nothing
  else"; the runbook (`docs/runbooks/local-setup.md`) and the phase record now say what it
  refreshes.
- **Not touched:** the ET-EMS and SLTS containers (same state, start and stop times), every Docker
  volume, the list of databases on the LMS server, and the separate PostgreSQL on port 5432.

**Pushed.** The eight commits of Phases 0 and 1 (`de31792` to `2df44a9`) went to `origin/main` as a
fast-forward from `74824f5`; the pre-push hook passed (type-check 9 of 9, unit 237). GitHub's `main`
is `2df44a9`, the same as the local branch. The push starts CI; its result could not be read from
this machine (no `gh`, and the repository's API needs signing in).

**Commits.** This entry and the approval records are committed on top of `2df44a9`; pushing them
waits for the client's go-ahead.

**Next.** Phase 2 — Complete student experience — waits for the client's explicit approval.

## 2026-10-02 (session 18) — Roadmap Phase 1: Labs and Playground built

**Brief.** The client's Phase 1 brief ("Phase 1 implementation — Labs & Playground"), with the
course-placement decision of the same day (admins and content managers place labs; trainers write,
check, preview and publish their own). Plan, assessment and ADR-0018 to ADR-0021:
`docs/phases/PHASE-01-labs-and-playground.md`.

**Built.**

- **The Labs** (`modules/practice`, key kept): coding, SQL, debugging and web labs as question-bank
  questions; a hub by kind with continue-where-you-left-off; the playground (Java, Python,
  JavaScript, PHP, SQL); drafts kept on the server; a staff page with preview, catalogue and
  attempts within the reviewer's scope (`practice:publish_own`, `practice:review`).
- **Debugging labs:** what the fixed program does; validation needs the fix to pass and the code
  with the bug to fail.
- **SQL Lab:** a schema browser read in the sandbox; a case's own rows now run under the authoriser
  and the step budget (ADR-0020).
- **Web Lab** (ADR-0019): three editors, a sandboxed srcdoc preview with its console, and checks in
  the sandbox — the page in one program that prints a snapshot, everything it leaves stopped, then a
  checker that runs none of its code. A page that escapes jsdom cannot decide its verdict.
- **Lab lessons** (`lab`, completed on `pass`), in the lesson or from the catalogue through a
  progress listener; completion is recorded once.
- **Limits** (ADR-0021): one run at a time per person, rate limits, payload and output limits with a
  truncation flag; nothing a case starts outlives it.
- **Authoring:** the question editor writes debugging and web labs (files editor, checks builder);
  "New lab" opens it on the right type.
- **Seeds:** three debugging and three web labs, proved in the sandbox (`verified-runs.json`), and
  two lab lessons (Core Java, Web Development).

**Fixed on the way.** The question editor's in-form buttons submitted the form; the course editor
cleared a lesson's video and question when its body was opened and saved; a sessions test failed
every Friday (UTC).

**Tests.** See the plan, §7: type-check, lint, unit (237), API (246), sandbox (27), the question
bank in the sandbox (53 questions, 107 language runs), build, and the browser suite (three sign-ins
and 70 journeys): Chromium 73 of 73; the phone 69 of 73 at first, because the lab-lesson journey
read the course outline before it had loaded and left the phone's console sheet over the page, and
the three Labs journeys after it did not run. With that journey fixed, the Labs journeys passed in
full on both. The migration applied cleanly to a copy of the local sample data (`lms_phase1_qa`),
and the demo seed then added the new labs and lessons and nothing else.

**Environment.** The first browser run met Docker Desktop's port-forwarding stall again (PostgreSQL
healthy in its container but unreachable through the forwarded port, so pages waited on 30-second
database timeouts). Docker Desktop was restarted (only the LMS containers run; the other projects'
stay stopped) and the suites were run again with two workers, as on CI. The journeys sign in as the
seed's Super Admin, as CI does: two of them open settings pages that only a Super Admin may.

**Commits.** `7c30cd8` (the plan, its assessment and ADR-0018 to ADR-0021), `6a7d839` (the Labs
engine), `e829405` (the sessions test), `fec4396` (reviewers and the playground's address),
`cb22318` (the seeded labs), `6aa829b` (the Labs in the web app), and the commit holding this entry
(the phase record, the ADRs and the module docs). Nothing is pushed.

**Blockers.** None. ADR-0018 to ADR-0021 are proposed, for the client's approval at the Phase 1
gate. Phase 2 has not started.

**For the developer.** Rebuild the sandbox image (`docker build -t lms-sandbox:1 infra/sandbox`;
its first stage needs the npm registry), then `pnpm --filter @lms/api db:migrate` and
`db:seed:demo` on the local database. The scratch database `lms_phase1_qa` holds the QA runs (its
dates were moved to today with `demo:advance`; between runs one learner's pass of the Core Java lab
lesson was cleared, and once their attempt at the open test, so the journeys walked them in full)
and can be dropped.

## 2026-10-02 (session 17) — Roadmap Phase 0: product direction reset and roadmap lock

**Direction.** The client reset the product direction. SI Academy is now an enterprise learning
management and AI learning platform, a serious full-stack product, and the demo / white-label /
template framing no longer decides anything. A fifteen-phase roadmap (Phases 0–14) is the
controlling plan:

- Labs and Playground;
- the student, trainer and admin experiences;
- cross-module integration;
- hardening;
- the AI foundation, RAG, the AI Learning Agent, AI evaluation and advanced AI;
- refinement, full testing and staging.

The existing architecture is kept and evolved.

**Done.** Documentation only; no application code, configuration, data or infrastructure changed.

New:

- `docs/ROADMAP.md`: phases, gates, rules, deviation control, known decisions;
- `docs/product/PRODUCT_DIRECTION.md`;
- `docs/product/IMPLEMENTATION_ROADMAP.md`: baseline at `74824f5` with evidence, findings with their
  owning phases, and the register of the old framing;
- `docs/architecture/OVERVIEW.md`;
- `docs/architecture/AI_ARCHITECTURE.md`.

Updated:

- `CLAUDE.md` and `README.md`;
- `docs/CLAUDE_OPERATING_RULES.md`: rules 1, 2 and 45 point at the roadmap; rules 46–48 added (phase
  order, deviation control, AI guardrails);
- `docs/STACK.md`: AI technologies planned, not adopted;
- `docs/runbooks/README.md`: index.

Both original plans, their first part files and their HTML copies open with a dated status note
("historical"); their bodies are unchanged.

**ADRs.** None amended. Every decision still holds; the original framing in their context sections
is historical. The AI stack decisions are Phase 7 ADRs (`docs/architecture/AI_ARCHITECTURE.md` §9).

**Against the roadmap.**

- Built: courses, lessons, progress, schedule, attendance, assignments, timed tests, the question
  bank, coding practice on the sandbox runner, trainer review, reports and exports, documents,
  notifications, placement, doubts, settings, audit, health.
- Partial: SQL practice (no lab), projects, analytics, enrolments, feature flags, privacy operations,
  an operations view for the Super Admin.
- Missing: the playground, SQL Lab, Web Lab, debugging challenges, certificates, any AI code, vector
  support.

**Blockers.** None for Phase 1. Its open design questions (the Web Lab's preview and checking
model, the SQL Lab's engine, playground quotas) are settled by ADRs in its phase plan. Later
dependencies, none of them blocking now:

- signed storage links on staging (decide before Phase 6 closes);
- an AI provider account and keys from the client (Phase 7);
- a PostgreSQL image with pgvector (Phase 7 ADR).

**Status.** Roadmap Phase 0 is complete pending the client's review. **Phase 1, Labs and
Playground, has not been started.**

## 2026-10-02 (session 16) — ADR-0017 extended: local and staging object storage on Chainguard's MinIO

**Decision.** The client approved ADR-0017 for the object store wherever MinIO's own image can no
longer be pulled. `infra/compose.yml` and `infra/compose.staging.yml` run
`cgr.dev/chainguard/minio:latest` for the server and for the bucket set-up (the image carries `mc`
and a shell); the health check, buckets, access policies, ports and keys are unchanged, and no
application code changed. The server now runs as an unprivileged user (65532) instead of root: a
one-shot `minio-volume` service hands a volume the old image wrote (root's files) to that user
before the server starts, and changes nothing on a volume already handed over or a new one.

**Validated in scratch Compose projects only** (the running local stack, its containers and the
`lms_minio` volume were not touched):

- A copy of the local volume under the new definitions: hand-over, healthy server and set-up all
  clean; both buckets identical to the old server (146 + 2 objects: keys, sizes, ETags) with the
  same policies (public `download`, private `private`); a second `up` changed nothing; the console
  answers on its port.
- The API's storage paths, compiled API with CI-style settings on the scratch database: 15 of 15
  checks (readiness; a public avatar upload, its content check and public link; a private lesson
  resource with its signed download, and the unsigned link refused; a server-written export, ready
  with 60 rows, downloaded as `.xlsx`; deletion), on the migrated copy, on a new volume, and on
  staging's definitions with staging's own keys.
- Staging Compose: `config` valid with and without `sandbox-image`; its storage services and Caddy
  started in isolation and served the public bucket through `/files`.

**Fixed while validating staging** (configuration and documentation only):

- Public file links lacked their bucket. `S3_PUBLIC_BASE_URL` was `https://<host>/files`, and Caddy
  hands `/files/*` to MinIO without the prefix, so a link such as `/files/demo/…` answered 403
  (MinIO read `demo` as the bucket). It now ends in `${S3_BUCKET_PUBLIC}`: through Caddy the
  driver's link answers 200, and the private bucket still answers 403 without a signature.
- An unquoted bcrypt hash in `.env.staging` is mangled by Compose's interpolation (23 of its 60
  characters arrived), so `/mail` and `/status` would never accept the password. The example and
  the staging runbook now say to single-quote it; quoted, it arrives intact.

**Open before staging (a decision).** With `S3_ENDPOINT=http://minio:9000` the API signs every
upload link and private download link for `http://minio:9000`, a name only containers resolve, so
on staging a browser could not upload files or download private ones (exports, documents, lesson
resources). The fix is either an application change (sign with an address browsers reach) or a
different staging topology (a storage address browsers reach, such as its own host behind Caddy,
or a managed store); a separate origin would also have to reach the web build's content security
policy through `NEXT_PUBLIC_STORAGE_URL`.

**Local stack.** Still on the cached old image. The next `pnpm services:up` switches it: Compose
recreates `minio`, and `minio-volume` hands `lms_minio` (2.7 MB, root's files) to the new user,
with the data left as it is, as on the copy.

## 2026-10-02 (session 15) — `lms` reset, pushed to GitHub, first CI runs fixed

**Database.** With the client's consent (2026-10-01) `lms` was reset to SI Academy: 8 migrations,
base seed, demo seed and the Super Admin from the CLI. Prisma 7's `migrate reset` no longer runs
the seed, so `pnpm demo:reset` stops before the demo data; the seeds were run by hand (debt: the
script).

**Remote.** `origin` is `https://github.com/hamsanand610/LMS.git`; `main` was pushed normally.

**What each CI run found** (nothing was skipped or weakened to pass):

1. GitHub rejected the workflow: a job's `env` read the `env` context. The smoke job now exports
   the CI database URL from a step (`22c72ed`).
2. Three report API tests failed: exports are written to object storage and CI has none. The API
   tests use an in-memory storage stand-in, as they already did for code execution (`89737f2`).
3. Container images: the API image's `prisma generate` stopped with `PrismaConfigEnvError` (no
   `DATABASE_URL` in the build); that one command gets a placeholder (`2211ced`). Playwright smoke:
   J-12's export never became ready because the smoke job had no object storage; the job now
   starts MinIO with the buckets `infra/compose.yml` creates (`f64dc9d`).
4. Checks, sandbox and all four images green (pushed to GHCR, as on every push to `main`); the
   smoke job could not pull MinIO. MinIO has withdrawn its open-source images and binaries
   (quay.io 401, Docker Hub gone, dl.min.io 410 "archived"). The client chose Chainguard's build of
   MinIO for the CI smoke job: ADR-0017, with the stack row in `docs/STACK.md`.

**Verified locally before each push**, with CI's own commands and environment: the API image fails
as on CI and builds after the fix (web and runner images too); J-12, against a scratch database
`lms_ci_smoke` seeded as CI seeds it (its generated passwords are discarded), fails without storage
as on CI (the export reads "failed") and passes with it (ready, 60 rows), including against
Chainguard's MinIO on tmpfs. Pre-push hook each time: typecheck 9/9, unit 220.

**Open.** Local development and staging still name the `quay.io/minio` images: a machine without
them cached, and the staging host, cannot start object storage, and MinIO is unmaintained. The
client decides the replacement before staging (ADR-0017). GitHub also warns that the actions used
run on Node 20 (forced to Node 24) and that `ubuntu-latest` becomes Ubuntu 26 from 2026-10-19;
neither fails a run.

## 2026-10-01 (session 14) — ADR-0013 to ADR-0016 accepted

The client approved ADR-0013, ADR-0014, ADR-0015 and ADR-0016 on 2026-10-01. Their status is now
"accepted" with an "Approved: 2026-10-01" line; their decision text is unchanged, and the plan
amendments they propose (ADR-0013 §16.4, ADR-0014's) are approved with them. ADR-0011 is marked
superseded by ADR-0016, and ADR-0007's amendment note no longer waits on approval. The Task 4
report says the same. Documentation only: no code, database or remote was touched.

## 2026-10-01 (session 13) — Task 4 release gate: audited, verified, committed; push blocked (no remote)

**Scope.** The client's release-gate brief: close Task 4 without new features. Details and the
technical-debt classification: `docs/product/TASK4_COMPLETION_REPORT.md` ("Release gate").

**Results.** Repository audit PASS (515 changed paths, all intended Task 1–4 work; no QA files,
session state, logs or screenshots; `.gitignore` now also covers `*.env`, `**/.auth/` and `*.har`).
Security audit PASS (no secrets; only the published local defaults, CI's throwaway values and
test placeholders). ADR review PASS: ADR-0013 to ADR-0016 match the code, and ADR-0016's trust
boundary (learner → API → runner → container → result) is exact; ADR-0007, ADR-0011 and the gap
analysis §5.2 now point at ADR-0016 instead of reading as current. Docker PASS (LMS PostgreSQL,
MinIO, Mailpit healthy; volumes intact; `lms-sandbox:1` and `lms-runner:local` present; a job ran
through the hardened runner image). Staging and CI configuration validated locally (resolved
compose: runner internal-only, read-only, no capabilities, docker group, token required; CI has
the sandbox job, a runner in smoke and both images; deploy pulls them). The only runtime
reference to the retired driver was the local `apps/api/.env`; it now selects the runner with a
token shared with `apps/runner/.env` (never printed).

**Checks (one at a time).** Typecheck 9/9, lint 9/9, unit 220, API e2e 17/17 files and 223 tests,
build 6/6, runner real containers 13/13, question bank 101/101 (check only).

**Commit.** Local commits on `main`: `4595be2` product code; `5ae9871` CI, images and staging;
`0b1f5cd` documentation; `0dcd056` preview launch configurations; `bfa3ec3` the generated OpenAPI
document kept exactly as the API writes it (Prettier ignores it now, so an API start no longer
leaves the tree dirty); then this note. **Push, CI and staging: not run** — no Git remote is
configured (the brief forbids changing it) and the GitHub CLI is not installed.

**Main database.** `lms` still holds the Phase 6 "Demo Institute" data (79 `demo.local` accounts,
132 questions, 7 of 8 migrations; last activity 2026-09-27, test runs). Nothing found that needs
keeping. `pnpm demo:reset` would drop and recreate every table and seed SI Academy; it does not
touch MinIO. Not run: it needs the client's approval (and Prisma blocks it for agents anyway).

## 2026-10-01 (session 12) — Task 4 finished: runner in staging and CI, fair sandbox timing, full verification

**Scope.** Resumed Task 4 after the client moved Docker Desktop's disk to `D:`. No redesign: the
open items from session 11 plus everything the verification turned up. Final report:
`docs/product/TASK4_COMPLETION_REPORT.md`.

**Environment.** Docker 29.8.1; LMS PostgreSQL, MinIO and Mailpit healthy; `lms_task4` current (8
migrations). A QA database `lms_task4_qa` was seeded for automated browser checks with passwords
generated for the session (held only in the session scratchpad, never printed, deleted at the end);
`api-runner-qa` in `.claude/launch.json` runs the API and runner on it. The preview was left on
`lms_task4` (`api-runner-task4` + `web-prod`).

**Runner and staging.** The runner image (`apps/runner/Dockerfile`) builds; run with staging's
hardening (read-only root, no capabilities, no-new-privileges, docker group instead of root,
socket mounted) it passed a job and the whole question bank (101 language runs). Jobs run with
`--pull never`. `infra/compose.staging.yml` gains the `runner` service and the sandbox image
(profile `sandbox-image`), and the API points at the runner; `.env.staging.example` gains
`RUNNER_TOKEN`, `DOCKER_GID`, `RUNNER_CONCURRENCY`. CI: a `sandbox` job (real-container tests and
`verify:questions`), a runner in the smoke job (the journeys run code), and `lms-runner` /
`lms-sandbox` images; the deploy workflow pulls both. The runner reads `apps/runner/.env`;
`pnpm env:init` writes one shared token into both `.env` files. Runbooks (staging, local setup,
testing), `apps/runner/README.md`, module READMEs and ADR-0016 updated.

**Fair timing.** Twice a correct reference solution failed its check with "time limit exceeded"
because the host was slow (a cold container after a restart). The harness now judges a case on the
CPU time it uses (limit plus runtime start-up); the wall clock is a backstop at twice that plus two
seconds for code that waits. The runner's deadline and the API's request budget follow it; the time
a case reports is its CPU time. New container tests prove both halves; `verify-runs.json` was
re-recorded with the new harness (101/101).

**Fixed.** Integrations › Code execution probes the driver really running (it reported "runs in the
learner's own browser" as healthy) and lists runner/Judge0/none; integration descriptions lost
their "demo" wording; the practice page no longer claims code runs in the browser; the "Local
environment" chip is gone; the seeded note "Seeded demo publication" is gone (seed, and blanked in
`lms_task4` and `lms_task4_qa`); `EMAIL_FROM` reads "SI Academy" (`.env.example`, staging example,
the display name in the local `apps/api/.env`); the learner dashboard no longer scrolls sideways on
phones; the structure editor is usable on phones; inline code renders in explanations,
instructions and mark schemes; a solved question reopens on the learner's last submission instead
of the template; history hides run-only columns for answers that ran no code; analytics say what
average score and pass rate are computed from; "Open now" on Tests lists only tests the learner
can start or resume; a failed reference check says why. Journey fixes: J-06c's check text, J-09b
re-runs from the action bar, list and catalogue lookups by search, J-10's skip guard, and the
coding journeys follow the phone layout (Code tab, console sheet).

**Verified (final, run one at a time).** Typecheck and lint, 9/9 packages; unit tests 220 (shared
77, runner 16, web 4, API 123); API e2e 17/17 files, 223 tests; production build 6/6; schema drift
(`prisma migrate diff` against a freshly migrated database): none; runner real-container suite
13/13; `verify:questions` 101/101; live checks through the real API and runner 58/58 (Java,
Python, JavaScript, PHP, SQL; hidden cases never in learner responses; time, memory, output and
network limits; compile and runtime errors; invalid input; idempotent submit; history; review and
feedback; access boundaries); sandbox outage 8/8 (Run answers 503 `execution_unavailable`; a
submission is kept "being checked" and evaluated once the runner is back). Browser: 498 views (33
pages, 42 states with tabs, 7 widths, both themes) with no console errors, failed API calls, error
screens or broken images, then 190 views after the fixes with no issue; loading and error states
32/32. Playwright journeys: desktop 59 passed, phone 59 passed; 4 one-time journeys (J-05 ×2, J-08,
J-10) skip by design once their seeded data is used.

**Incidents.** The machine has 7.2 GB of RAM. A repository-wide format check run beside the browser
suite starved it: that run failed for environmental reasons and Docker Desktop's port forwarding
stalled (containers stayed healthy; restarting one container did not help). Docker Desktop was
restarted once; the LMS containers came back healthy with their data. Afterwards every heavy check
ran on its own. Earlier, one run of the assessment e2e file failed at J-06; it could not be
reproduced (four passes since, including the final full run).

**Open.** Client approval of ADR-0013 to ADR-0016; commit; CI's new jobs and the staging runner
have not run outside this machine; `pnpm demo:reset` on `lms` is the client's to run.

## 2026-10-01 (session 11) — Task 4 (Assignments) built and tested; browser checks blocked by a full system disk

**Scope.** The client's Task 4 brief (Assignments). Plan, audit and gap analysis:
`docs/product/TASK4_ASSIGNMENTS_GAP_ANALYSIS.md`; decision record ADR-0016 (proposed; supersedes
ADR-0011). The client chose the WebAssembly argon2 fallback and the Docker sandbox runner.

**Built.**

- Security fixes from the audit, each with a deny test (tests results, trainer batch scope, reveal
  after the due date, HTML sanitising and security headers, login throttling and lockout,
  broadcast scope, practice grading, file ownership and type checks, open redirect, account
  enumeration, cache after sign-out, secrets in logs).
- `apps/runner` and `infra/sandbox`: one locked-down container per job (Java, Python, JavaScript,
  PHP, SQL on SQLite); the API only sends inputs and compares outputs; hidden cases never leave it.
- Assignments API: server-computed learner state, publications to batches or named learners with
  open/due/close dates, run and submit, queued idempotent evaluation, append-only reviews,
  resubmission, progress with struggling learners, analytics.
- Web: learner list, set page and one workspace for every type (CodeMirror 6, run, submit, history);
  staff builder (structure, details, resources, publishing, progress, reviews), review queue and
  review page, analytics; question editor for all nine types; practice on the sandbox; the browser
  runner deleted and the Content Security Policy tightened; admin health reports the sandbox.
- Content: 151 original questions and 14 assignments in `apps/api/prisma/seed/content`; the 85
  generated filler questions are gone. `pnpm --filter @lms/api verify:questions` ran every
  reference solution in the sandbox (101 language runs, all passing) and wrote fingerprinted
  outcomes the seed relies on; the seed never runs code and invents no results.

**Verified.** Typecheck and lint (api, web, shared, runner); unit tests (api 123, including the
content checks; shared; runner 15 plus 11 against real containers); API e2e: 16 of 17 files passed
in the final run (admin 7, assessment 37, attendance 12, auth 12, batches 9, courses 17,
engagement 18, notifications 13, permissions 12, profile 11, queue 4, reports 13, route table 5,
sessions 16, settings 5, students 13); `tests` could not start because the database went down (see
below) — it passed earlier the same day, before the option-id change. Production web build passes.
A fresh preview database (`lms_task4`) seeded end to end: 151 questions, 14 assignments,
19 publications, 1 214 answers, 60 reviews, 28 practice runs.

**Not yet verified.** Browser checks of the new pages (they need the client to sign in; the
Playwright journeys in `apps/web/e2e/assessment.spec.ts` need `E2E_*` credentials in the
environment). Staging still names the retired browser driver: the runner image
(`apps/runner/Dockerfile`) is written but its build was interrupted, and the staging compose and CI
are not yet wired to it. _Resolved in session 12: browser checks, journeys, the runner image and
the staging and CI wiring are all done._

**Incident.** Building the runner image filled drive C: (0 GB free); Docker Desktop's disk went
read-only, and PostgreSQL and MinIO stopped answering. Only this session's own scratch files were
deleted (212 MB). Nothing in Docker was restarted or pruned. The client needs to free space on C:
(or move Docker Desktop's disk image to E:) and restart Docker Desktop before work continues.
_Resolved: the client moved Docker Desktop's data to `D:\DockerDesktop\DockerDesktopWSL`._

## 2026-09-30 (session 10) — Sign-in picture at every width; local preview under Smart App Control

**Sign-in (direction A, reaffirmed by the client).** The cinematic panel only appeared from 1024 px;
below that the page showed a cropped photo strip, which is what the locked decision rules out. The
one panel now serves every width: beside the form from 640 px (the split layout), above it on
phones, with the photograph anchored to the panel's foot and masked on all four edges
(`login-photo` utility; `LoginBand` removed). Checked at 360, 390, 644, 768, 1024 and 1440 px in
both themes; no sideways scroll; the Sign in button stays in the first screen on a 360 × 640 phone.
Lint, typecheck and format clean; browser smoke tests pass on desktop and phone.

**Environment finding.** Windows Smart App Control is now on (since the restart into build 26300)
and blocks Node from loading argon2's native binary, so the API, the demo seed, the admin CLI,
`pnpm demo:reset` and the API test suites cannot start on this machine as they are. Nothing in the
product or in Windows was changed. The local preview runs through `.claude/launch.json`
(`api-siacademy`, `web-prod`): the launcher points the API at the `lms_siacademy` scratch database
and, only when the native binary is refused, substitutes a pure-JavaScript argon2id with the same
parameters and PHC format (about five seconds a sign-in). `next dev` also exits on this machine
(code 0xC0000409); the production build and server work.

**Open (client's decision).** Turn Smart App Control off, or approve a product-level fallback for
password hashing when the native binary cannot load. The main database is still not reset.

## 2026-09-27 (session 9) — Task 3 (premium visual refinement) complete; stopped for approval

**Scope.** The client's Task 3 brief: a visual and UI/UX refinement of SI Academy only — no workflow,
permission, API contract or business rule changed; brand (burgundy and ink), roles, navigation,
responsive shell and every Task 2 feature kept. Sign-in direction **A, "Cinematic Learner
Workspace"**, locked by the client with their own photograph.

**Documents.** docs/design/TASK3_VISUAL_DIRECTION.md (audit, research, three sign-in directions with
A locked, signature motifs, type, token table, card roles, motion); ADR-0015 (proposed, amends
ADR-0013: brand focus ring, re-tuned warm layers, brand-tinted active navigation, streak and
achievement colours, Instrument Sans with a display width, overlay sign-in photograph);
DESIGN_SYSTEM.md rewritten for the new system; clients/demo/README.md notes the photograph.

**Delivered.**

- **Tokens** (`deriveTokens`): ivory canvas, cream cards, warm-beige insets; a layered dark theme
  (canvas, card, inset, active) with a faint warm-red undertone; a deeper navigation plane; brand
  focus ring (`--focus`, `--nav-focus`); `--nav-active` as a deep brand tint; new fixed families
  `--streak` (emerald) and `--achievement` (champagne gold); success, warning, danger and info
  re-tuned. `validateTokens` checks the new pairs; unit tests pin the SI Academy values.
- **Type**: Instrument Sans (width axis) with a display voice (`font-display`, `stat-figure`) for
  heroes, titles and figures; only it is preloaded. SI Academy's branding selects it.
- **Signature**: the Progress Arc (`ProgressRing` with semantic tones, a bright head, a threshold
  tick and a one-time draw-in) replaces most bars; the Burgundy Glow lights the sign-in picture, the
  dashboard hero and the rail head; grain and a faint grid only there.
- **Sign-in**: the photograph (optimised to a 32 KB WebP) masked into a rounded dark panel with the
  lamp's light carried past the frame, corner arcs, vignette and grain; the statement in the dark
  space; a photo band above the form on phones; a show-password toggle on every password field.
  Seeded from `clients/demo/assets/login-background.webp` by an idempotent base-seed step (uploads
  only while no background is set; skips without storage).
- **Shell**: rail with its own glow, a burgundy-tinted active item with a glowing rule, quieter
  group labels; an architectural 60 px header; display-type page and section titles.
- **Learner dashboard**: an ink hero (date, greeting as the `h1`, welcome line, a live class when
  there is one, where you left off with the arc) → streak (emerald, 7-day row), adherence
  (segments), rank (gold) → due soon with urgency edges beside today and tomorrow → placements →
  other courses → announcements, batches and progress arcs.
- **Everywhere else**: course cards and covers as ink plates with the arc motif; one primary action
  on a question lesson; arcs in the course outline and contents; gold podium and own-row highlight
  on the leaderboard; summary bands, meters, bars and status chips coloured by meaning (brand
  progress, emerald attendance and completion, gold scores and upcoming, ink capacity);
  display numerals on staff dashboards; designed empty and status pages.

**Tests.** Lint and typecheck clean (8/8). Unit: shared 63, API 84, web 3. API integration: 17
files, 191 tests. Browser on the SI Academy database: desktop 58/58; phone 57 passed and 1 skipped
by design (J-10's single attempt used by the desktop run). The two `getByLabel('Password')` lookups
are now exact (the new toggle is named "Show password"). Screens reviewed in both themes at 360,
390, 768, 1024, 1440 and 1920 px; keyboard focus, the toggle's state and reduced motion checked in
the browser.

**Environment.** The main database was not reset (the client runs `pnpm demo:reset`). The running
app used a freshly seeded scratch database, `lms_siacademy`, whose branding copy and font were
synced to the overlay; `lms_task2`…`lms_task2d` can be dropped with approval. 21st was requested
for component research but is not connected in this environment; Inspo was used.

**Next (needs approval — operating rule 42).** Approve ADR-0013 and ADR-0015 with the direction
document; run `pnpm demo:reset` so the main database picks up SI Academy's font, sign-in copy and
photograph.

## 2026-09-27 (session 8) — Task 2 (real-world LMS transformation) complete; stopped for approval

**Scope.** The client's Task 2 brief: turn the template into a product an academy runs every day,
using the reference portal's authenticated learner area as the benchmark (audit, inventory, gap
analysis, then build), keeping Task 1's design system. Client decisions: the institute is
**SI Academy** (seeded addresses on the reserved `siacademy.example` domain); placement is a
**basic drives board**; the client runs `pnpm demo:reset` themselves.

**Documents.** docs/product/TASK2_AUDIT_AND_GAP_ANALYSIS.md (method, audit, inventory with P0–P3
actions, metric definitions, research, navigation, staff paths, and §9 what was built);
ADR-0014 (proposed) — pulls gamification, placement, doubts and profile projects/certificates
forward behind module flags, with the plan amendments it needs.

**Delivered.**

- **Measures from recorded work** (progress module): learning streak (IST days with a lesson,
  assignment answer, practice submission or test), practice streak, and class-day adherence
  (attend every marked class and do one activity); `GET /me/consistency`,
  `GET /students/:id/consistency`; dashboard cards, a 26-week calendar, recent class days and the
  rules on the progress page and the trainer's student view.
- **Leaderboard** (`gamification`, flag off in the template): points for lessons, first solves,
  best assignment marks and released test scores; this week / month / all time; batch-scoped;
  short names only; learner, trainer and admin pages.
- **Placement** (`placement`): companies with ordered, topic-labelled interview-prep kits built
  from the practice catalogue, favourites and per-learner status; drives (draft → open → closed)
  with eligibility by batch, programme and attendance; apply with the default resume, withdraw;
  staff stages with a note that reaches the learner; learners told when a drive opens; admin
  dashboard placement tiles measured while the module is on.
- **Doubts** (`doubts`): learner `/me/doubts…`, staff `/doubts…` (trainer = own batches, admin =
  all); linked from course pages and the lesson player; notifications both ways; waiting count on
  the trainer's dashboard.
- **Courses**: lesson topics (builder field, grouped outline), required/optional clarity, duration,
  modules and instructor on cards and the outline; lesson counts follow the percentage's rule.
- **Profile and account**: projects and certificates sections, photo upload (also in the account
  menu), a `/settings` page; notifications grouped by period with placement and doubt categories;
  schedule Week/Month views; learner search over courses, lessons, assignments and practice; a
  practice topic filter; grouped navigation for all three portals (`minScope` on menu items).
- **Sign-in**: an original composition of the product's own surfaces on the ink panel.
- **No demo wording** in the product: environment pill, pending-tile reasons, report reasons,
  content pages, email footer; notification dates in IST through shared formatters.
- **Seed (SI Academy)**: branding, settings, flags on; fictional colleges, towns and trainer names;
  lesson lengths that add up to each course's stated time; a dated learning history, practice runs,
  six new hand-checked practice problems, five companies with kits, five drives, sixteen
  applications, five doubts with replies and their notifications. Validated on fresh scratch
  databases (`lms_task2`, `lms_task2b`, `lms_task2c`, `lms_task2d`) — the main database was not
  reset.
- **Reliability**: `DATABASE_POOL_MAX` (default 20), a 10-second transaction wait, and the
  notification bell's read no longer in a transaction — the causes of the connection-pool 500s and
  flaky journeys seen under parallel browser runs.

**Tests.** Lint and typecheck clean (8/8 tasks). Unit: API 84, shared 61, web 3. API integration:
17 files, 191 tests (new `engagement.e2e-spec.ts`; role matrix, profile, navigation and pending-
wording assertions updated). Browser on a freshly seeded database: desktop 58/58, phone 57 passed
and 1 skipped by design (J-10's single attempt used by the desktop run); new
`e2e/engagement.spec.ts`; J-03a now waits for the save confirmation (a race that made it flaky).

**Open / for approval.** ADR-0014 and the plan §12.2/§12.3/§24 amendments; not built: assignment
time-spent figures (needs a definition), per-test leaderboard (P2), bookmarks (P2); the scratch
databases can be dropped; the client runs `pnpm demo:reset`. Nothing committed.

## 2026-09-27 (session 7) — Task 1 (premium UI/UX redesign) complete; stopped before Task 2

**Scope.** The client's Task 1 brief: a premium red-and-charcoal redesign of every screen, research
first, UI only — no API, model, permission or workflow changes beyond what the UI needed. Task 2 was
not started.

**Research (docs/design/RESEARCH.md).** About thirty Inspo queries (education products, wine
palettes, SaaS dashboards, docs navigation, dark products, restrained glass, mobile navigation);
the reference portal's learner area viewed read-only in the session already signed in from the
planning stage (no credentials entered, nothing opened or submitted); a before-audit of all 85 pages
at four widths and both themes. Patterns selected and rejected are recorded with the reasons.

**Delivered.**

- **Design system (ADR-0013, docs/design/DESIGN_SYSTEM.md).** Neutrals now follow the brand's
  temperature (warm or cool OKLCH ramps) instead of its hue; brand shades in OKLCH; tokens derived
  on read with a fingerprinted `ETag`; new tokens for a third surface, a strong border, a second
  text tier, a blue focus ring, an ink navigation plane and validated chart colours; elevation,
  glass and motion tokens. Demo primary `#7F2331`. Emails take their colours from the same tokens.
- **Shell.** Ink sidebar that stays in view on long pages, grouped and role-filtered, collapsible to
  icons with tooltips and remembered; glass header with section name, search, notifications, theme
  and account menus; staff drawer and the learner's five-tab bar on phones (hidden while sitting a
  test); skip link; section highlighting for pages outside the navigation.
- **Dashboards.** Learner: continue-learning hero, today and tomorrow, due soon, progress with the
  attendance threshold. Trainer: "Needs you" (roll calls, marking), today's timeline, batch health,
  learners slipping. Admin: "Needs attention" first, then the figures grouped as People, Delivery and
  Outcomes, the unmeasured ones named in one quiet band, then trends and tables — no wall of tiles.
- **Learning and assessment.** Course catalogue and outline, lesson player with a curriculum rail,
  assignments, the question workspace, practice as a statement-and-editor workspace with a console,
  the test instructions, a focused exam screen (sticky console, countdown with five- and one-minute
  announcements, sectioned palette with a legend, confirm dialog with a summary) and the result page.
- **Everything else.** Progress, profile (completeness links straight to the missing section),
  notifications, preferences, search (type icons, highlighted matches), roll call, attendance lists
  and detail, reports and report pages (`aria-sort`, column chooser, summary band), staff detail
  pages (back links, stat bands), list pages (search fields, framed tables, pagination), sign-in and
  the other auth pages, 403, 404 and error pages, the public content pages.
- **Consistency.** One date format everywhere through `lib/format.ts` (IST), one `humanise`, shared
  `ChoiceRow`, `CodeArea`, `SearchInput`, `StatusPage`, `StatStrip`, `OverviewBand`, `Meter`,
  `ProgressRing`, `SectionHeader`; restyled primitives (button, card, badge, tabs, table, inputs,
  dialogs, sheets, menus, tooltips, toasts, skeletons).

**Tests run (operating rule 28), on the development machine, 27 September 2026.**

- Lint and typecheck, all eight workspaces: pass.
- Unit: shared 60, web 3, API 73: pass. API integration: 171 in 16 files: pass.
- Browser suites against the production build: desktop 47 passed, mobile 47 passed, none failed;
  3 skipped on each (J-05 twice and J-10), because earlier runs today used the demo's unmarked
  classes and the learner's one attempt. Both journeys passed against the new screens earlier in the
  session, before their data was used; `demo:reset` makes them runnable again.
- Visual review with the local harness: every page at desktop light, desktop dark and phone, plus
  the exam and result screens rendered from fixture data (nothing written).
- One test change: the progress-page check in `learning.spec.ts` now finds the course block by its
  list-item role instead of by CSS classes.

**Found, not fixed (outside a UI task).**

- Under the browser suite's burst of publishing, marking and exporting, the long-running API logged
  `pg-boss error` and unhandled exceptions and answered even `/branding/public` in 10–30 s for about
  half a minute; two journeys failed their first attempt and passed on retry. A fresh API process
  ran both suites without a failure. Worth a look at connection-pool sizing between Prisma and
  pg-boss before staging.
- `/admin/settings/fields` requests three resources that answer 404 (console noise, page works).
- Notification bodies written by the API use ISO dates and 24-hour times ("2026-09-27", "14:00").
- Course data has no instructor field, so the course pages cannot name one.
- Tables scroll sideways on phones rather than turning into cards (plan §16.5 asks for cards), and
  dashboard charts have no table toggle yet.

**Needs approval.** ADR-0013 proposes amending plan §16.4 (neutrals by temperature, the added
tokens, derivation on read).

**Still owed from Phase 6.** Its progress-log entry has not been written; the Phase 6 commit
(`19aaca9`) and the uncommitted follow-ups (demo:advance settling class statuses, the J-08 week
check, the sign-in setup clearing the password box, the staging runbook) are recorded in git only.

## 2026-09-15 (session 6) — Phase 5 (Attendance and reporting) complete; gate reached

**Approval recorded.** The client approved the Phase 4 gate and asked for Phase 5: attendance and
reporting. Asked two scope questions before starting, the client answered both: build the trainer's
view of a student (DP-T05) now rather than in Phase 6, and extend the two existing importers to
accept `.xlsx` now that the phase introduces a spreadsheet library.

**Delivered (architecture plan §24.1, Phase 5 deliverables).**

- **Database.** Migration `20260915044359_phase5_attendance_reporting`: attendance records (one per
  student per class, with who marked it, who corrected it and why) and report exports, plus three
  columns on a class recording when its roll call was taken, by whom, and whether the trainer has
  been nudged about it.
- **Attendance (M-13).** The roll call with everybody present by default, so a full class is one
  button and only the exceptions are touched. A class can be marked once it is live or finished,
  never before, and only for students on its roster. Changing a mark that has already been taken
  requires a reason, and the record keeps who changed it, when and why; after the correction window
  (48 hours by default) a trainer is refused and told to ask an administrator, who holds
  `attendance:manage`. The percentage is one formula in one place — attended ÷ classes marked,
  where "attended" is the statuses the institute counts — and the learner's page, the roll call, the
  batch tab, every report and both dashboards all read it from there.
- **Attendance jobs.** A quarter-hourly job tells a trainer about a class that finished an hour ago
  and has not been marked; a Monday-morning job tells learners who have fallen below the threshold.
  Both stamp before they send, so neither can go out twice.
- **Reports (M-15).** Five reports — students, attendance, progress, assessments, assignments —
  each a filtered table with summary tiles, a chart and the definitions behind every figure. The
  page asks for a slice of the rows and an export asks for all of them, from one builder and one
  sort, so a file cannot disagree with the table it came from (ADR-0012).
- **Exports.** CSV and `.xlsx` as background jobs, written to private storage as the person who
  asked for them, listed with their row count, size and expiry, and downloaded through a signed
  link. Files are kept seven days; three exports at once per person.
- **Admin dashboard (DP-A01) completed.** The attention band (classes without a roll call, learners
  below the threshold, answers awaiting marking, documents to verify, failed jobs), every tile the
  customer's screenshot asked for with its own definition, the six whose module is not in this build
  named rather than invented, an attendance trend, an active-students trend, per-batch attendance
  and a course-wise table.
- **Trainer dashboard (DP-T01).** Today's classes with the roll call one click away — where journey
  J-05 begins — what is waiting to be marked, batch health (attendance, assignment completion, the
  last test average) and the learners who are slipping.
- **Trainer student view (DP-T05).** Attendance, courses, assessment and staff notes, with no
  sensitive personal fields. It also fixes a link that pointed a trainer at an admin route they are
  refused.
- **Spreadsheet imports.** The student and question importers now accept an `.xlsx` workbook, which
  is turned into CSV before anything else reads it, so there is one row reader, one set of line
  numbers and one error report whatever was uploaded. This closes the deviations stated in Phases 2
  and 4.
- **Demo data.** Attendance for the classes that have already happened — 320 marks across 16
  classes, about 81% present and 87% counted, four learners under the threshold — with a few classes
  left unmarked so the waiting list, the trainer's nudge and the attention band all have something
  real in them.
- **Web.** Admin attendance list and roll call, reports index, report page and exports; trainer
  attendance list, roll call, reports, exports, student view and a real dashboard; the learner's
  attendance on the dashboard and the progress page; an Attendance tab on the batch detail.

**Tests run (operating rule 28), on the development machine, 15 September 2026.**

| Suite                              | Command                           | Result                              |
| ---------------------------------- | --------------------------------- | ----------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 47 tests passed            |
| API unit                           | `pnpm --filter @lms/api test`     | 11 files, 58 tests passed           |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed              |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 15 files, 162 tests passed (137 s)  |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 34 passed, 2 skipped (5.1 min)      |
| Lint and type-check                | run per package                   | every package with the script clean |

**Phase 5 exit criteria (plan §24.1).**

| Criterion                   | Evidence                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-05 passes end to end      | `test/attendance.e2e-spec.ts` marks a class, refuses a correction with no reason, records who changed it and why, and refuses it again once the window closes; the browser suite marks a class and corrects it through the pages |
| J-12 passes end to end      | `test/reports.e2e-spec.ts` reads the dashboard, builds a report, sorts and pages it and exports it; the browser suite drills from the dashboard into the report and downloads the file                                           |
| Export equals filtered rows | The export job and the page share one builder and one sort; the API test asserts the file's row count equals the filtered total the page showed                                                                                  |
| Metric fixture tests pass   | `attendance-math.spec.ts` checks the percentage against a known dataset, including the two edge cases that matter: no class conducted is not 0%, and exactly at the threshold is not below it                                    |
| Dashboard tiles complete    | Every tile carries a definition; the six whose module is not in this build carry the reason instead of a number, and the API test asserts both                                                                                   |
| Trainer reports             | The same report pages, narrowed to the batches a trainer teaches; the API test asserts a trainer asking for somebody else's batch gets no rows rather than theirs                                                                |

**Defects found and fixed during this phase.**

- **A new module's permissions reached nobody but the Super Admin.** There were two implementations
  of the role sync: the watermark-aware one the seeds use (ADR-0009) and an older copy in
  `RbacService` that ran at boot and only seeded a role holding no permissions at all. Every
  non-super role therefore missed everything a new module added — Phase 4 worked around this by
  hand, which is what made it look like a one-off. The boot path now delegates to the one
  implementation, and the demo seed syncs the permission catalogue before the roles, because a
  permission the database has never heard of cannot be granted.
- **A learner could open their whole class's roll call.** `attendance:read` at scope `own` is a
  learner's own record; the staff views resolved "own" to "their batch" and so would have shown
  every classmate's attendance. The roll call, the class list and another learner's record now
  refuse an `own`-scoped caller outright.
- **A trainer's roster linked into an administrator's route.** The batch roster pointed at
  `/admin/students/:id`, which a trainer is refused. It now points at the trainer's own view of the
  learner.
- **A server component passed a function to a client component.** The attendance list took a
  function to build its links, which Next refuses across that boundary; it takes the portal name
  instead.
- **A hidden radio had no visible focus.** The roll call's status buttons hide the radio inside its
  label; a keyboard user had nothing to see. The label now draws the focus ring.

**Assumptions and deviations (stated, not invented).**

- **Reports read the live tables.** The master report (F-19) describes aggregate tables and sets
  AC-01.4 (a dashboard under two seconds for 5,000 students). This build computes every report from
  the source tables on each request: the figures cannot be stale, and the criterion is met at demo
  volumes but is not demonstrated at 5,000 students. ADR-0012 records the decision and names the
  aggregate tables as the documented path to that scale.
- **Four attendance statuses, not six.** The reference portal shows "week off" and "holiday" as
  attendance states. Here they are the absence of a class rather than a mark against a person: a
  holiday is a skipped date on the timetable, so nobody is marked and nobody's percentage moves.
- **QR check-in is not built.** The master report puts it in the Standard tier (F-13, Q-25); the
  demo captures attendance by roll call only, which is what the plan asks of this phase.
- **The seeded distribution is close to, not exactly, the plan's.** §21.1 asks for roughly 85%
  present and three learners below the threshold; the seed produces 81% present, 87% counted and
  four below. The shape is what the reports need; the exact figures are not worth forcing.
- **The roll-call journey needs a class that is waiting.** The demo seed leaves a couple per batch.
  Once a browser run has marked them the test skips with a message saying to run `demo:reset`,
  rather than passing on nothing.
- **Two browser tests skipped in the recorded run,** both for the same reason as in earlier phases
  and both saying so: J-08, because every class this trainer has taught already has its recording,
  and J-10, because no test window is open to the demo learner at the moment the suite runs. Neither
  is a Phase 5 journey; `pnpm --filter @lms/api demo:reset` puts both back in range.
- **The generated OpenAPI client is not committed.** `apps/api/openapi.json` is refreshed and
  tracked; nothing in the web app imports the `openapi-typescript` output, which uses a hand-written
  `api()` helper and the shared types instead, so the generated file is left out of the tree rather
  than committed as dead weight.

**Environment notes from this session.** Playwright's failure artefacts capture the page as it
stood, including a filled password field. `test-results/` and `playwright-report/` are git-ignored,
so nothing reaches the repository, but those folders should be deleted rather than shared; the
testing runbook now says so. Sign-in is limited to five attempts per quarter of an hour per address,
and iterating on a browser test trips it: wait for the window rather than raising the limit.

## 2026-09-14 (session 5) — Phase 4 (Assessment) complete; gate reached

**Approval recorded.** The client approved the Phase 3 gate and asked for Phase 4: the question bank, assignments, and tests and assessments. Asked whether the plan's fourth Phase 4 item, the student practice catalogue and workspace, was in scope, the client answered "Add the Practice pages too", so the whole Phase 4 row of the roadmap was built.

**Delivered (architecture plan §24.1, Phase 4 deliverables).**

- **Database.** Migration `20260914154134_phase4_assessment`: questions, options, coding problems, test cases, question versions, assignments, assignment modules and placements, publications, submissions and their per-case results, tests, sections, placements, schedules, attempts, answers, and a record of every code execution.
- **Question bank (M-11).** Five types: multiple choice with one or several answers, true or false, written, and coding. Each save keeps a version, so what a learner saw can still be explained. The type of a saved question cannot change. A question already used by a paper can be retired but not deleted. Import from a sheet with a template, a dry run that writes nothing, and a per-row error report with line numbers.
- **Execution adapter (M-14, ADR-0007 and the new ADR-0011).** Two drivers behind one interface. The demo runs JavaScript in a sandboxed worker and Python through Pyodide, in the learner's own browser; a Judge0 host runs them away from the learner. The API process never compiles, evaluates or spawns learner code, and a test asserts it. A browser verdict is recorded as untrusted and badged as such wherever a mark is shown; the marks themselves are always computed from the weights stored against the question.
- **Assignments (M-12).** Modules of questions with unlock rules, attempt limits, an explanation policy and a due policy. Objective answers are marked at once, written answers queue for a person, coding answers are marked from the question's own cases. Published to a batch with an optional due date; everyone in it is told.
- **Tests (M-13).** A paper of sections, settings for duration, attempts, shuffling, results and review, and a window per batch. The attempt engine owns the clock: the deadline is written at the start, every save after it is refused, and a job submits anything still open. Answers autosave. A second tab continues the same attempt. Negative marking applies to a wrong answer and never to a blank one, and a paper never scores below zero. Staff see scores at once; learners wait for the release, which is refused while any written answer is unmarked. A live monitor, a results table and a grading queue.
- **Practice (M-14).** A catalogue that is a view over the coding questions in the bank, with a workspace that runs the samples before a submission and records every verdict with its trust level.
- **Progress.** Assignments and tests are now measured rather than named as pending. Attendance is the only figure still named, and the dashboard has a "due soon" list of assignments and open tests.
- **Demo data.** 120 questions across the programme's subjects, six coding problems with reference solutions in both languages, four assignments published to batches, three tests at different points in their life, twelve sittings of the one already released, and a practice catalogue.
- **Web.** Admin and trainer pages for the bank, the editor, the import wizard, assignments and tests, with the builders, publishing, progress, results, the live monitor and the grading queues. Student pages for assignments, the question workspace, tests, the instructions page, the timed attempt, the result, and practice.

**Tests run (operating rule 28), on the development machine, 14 September 2026.**

| Suite                              | Command                           | Result                              |
| ---------------------------------- | --------------------------------- | ----------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 47 tests passed            |
| API unit                           | `pnpm --filter @lms/api test`     | 9 files, 45 tests passed            |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed              |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 13 files, 138 tests passed (114 s)  |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 26 passed, 1 skipped (2.3 min)      |
| Lint and type-check                | run per package                   | every package with the script clean |

**Phase 4 exit criteria (plan §24.1).**

| Criterion                              | Evidence                                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-06 passes end to end                 | `test/assessment.e2e-spec.ts` builds an assignment from the bank, publishes it to a batch and marks a written answer; the browser test does the same through the pages |
| J-09 passes end to end                 | The same spec answers a question wrongly then rightly, watches the gate open, and checks the figures agree; the browser test answers one through the workspace         |
| J-10 passes end to end                 | `test/tests.e2e-spec.ts` starts an attempt, saves answers, restores them, refuses a second attempt and submits; the browser test sits a test and submits it            |
| J-11 passes end to end                 | The same spec marks a written answer, releases the results and reads them back as the learner, with the rank and the review                                            |
| Browser driver runs JavaScript         | The browser test writes a solution, runs it against the examples and submits it, and reads back the accepted verdict with its badge                                    |
| Response-shape security tests pass     | The learner-facing question carries no correct option, no explanation and no hidden case; an API test asserts the browser driver refuses to run anything on the server |
| AC-06.1 to AC-06.4, AC-07.1 to AC-07.4 | Each has an assertion of its own, named in the specs                                                                                                                   |

**Defects found and fixed during this phase.**

- **An Admin could not write a question.** The authoring endpoints require `questions:create_own`, and the Admin bundle had only `questions:manage`. Whoever manages the bank now gets the authoring grant with it. Found by the browser journey.
- **Question versions collided.** Creating a question wrote version 1, and the first edit tried to write version 1 again, so every edit failed with a unique-constraint error. A version row now records the question as it stands after the change.
- **The question edit endpoint was a lie.** It was `PATCH` but replaced the whole question, so an editor that omitted a field silently cleared it. It is now `PUT`, which is what it does.

**Assumptions and deviations (stated, not invented).**

- **A browser-run verdict is not evidence.** ADR-0011 sets out what the demo driver can and cannot be trusted with, including that a browser cannot be kept from the hidden test cases it is asked to run. Practice and assignment coding marks carry a badge saying which machine checked them; a test never sends its hidden cases anywhere and never trusts a client report.
- **Coding answers inside a test wait for a person under the browser driver.** The server cannot run them, and marking them from a client report during a timed test is not something the platform will do. With a Judge0 host they are marked automatically.
- **The import sheet is CSV or TSV.** The same deferral as the student import in Phase 2: `.xlsx` waits for the library Phase 5 introduces for exports.
- **Python in the browser runs on the page, not in a worker.** Pyodide is loaded that way, so the time limit cannot interrupt a runaway Python loop; the workspace says so rather than implying a limit it cannot enforce.
- **The browser suite's admin account may be an ordinary Admin.** The Phase 1 smoke test walks the Super Admin settings pages; it now checks what the signed-in account holds and skips that part rather than failing when the account is an Admin.
- **One journey skipped in the recorded run.** The demo allows one attempt at the open test, and the learner used it in an earlier run of the same suite. The test says so in its skip message instead of passing on nothing; running `pnpm --filter @lms/api demo:reset` first makes it run.
- **The browser suite retries once.** Against the development server the first request to a route compiles it, and on this machine that can outlast any sensible limit. A retry hits the compiled route; a test that fails twice has failed.

**Environment notes from this session.** The machine has 7.4 GB of memory and a full C: drive, and compiling every route at once starved the disk badly enough that PostgreSQL timed out every connection and both servers fell over. Docker Desktop's port forwarder then stayed wedged — the database answered inside the container while refusing the host — and only restarting Docker Desktop cleared it. Nothing in the product was at fault, but it is worth knowing before running the suite here: start the API compiled, leave the routes to compile as the tests reach them, and do not run a warm-up pass.

## 2026-09-14 (session 4) — Phase 3 (Learning foundation) complete; gate reached

**Approval recorded.** The client approved the Phase 2 gate and asked for Phase 3: courses, lessons, media, publications, the learning player, progress tracking and the schedule.

**Delivered (architecture plan §24.1, Phase 3 deliverables).**

- **Database.** Migration `20260913173259_phase3_learning_foundation`: taxonomy terms, courses, course modules, lessons, lesson resources, course publications, enrolments, lesson progress, activity events, session series and live sessions.
- **Taxonomies.** The curated vocabularies the plan asked for (course levels, subjects, topics), built now because courses are their first consumer. Records store the term key, so a client renames a label without touching the records that use it; a term still in use is archived rather than deleted.
- **Courses (M-07).** Create, edit, archive; a whole-outline save that keeps the identity of every module and lesson the author kept, so editing a live course never resets progress anybody has already made; four lesson types; per-lesson completion rules; module unlocking once the previous module reaches a percentage.
- **Media (M-08).** Upload contexts for course thumbnails, lesson videos, lesson resources and class recordings. `VideoService` hides the delivery driver: the demo plays a private object through a four-hour signed URL, and a hosted provider becomes a second driver without touching the lessons that reference it (ADR-0005).
- **Publications (M-09).** A course is published to a batch, a programme or the whole institute, and the publication derives the enrolments (ADR-0010). Withdrawing removes only the learners with no progress. Publishing twice to one audience is refused rather than silently repeated.
- **Learning player (M-10).** Article and video lessons, downloads through short-lived links, previous and next, mark complete, and the video position saved every fifteen seconds. A locked module is refused by the API as well as hidden in the page.
- **Progress (M-11).** One source of truth for every percentage: the player, the course page, the dashboard, the progress page and the staff view all read the same figures, so they cannot disagree. Completing a lesson writes an activity row; the last mandatory lesson completes the enrolment.
- **Schedule (M-12).** Repeating classes expanded from weekdays, a time range, a date range and holidays, stored as instants derived from institute wall-clock time; a preview that names every clash before anything is written; status transitions; cancellation notices; a reminder job that cannot send twice; per-person timetables for learners and trainers.
- **Recordings (J-08).** A trainer publishes the recording of a class as an optional lesson in a course, linked back to the class it came from.
- **Demo data.** Six courses of twenty lessons each, six publications, 250 derived enrolments, 36 classes across a fortnight either side of today, and recorded progress for five learners.
- **Web.** Admin course catalogue, course workspace (outline builder, publishing, details), institute schedule, and the batch Timetable and Content tabs; trainer schedule and course views; student courses, course outline, lesson player, progress page and schedule; a student dashboard that is now real.

**Tests run (operating rule 28), on the development machine, 14 September 2026.**

| Suite                              | Command                           | Result                              |
| ---------------------------------- | --------------------------------- | ----------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 47 tests passed            |
| API unit                           | `pnpm --filter @lms/api test`     | 9 files, 45 tests passed            |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed              |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 11 files, 103 tests passed (135 s)  |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 20 tests passed (2.4 min)           |
| Lint and type-check                | run per package                   | every package with the script clean |

**Phase 3 exit criteria (plan §24.1).**

| Criterion                        | Evidence                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-03 passes end to end           | `test/courses.e2e-spec.ts` builds a course, publishes it to a batch, opens a lesson, completes it and checks the recomputed figures; the browser test does the same through the pages, as author then learner |
| J-07 passes end to end           | `test/sessions.e2e-spec.ts` previews a timetable, creates it, refuses the double booking, cancels a class and checks the notice; the browser test opens a learner's week and a trainer's                      |
| J-08 passes end to end           | `test/sessions.e2e-spec.ts` and the browser test publish a class recording into a course and find it there as a lesson                                                                                        |
| Progress figures agree           | The API test asserts the same number on the course, the progress overview and the dashboard; the browser test asserts it on the course page and the progress page                                             |
| Gating enforced, not just hidden | A lesson inside a locked module returns 403 `module_locked` to a direct request                                                                                                                               |
| Audit rows present               | Every mutation writes one; the courses and schedule suites assert the rows they expect                                                                                                                        |

**Defects found and fixed during this phase.**

- **The outline editor would have silently wiped lesson bodies.** The course detail response carries no lesson text, so a save would have written an empty body for every lesson the author had not opened. Lesson content is now optional on save, and the builder loads a lesson's text before it opens the editor, so nothing is overwritten unseen.
- **The batch Content tab showed every published course.** It claimed to show what the batch had been given while listing the whole catalogue. The catalogue endpoint now takes a batch filter and answers the question the tab actually asks.
- **Invalid taxonomy terms were accepted.** The course service checked the term and then ignored the answer; an unknown level or subject is now a field error.
- **The API test database accumulated fixtures between runs.** A Phase 2 assertion about what a trainer can see began failing once enough runs had added batches. The schema is dropped and recreated before the migrations, so every run starts clean.

**Assumptions and deviations (stated, not invented).**

- **Demo lessons are written articles, not videos.** No media ships in this repository, and a player pointed at a file that does not exist would be a worse demonstration than one that reads well. Uploading a video and attaching a recording are exercised by the tests instead, and the video driver is the same code either way.
- **The demo has 36 classes, not the "about 60" sketched in the plan of work.** Six series over a fortnight either side of today produce 36; padding the number would mean inventing classes nobody teaches.
- **Practice lessons carry a question id but nothing answers it.** The question bank is Phase 4, and the lesson page says so rather than showing an empty exercise.
- **A recording is attached as a link.** Uploading the video file itself uses the same upload context as a lesson video and is wired for the media work in Phase 5; the dialog says which of the two it is asking for.
- **Attendance against a class is not built.** It is a Phase 5 row, and the progress page names it as pending rather than showing a zero.
- **The browser suite's per-test limit is now ninety seconds.** Against the development server the first request to a route compiles it, which on this machine can take most of a minute; the previous thirty-second limit reported that as a product failure.
- **The `nest start --watch` runner is not reliable for long browser runs on this machine.** Its restart step kills a process id that has already gone and takes the whole watcher down with it. The verification run used the compiled server (`pnpm --filter @lms/api build` then `node dist/main.js`), which is also what the testing runbook now recommends.

## 2026-09-13 (session 3) — Phase 2 (Admin foundation) complete; gate reached

**Approval recorded.** The client approved the Phase 1 gate and asked for Phase 2 as planned: students, trainers, programmes, batches, notifications, announcements, search, journeys J-01 and J-02.

**Delivered (architecture plan §24.1, Phase 2 deliverables).**

- **Database.** Migration `20260913152313_phase2_admin_foundation`: student profiles, documents, staff notes, trainer profiles, programmes, batches, batch members, batch trainers, notifications, notification preferences, announcements, custom field definitions, import jobs.
- **Students (M-03/M-04).** Records with lifecycle status, personal and education sections, skills, completeness score and client-defined fields; staff notes; documents in the private bucket with verify/reject and audited download links; sensitive fields gated by `students:read_sensitive`; student codes `STU-<year>-<sequence>`.
- **Import (DP-A07).** CSV/TSV import as a queued job with a template, a real dry run, per-row error reporting, batch placement by code, and a one-at-a-time guard that releases jobs abandoned by a crashed process.
- **Trainers (M-05).** Records, subjects, batch assignments, own-record scope for a signed-in trainer.
- **Programmes and batches (M-06).** Programme CRUD with an archive guard; batches with capacity, mode, dates and status transitions; roster with membership history and transfers; trainer assignment per subject; starting a batch notifies its members.
- **Notifications and announcements (M-16).** In-app centre with categories and read state, per-category channel preferences, staff broadcast with an audience preview, announcements with a validity window delivered once by a five-minute dispatch job, and a bell in every portal.
- **Search (M-20).** Command palette (Ctrl/⌘+K) over students, trainers, batches, programmes and staff, gated per group by permission and narrowed by batch scope.
- **Dashboard (DP-A01, subset).** People and cohort tiles that are real today; attendance, completion and assessment tiles return no value and name the phase that will deliver them.
- **Custom fields.** Client-defined fields for students and batches, validated on every write, with a settings page.
- **Scope service.** Batch-scope resolution moved into core so every module answers the same question; trainers see only their own batches and the students in them.
- **Demo data.** One programme (Java Full-Stack), three batches (running, planned, completed), 60 students spread 20 per batch, 8 trainers with subjects, 9 trainer assignments, one announcement, plus `clients/demo/seeds/students-sample.csv` for the import demonstration.
- **Web.** Admin pages for students (list, import, detail), trainers, programmes, batches (roster, trainers, status), announcements and custom fields; a trainer portal with its own batches; a notification centre; a searchable command palette; a student dashboard that states the enrolment honestly.

**Tests run (operating rule 28), on the development machine, 13 September 2026.**

| Suite                              | Command                           | Result                           |
| ---------------------------------- | --------------------------------- | -------------------------------- |
| Shared unit                        | `pnpm --filter @lms/shared test`  | 4 files, 40 tests passed         |
| API unit                           | `pnpm --filter @lms/api test`     | 8 files, 37 tests passed         |
| Web unit                           | `pnpm --filter @lms/web test`     | 1 file, 3 tests passed           |
| API integration against `lms_test` | `pnpm --filter @lms/api test:e2e` | 9 files, 72 tests passed (103 s) |
| Browser, Chromium                  | `pnpm --filter @lms/web test:e2e` | 13 tests passed (50 s)           |
| Lint / type-check                  | `pnpm lint`, `pnpm typecheck`     | 8 of 8 packages clean            |

**Phase 2 exit criteria (plan §24.1).**

| Criterion                | Evidence                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-01 passes end to end   | `test/students.e2e-spec.ts` creates the account, the student record and the invitation and checks the audit row; the browser test creates a student through the dialog and opens the resulting record. The journey's final step, the student accepting the invitation, is covered by the Phase 1 invitation tests |
| J-02 passes end to end   | `test/batches.e2e-spec.ts` walks programme → batch → students → trainers → running and asserts the member notification; the browser test opens a seeded batch and its trainer assignments. Timetable and content publication are Phase 3 (see the deviation below)                                                |
| Import of the demo sheet | A browser test uploads `clients/demo/seeds/students-sample.csv` and asserts 17 of 20 rows import with exactly the three expected errors                                                                                                                                                                           |
| Audit rows present       | Every mutation writes one; the students, batches and notifications suites assert the rows they expect                                                                                                                                                                                                             |

**Defects found and fixed during this phase.** Three were pre-existing Phase 1 faults that only a Phase 2 journey could reach.

- **A trainer could open the admin portal.** Portal access was derived from "has any navigation item", and a trainer legitimately holds `batches:read`. Access now follows the user's roles, with the navigation fallback kept only for client-defined roles. Admin-portal menu items also moved onto the manage permissions, matching plan §14. Found by a browser test.
- **The queue rejected every job in embedded mode.** The pg-boss driver passed `priority: undefined`, which pg-boss validates and refuses, so no invitation email or notification could be queued outside tests. Options are now omitted when absent, and `test/queue.e2e-spec.ts` drives the real driver so the inline test path cannot hide it again.
- **`WORKER_MODE=none` crashed on enqueue.** The queue was never started in that mode, yet enqueue still called it. Handlers now run inline and awaited, which is also what the tests and the CLI want.
- **Rate limits shared one bucket.** A route with its own limit counted into the same counter as the global default, so a small per-route limit rejected requests the default had already allowed. Declared limits now count per route.
- **The import page treated a queued job as finished.** It now follows the job until the worker completes it.
- Smaller: the custom-fields tab read "Batchs"; the import counters mixed "skipped" with "failed"; a validation error for a missing sheet column did not name the column.

**Assumptions and deviations (stated, not invented).**

- **J-02 reaches as far as Phase 2 does.** The journey's timetable and content-publication steps depend on the schedule and course modules, which the same roadmap row places in Phase 3. Phase 2 delivers the batch, its roster, its trainers and its status, and the batch page says plainly that the timetable arrives with the schedule module. Nothing was faked to make the journey look complete.
- **Spreadsheet import is CSV/TSV only.** DP-A07 also promises `.xlsx`. That needs a library, and Phase 5 introduces one for report exports; using the same library for both directions avoids a second dependency. Every spreadsheet exports CSV, and the demo sheet is CSV. Amendment proposed for plan §14 (DP-A07).
- **The sample import sheet has 20 rows, not the 60 named in §21.5.** Sixty extra applicants would double the seeded student body mid-demonstration; twenty rows still show all three kinds of error. Amendment proposed for plan §21.5 step 6.
- **Role bundles on upgrade** now follow ADR-0009 (a catalogue watermark): a new module's defaults are granted once, and a permission a client removed is never re-added.
- **Taxonomies** (the plan's "Fields & taxonomies" page) are not built: nothing in Phase 2 uses them. They arrive with courses and questions, their first consumers.
- **Resumes and the student profile pages** (DP-S17–S20) are not in the Phase 2 row and were not built.

**Environment note.** The machine's system drive filled during this session (0 bytes free on C:), which crashed the web dev server with an out-of-memory error and broke test runs until temporary files were redirected to E:. By the end of the session `pnpm lint` and `pnpm test` through Turborepo were also dying with a Windows stack-overrun exit code whenever several packages built in parallel; the same checks pass when each package runs on its own, which is how the results above were produced. Only regenerable caches were deleted; roughly 3 GB of other Claude sessions' temporary folders were left untouched. The drive needs the owner's attention before the next phase.

**Next (needs approval — operating rule 42).** Phase 3 (Learning foundation): courses, modules and lessons, the file and video drivers, publications, the catalogue and player, the progress service, the schedule (series, occurrences, reminders), and the student dashboard and progress pages; journeys J-03, J-07, J-08.

## 2026-09-13 (session 2) — Phase 1 (Foundation) complete; gate reached

**Delivered (architecture plan §24.1, Phase 1 deliverables).**

- Monorepo (pnpm 11 + Turborepo), Compose stack (PostgreSQL 16 on host port 5433, MinIO from quay.io, Mailpit, Adminer profile), root and app `.env.example` files, `scripts/env-init.mjs`.
- Environment validation at boot (`apps/api/src/core/config/env.ts`, Zod; production refuses insecure cookies and placeholder secrets).
- Prisma 7 baseline migration `20260913140206_init_foundation`: organizations, users, invitations, password resets, sessions, roles, permissions, role permissions, user roles, settings, branding settings, feature flags, navigation configs, audit logs, files.
- Authentication (ADR-0003): Argon2id, 15-minute access JWT in an httpOnly cookie or Bearer header, rotating refresh tokens with family reuse detection, double-submit CSRF, lockout after 5 failures, invitations and password resets as hashed single-use tokens, sessions list/revoke, logout-all.
- RBAC (ADR-0004): permission catalogue from module manifests, system role bundles, scopes `all|batch|own`, deny-by-default guard, module-enabled guard, 60-second auth context cache.
- Module registry (manifests → permissions, navigation defaults, flag defaults; catalogue synced at boot), foundation modules `settings`, `auth`, `rbac`, `users` (+ `/me`), `audit`, `files`, `health`, each with a README.
- Core services: pino logging with request ids and redaction, RFC 9457 problem responses, request context, audit service, tenant service, pg-boss queue with embedded workers, S3 storage driver with presigned uploads and MIME sniffing, SMTP/noop email drivers with branded templates, in-repo rate limiting.
- Shared package: schemas (auth, settings, branding, flags, navigation, common), permission catalogue, roles, error codes, `/me` contract, time utilities, theme derivation with WCAG contrast validation.
- Web shell (Next.js 16, shadcn `radix-vega`, Tailwind 4): branding injected server-side as CSS variables for light and dark schemes, theme toggle (system/light/dark), portal layouts with navigation from `/me`, user menu, mobile navigation, environment banner, typed API client with CSRF header and one silent refresh, server-side portal guards.
- Pages: sign in (with silent session restore from the refresh cookie), forgot/reset password, accept invitation, sign out, 403/404/error, admin home, users (list, filters, invite, roles, deactivate/reactivate, resend invitation), general settings, branding (live preview, contrast check, logo/favicon/background uploads), feature flags, navigation editor, roles and permissions matrix (create/clone roles, per-role save), audit log (filters, before/after viewer), system health, my account (name, password, devices), trainer and student placeholders (wireframes).
- Seeds and CLI: base seed with client overlay (`clients/demo`), Super Admin CLI, demo accounts seed (§21.1 people: admin, ops, placement, 8 trainers, 60 students), `demo:reset`.
- Worker entry (`apps/api/src/worker.ts`, `apps/worker`), CI workflow (`.github/workflows/ci.yml`), husky hooks (pre-commit Prettier, commit-msg commitlint, pre-push type-check + unit tests), runbooks (local setup, testing, page checklist), ADR-0001…0008, `docs/STACK.md`.

**Tests run (operating rule 28), all on the development machine, 13 September 2026.**

| Suite                                                                                                                        | Command                                                                                | Result                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Shared unit (schemas, token derivation/contrast for 10 sample brand colours, time)                                           | `pnpm --filter @lms/shared test`                                                       | 3 files, 26 tests passed                            |
| API unit (env contract, passwords/tokens, pagination, MIME sniffing, rate-limit store)                                       | `pnpm --filter @lms/api test`                                                          | 5 files, 22 tests passed                            |
| API integration against `lms_test` (route table, authentication, permission matrix for four roles, branding/settings/health) | `pnpm --filter @lms/api test:e2e`                                                      | 4 files, 28 tests passed (36 s)                     |
| Web unit (portal helpers)                                                                                                    | `pnpm --filter @lms/web test`                                                          | 1 file, 3 tests passed                              |
| Browser smoke, Chromium (redirect to sign-in, Super Admin sign-in → dashboard → settings → sign-out, wrong credentials)      | `pnpm --filter @lms/web test:e2e --project=chromium`                                   | 3 tests passed (see session note below)             |
| Lint / type-check                                                                                                            | `pnpm lint`, `pnpm typecheck` (per package: eslint `--max-warnings=0`, `tsc --noEmit`) | clean for `apps/api`, `apps/web`, `packages/shared` |

Manual browser verification (Claude in-app browser, viewport 553×616): sign-in as Super Admin, admin dashboard, general settings, branding, feature flags, navigation, roles matrix, audit log (5 rows from this session), system health (database/storage/email OK), users list, my account — all render with data from the API; dark theme resolved from the system preference.

**Phase 1 exit criteria (plan §24.1).**

| Criterion                                | Evidence                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New developer runs the stack in < 1 hour | `docs/runbooks/local-setup.md`; quick start is seven commands; ports and pitfalls documented                                                                                               |
| Login works for four roles               | `test/permissions.e2e-spec.ts` signs in Super Admin, Admin, Trainer and Student and checks home portals (`admin`, `admin`, `trainer`, `student`); Super Admin also verified in the browser |
| Branding changes re-theme                | `test/settings.e2e-spec.ts`: PATCH primary colour → new derived tokens, version bump, public branding and audit row; web injects tokens on every request (no cache)                        |
| Route-table test passes                  | `test/route-table.e2e-spec.ts`: 40+ routes, each public or permission-declared, permissions exist in the catalogue, protected GETs answer 401                                              |

**Fixes made during verification.**

- shadcn-generated components imported `cn` from an npm package instead of `@/lib/utils`; class names aligned with shadcn conventions (`text-muted-foreground` etc.).
- React Compiler lint rules: hoisted a component created during render, replaced `setState`-in-effect patterns (theme toggle now uses `useSyncExternalStore`; navigation editor remounts on fresh data), switched forms to `useWatch`.
- `/me` reported no portals for students and trainers (no navigation items yet in Phase 1) → portals now derive from roles as well; `POST /branding/preview` answered 201 → 200.
- Shared `emailSchema` now trims and lower-cases before validating, so a trailing space cannot block a sign-in.
- ESLint for the API: `@typescript-eslint/consistent-type-imports` needs the `emitDecoratorMetadata` parser option, otherwise auto-fix would break Nest dependency injection; shared config package now declares its runtime dependencies.
- Removed `vite-tsconfig-paths` (Vite resolves `tsconfig` paths natively) and `@nestjs/throttler` (no Nest 12 peer range; replaced by the in-repo guard) — recorded in `docs/STACK.md`.
- Login page restores a session silently when the access token expired but the refresh cookie is valid (the refresh cookie is scoped to `/api/v1/auth`, so server components cannot see it).

**Assumptions and deviations (stated, not invented).**

- Demo password (§21.2): outside local the seed requires `SEED_DEMO_PASSWORD`; locally, when unset, it generates a random password and prints it once instead of using a documented fixed value, because operating rule 9 forbids credentials in the repository or docs. The runbook tells presenters to set the variable.
- Phase 1 has only core (locked) modules, so the Feature flags page shows an explained empty state until Phase 2 modules add flags.
- Trainer and student home pages are temporary wireframes (labelled in `docs/runbooks/page-checklist.md`); their content arrives with Phases 2–3.
- `docs/source-materials/` (client WhatsApp screenshots) is kept out of version control because the images may contain personal data.
- CI has not run yet: the repository has no remote. The workflow is written to the plan (§23.2) and will be verified on the first push.

**Session note (rate limiting during verification).** The login route allows 5 attempts per 15 minutes per IP and email; repeated manual and automated sign-ins during verification hit that limit once, which is the intended behaviour. Test suites keep sign-ins per file below the limit and boot their own application instance.

**Next (needs approval — operating rule 42).** Phase 2 (Admin foundation): students, trainers, programmes, batches, notifications, announcements, audit viewer polish, basic search; journeys J-01 and J-02.

## 2026-09-13 — Phase 1 (Foundation) started

**Approval recorded.** Client approved: monorepo with modular monolith; separate web, API and optional worker; PostgreSQL; Docker Compose local environment; one deployment and database per client; configuration and feature flags first, extension modules only when necessary; code execution through an external/isolated adapter, never inside the API; staging Option A (VM); AI, advanced labs, placement, certificates and gamification deferred to future phases. Instruction given to start implementing per the documents and to ask before inventing anything unclear.

**Environment verified on the development machine.** Node 22.22.1, pnpm 11.15.1, Git 2.53, Docker 29.7.2 with Compose v5.4.0 (Docker Desktop installed per-user; daemon started during this session). Windows 11.

**Version pins decided at setup (recorded in docs/STACK.md).** Next.js 16.3.5, React 19.2.8, NestJS 12.0.1 (CLI 12.0.0), Prisma 7.10.0 (the npm `latest` tag is an 8.0 release candidate, so the 7.x line is pinned explicitly as per D-04), Tailwind CSS 4.3.3, Zod 4.6.4, pg-boss 12.31.0, TypeScript 6.0.3 (the Nest 12 generator targets TypeScript 6; every dependency in use accepts it, so it is used workspace-wide instead of 5.9), Vitest 4.1.11, Playwright 1.63.0, Turborepo 2.10.12.

**Done.** Repository initialised (`git init`, branch `main`); workspace root files; Nest and Next apps scaffolded with their official generators (`@nestjs/cli@12 new`, `create-next-app@16.3.5`); nested workspace file removed from the web app; package manifests for `apps/api`, `apps/web`, `packages/config`, `packages/shared`, `packages/module-sdk`, `packages/ui`; `infra/compose.yml` (postgres, minio + bucket init, mailpit, adminer profile); `.env.example` files for root, API and web; Prettier, commitlint, editor config; `scripts/env-init.mjs`.

**Assumptions (not inventions; defaults from the approved documents).** Product codename "LMS" and package scope `@lms/*` until a product name is given (Q-01); demo brand "Demo Institute" (DQ-05); pg-boss as queue default (DQ-03); repository private (DQ-08); overlays inside the template repository (DQ-10).

**Next.** Install dependencies; Prisma baseline schema and first migration; core (config, logging, errors, guards, audit, queue, events, storage, email adapters); modules auth, rbac, users (me), settings/branding/flags/navigation, audit, health, files; web shell with theme injection and auth pages; seeds and CLI; tests; CI workflow; ADRs; runbooks.
