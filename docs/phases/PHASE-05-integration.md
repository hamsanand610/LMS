# Phase 5 — Cross-module enterprise integration

| Field    | Value                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **Complete — approved by the client on 3 October 2026** and pushed (`3484cfc`): the first pass (§1–§4) and the final completion pass (§5–§8); the record is §8                                                            |
| Scope    | The client's Phase 5 brief of 3 October 2026 (a strict two-hour window on the highest-value cross-module gaps), then the client's "final 100% completion pass" the same day: every item the first pass deferred, finished |
| Roadmap  | `docs/ROADMAP.md`, Phase 5 (gate: the student, trainer and admin journeys pass end to end)                                                                                                                                |
| Baseline | `9369b50` (Phases 0–4 approved); the Phase 3–4 decisions D1–D10 and ADR-0023 kept as they are; the completion pass from `637265d`                                                                                         |
| Boundary | Non-AI; no new infrastructure (the existing queue, events, audit log and list services are reused); one additive migration (`20261005090000_phase5_integration`); no UI redesign. Hardening stays Phase 6                 |

## 1. Inspection (first pass, first ten minutes)

The modules were read for the transitions between them, not for themselves. Already sound, and
left as they are: notifications (35 notice types across assignments, tests, courses, batches,
doubts, feedback, certificates, sessions and placement); the learner's search (courses, lessons,
assignments, tests, announcements, labs, each scoped to what the learner reaches); audit of
publishing, role and permission changes, attendance corrections, certificates, exports and privacy
operations; one attendance rule and one percentage function behind every attendance figure. The
gaps found, ranked:

| #   | Gap                                                                                                                                                                                                                                               | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| G1  | The dashboard counted course progress differently from the progress report: withdrawn enrolments and courses the batch never had were included, so a trainer's dashboard showed another batch's course and a shared learner's progress in it (D6) | P0       |
| G2  | Removing the learner role left the person's batch places: still on rosters, roll calls and batch notices                                                                                                                                          | P0       |
| G3  | New content could be given to an archived batch or programme (courses, assignments, test windows, classes, feedback forms, announcements)                                                                                                         | P0       |
| G4  | Staff search found people and batches but no courses, assignments or tests, and sent a trainer's student, trainer and programme results to admin pages they cannot open                                                                           | P1       |
| G5  | A doubt's answer stayed unread in the bell after the learner had read it in the thread                                                                                                                                                            | P2       |

## 2. Decisions (first pass)

| #   | Decision                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | **Course figures count the learners taking a course** (active or completed); a withdrawn enrolment is access that ended (D4) and stays listed, marked, out of the figures. A view narrowed to batches counts only the courses those batches have. The dashboard and the progress report apply the same rule. |
| P2  | **No longer a learner, no longer in a batch.** When the learner role goes and no remaining role lets the person hand in work, their batch places end through the same rule as an administrator's removal (audited; enrolments withdrawn by the existing event). The learner record stays.                    |
| P3  | **An archived batch or programme is history**: nothing new is given to it (422 `audience_archived`). A completed batch still takes content.                                                                                                                                                                  |
| P4  | **Staff search reuses each module's list rules** (`CoursesService.list`, `AssignmentsService.list`, `TestsService.list`), so it never reaches more than the list page; hits open in the portal the searcher's roles give them.                                                                               |
| P5  | **Opening a thread reads its notices**, whichever portal they were sent for (generalised by P11).                                                                                                                                                                                                            |

## 3. Items built (first pass)

| ID    | Item                                                                                           | Commit                          |
| ----- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| P5-01 | Staff search for courses, assignments and tests; portal-correct links for every staff hit (G4) | `87d37a0`                       |
| P5-02 | Reading a doubt's thread reads its notices (G5)                                                | `3ef0a61`                       |
| P5-03 | One course-progress rule for the dashboard and the progress report (G1)                        | `1d52556`                       |
| P5-04 | Batch places end with the learner role (G2)                                                    | `3330270`                       |
| P5-05 | Nothing new for an archived batch or programme (G3)                                            | `d3d1256`                       |
| P5-06 | The integration spec: one learner followed across the modules, and the staff-search boundary   | all above, `5f83c46`, `8f2edc1` |

## 4. First-pass record

**The integration spec** (`apps/api/test/integration.e2e-spec.ts`) follows one learner through a
course published to their batch: reached by them and by the batch's trainer and found by search,
and by nobody else; a doubt taken to the trainer and the answer back, read once the thread is
opened; the lesson completed into a completed enrolment, a certificate and the trainer's view; one
attendance figure for the learner, the trainer and the report; nothing new for an archived batch;
batch places ending with the learner role; staff search bounded by the staff lists; and the
learner moved to another batch, after which their open course is withdrawn while the finished one
stays theirs (§6), what the new batch already has reaches them, the old batch's trainer reaches
neither the learner nor their doubt, and the old batch's courses leave the new batch's figures.
The first pass was verified in session 24 of the progress log; the completion pass re-ran
everything (§8).

## 5. Completion pass: the nine items the first pass deferred

The client asked, the same day, for every deferred item that was technically reasonable to be
finished inside Phase 5, inspected and defined against the existing rules before being built, and
for product questions to be settled by the safest behaviour consistent with those rules.

| #   | Item                                        | What was found                                                                                                                                                                                                                                        |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | A deactivated account kept its batch places | `user.deactivated` had no subscriber: the account stayed on rosters, roll calls and batch notices, its courses stayed open, and direct notices still reached it. An erasure ended places but left the courses open                                    |
| C2  | Completed and archived batches              | Archiving changed nothing for learners; a move withdrew a finished course too, so its completion fell out of the figures; unpublishing left a started learner's course open; a withdrawn course could still complete, and be certified, through a lab |
| C3  | Effects that follow a request               | Enrolment changes, places and certificates hang on in-process events; a handler that dies with its process is retried by nothing. The certificates sweep repaired certificates, but redrew an erased learner's revoked one                            |
| C4  | List reads failing under load               | Every list read its rows and total in one array transaction, which Prisma 7 runs as BEGIN … COMMIT under a 5-second limit; under READ COMMITTED that bought no consistency, only the limit (two 500s on a starved machine)                            |
| C5  | Two identical publishes at once             | Publishing checked, then inserted: racing requests both got in (shown by a test: one racer reached the insert). Assignment publications had the same race; test windows answered a racer with 500                                                     |
| C6  | Notices read on their page                  | Only the doubt thread did it; reviews, results (whose links carry a query), certificates, assignments, courses, recordings, documents and announcements stayed unread until cleared in the bell                                                       |
| C7  | Staff search for labs and the question bank | Absent                                                                                                                                                                                                                                                |
| C8  | A learner's search of their documents       | Absent; also, the learner's labs group listed live labs outside the catalogue (which then 404)                                                                                                                                                        |
| C9  | Overdue assignments                         | No overdue notice; the due-soon notice took the batch publication's date for everyone (ignoring extensions and module due dates) and could never reach a learner added later                                                                          |

## 6. Decisions (completion pass)

**The lifecycle rule** (P6, P7), implemented in one place, `EnrollmentService`:

| State                         | What the learner keeps and gets                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Planned or running batch      | Everything published to the batch, its programme, to them, or to everyone                                                                                                                  |
| Completed batch               | The same, and new content may still be given (P3): learners go on after the timetable ends. No new members (unchanged)                                                                     |
| Archived batch or programme   | Frozen history: nothing new is given (P3), and what it gave ends — open courses are withdrawn; reopening an archived programme gives them back                                             |
| Deactivated or erased account | No place in any batch (each ended as a removal is, audited), no open course, no notice of any kind. The record stays whole: progress, submissions, attendance, certificates, audit history |
| Reactivated account           | The places the deactivation ended come back as new stints (the gap stays on record; an archived batch is not rejoined), and with them the courses                                          |
| Withdrawn enrolment (D4)      | The record and progress stay; access ends; it comes back if the course reaches them again. It does not move: it cannot be completed or certified while withdrawn                           |
| Completed enrolment (L4)      | Never withdrawn by any of the above: completion, its date and the certificate are the learner's record, and they may review what they finished while the course is published at all        |
| Issued certificate            | Unchanged by every lifecycle change; only an administrator's revocation or an erasure ends it                                                                                              |

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6  | **Reach** = a live publication reaching the learner while their account is active or invited and the batch and programme are not archived. Deactivation, reactivation, archiving and a programme's status change are applied inside the request (their events are awaited); an erasure is a deactivation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P7  | **A completed course is never withdrawn (L4)**; unpublishing withdraws a started learner it no longer reaches (an unstarted row is removed, as before); a withdrawn course does not complete. D1 (a course that gains lessons updates finished learners' figures) is unchanged: the certificate, lesson records and activity entry are the lasting evidence.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P8  | **Delivery skips deactivated and erased accounts** however a notice is addressed (by batch, role, everyone or name).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| P9  | **Reconciliation** (`progress.reconcile`, every 15 minutes, so after a restart the next run): re-derives places of deactivated or erased accounts and every learner's enrolments from the records. State-based and idempotent; sends no notices of its own; audited (`progress.reconciled`) when it changes anything; a learner it cannot settle is counted, the rest go on, and the job fails so the queue retries it and the failed-jobs page shows it. A removed learner role is settled inside its own request and is not re-judged periodically (a permission-keyed sweep could empty every batch if an institute reshaped its learner role). The certificates sweep remains the reconciler of certificates: it never redraws a revoked certificate nor issues to an erased account. |
| P10 | **One live publication per audience**, kept by the database: partial unique indexes on course publications (course, audience; a second index for everyone, whose scope id is NULL) and on assignment publications (per batch, per learner). A repeat or a racing request is answered `409 already_published`, so exactly one publication, one audit record and one notice per learner; test windows (already unique) answer `already_scheduled`.                                                                                                                                                                                                                                                                                                                                          |
| P11 | **Opening a page reads the notices that lead to it, and no other.** `@ReadsNotices` on the endpoint a page loads from marks read the caller's unread notices whose link is that page or the page with a query; doubts in any portal. Pages that load from a list (a test's instructions, a feedback form) call `POST /me/notifications/read-page`. Announcements and broadcasts, whose page is the centre, are read when the centre shows them — never by the bell's polling, never ones the centre did not show.                                                                                                                                                                                                                                                                         |
| P12 | **Deadline notices per learner** from `learnerState` (the learner's own assignment page): due soon a day before the date that applies to them; overdue once it has passed with work missing and late work still accepted. Notices that a job may raise again carry a dedupe key (`notifications.dedupe_key`, unique per person), so each reaches a person once; queued deliveries get one too, so a retried delivery writes nothing twice.                                                                                                                                                                                                                                                                                                                                                |
| P13 | **Search** for staff labs and the question bank reuses their list services (a trainer: own questions, own and published labs; managers: all); hits carry titles and statuses, never bodies, answers or hidden tests. A learner's Documents: their own documents, résumés and issued certificates, and the files of what they reach now, each hit naming a page that checks again and signs any download itself.                                                                                                                                                                                                                                                                                                                                                                           |
| P14 | **List reads run outside transactions**: rows and total are independent reads side by side; the ten writing array transactions stay transactions; the 5-second limit is not raised.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## 7. Items built (completion pass)

| ID    | Item                                                                                                        | Commit    |
| ----- | ----------------------------------------------------------------------------------------------------------- | --------- |
| P5-07 | List reads outside transactions; a spec keeps every list transaction-free (C4)                              | `5beb8ba` |
| P5-08 | One live publication per audience: the migration, racing publishes answered as repeats (C5)                 | `941069e` |
| P5-09 | One lifecycle for accounts, batches and programmes; the reconciliation job; certificate sweep fixes (C1–C3) | `74d565e` |
| P5-10 | Overdue notices; due-soon per learner; notices sent once (C9)                                               | `41a4ddd` |
| P5-11 | Opening a page reads its notices (C6)                                                                       | `9ee8b86` |
| P5-12 | Staff search for labs and questions; a learner's documents; the catalogue-only labs group (C7, C8)          | `a328059` |
| P5-13 | Staff pages read their notices too (the roll call, the exports page) (C6)                                   | `4f53461` |
| P5-14 | A reactivation gives each place back once, under the batch-row lock; a full batch is not overfilled (C1)    | `d06f9b5` |
| P5-15 | A new learner is enrolled in what is published to everyone at once, from either page (C2, found by C3)      | `c667ad5` |

## 8. Record (3 October 2026)

**Specs added in the completion pass** (`apps/api/test/`): `list-reads` (every list reads outside
a transaction; it fails against the old code), `lifecycle` (deactivation revokes access and keeps
the record — submissions, attendance, certificates, audit — reactivation gives places and courses
back, a place is given back once however many reactivations race, a completed batch keeps and
still takes content, an archived batch ends open courses and keeps finished ones, a programme
archived and reopened, a withdrawn course neither completes nor certifies), `reconciliation`
(lost-event drift settled and audited; a second run and two simultaneous runs change nothing; one
learner failing leaves the rest settled, fails the job, and the retry settles them; the job is
scheduled), `deadlines` (not due, due soon, overdue, handed in, left the batch, deactivated,
extended, closed to late work, repeated and simultaneous runs), `notice-reading` (every page's
notices and only those; another learner's untouched; the bell reads nothing; the centre only what
it shows; staff roll calls and exports), `search-reach` (trainer, content manager and administrator
scope for labs and questions; no answers; learner documents by reach; no other learner's papers; no
file addresses; files gone once access ends); race tests in `courses`, `assessment` and `tests`
(five identical requests at once: one in, four `409`); the erasure test in `admin-operations` (open
course withdrawn, finished kept, nothing redrawn or issued). Two of the new tests were checked
against the code before the fix and failed there: list reads (`/users` opened a transaction) and
a publish race (one racer reached the insert and, without the index, a duplicate); so was the
reactivation race (two simultaneous restores gave back two places without the lock).

**The reconciliation job in the field.** On the QA copy of `lms`, after the browser runs, its first
scheduled run settled 62 learners, ended no place, withdrew nothing and made one enrolment: a
learner the administrator's browser journey had created without a batch had none in a course
published to everyone, because enrolments were derived on publication and on joining a batch only.
That cause is fixed (P5-15), so the job found a real gap and the fix closes it at the source.

**Fixed on the way.** A first full run failed in `sessions` because the new lifecycle spec left a
class on the shared test trainer's timetable at the hour the suite ran: the class now sits late
in the evening and is removed afterwards. The learner notices test assumed unread notices the
pages before it now read: it makes its own. Two older specs made the suite pass or fail by the clock and by
file order: the Phase 2 learner spec left a class two days ahead on the shared trainer's timetable
(it clashed with the sessions spec's morning series; reproduced, fixed), and the Task 2 engagement
spec gave a learner a STU-2026-<six digits> code that derailed the year's code sequence (fixed).

**Main local database (`lms`).** Before migrating: backup `E:\LMS-backups\lms-before-phase5.dump`
(568,656 bytes, SHA-256 `4aeb0cb0…3032022` in the `.sha256` beside it), restored into a scratch
database and compared table by table — all 79 tables, 4,314 rows, identical content fingerprints —
then the scratch copy dropped. Target checked (`lms` on the LMS container, port 5433); one pending
migration. `db:migrate` applied `20261005090000_phase5_integration` (12 of 12, none failed): the
five unique indexes and the nullable `notifications.dedupe_key` are present. Compared row by row
over each table's earlier columns: 78 tables unchanged, `_prisma_migrations` one row more (4,314 →
4,315). No data was changed, and the reconciliation job has not run on `lms` (no API ran on it).

**Not touched:** the ET-EMS and SLTS containers (same set, stopped, same start and finish times as
at the Phase 2 gate) and every other database on the LMS server; the QA copy `lms_phase5b_qa` was
made from the migrated `lms` for the browser runs and dropped afterwards.

**Evidence of the final runs:** session 25 of the progress log.

## 9. Deferred, with the phase that owns it

Nothing Phase 5 found in cross-module integration is left open. Two things outside it, found on
the way, belong to later phases:

| Item                                                                                                                                                                                                        | Phase |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| The `suspended` account status is never set by any code path, but an invitation could still be accepted by a suspended account (authentication, not integration; latent today) — resolved in Phase 6 (P6-3) | 6     |
| The reconciliation job settles each learner in turn; for institutes far larger than SI Academy's it would be worth batching (performance)                                                                   | 12    |
