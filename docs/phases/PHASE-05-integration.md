# Phase 5 — Cross-module enterprise integration

| Field    | Value                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status   | **Built and verified — awaiting the client's gate decision** (3 October 2026); the record is §4                                                              |
| Scope    | The client's Phase 5 brief of 3 October 2026: a strict two-hour window on the highest-value cross-module gaps, verified rather than broad (operating rule 2) |
| Roadmap  | `docs/ROADMAP.md`, Phase 5 (gate: the student, trainer and admin journeys pass end to end)                                                                   |
| Baseline | `9369b50` (Phases 0–4 approved); the Phase 3–4 decisions D1–D10 and ADR-0023 kept as they are                                                                |
| Boundary | Non-AI; no migration; no new infrastructure; no UI redesign. Hardening stays Phase 6                                                                         |

## 1. Inspection (first ten minutes)

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

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | **Course figures count the learners taking a course** (active or completed); a withdrawn enrolment is access that ended (D4) and stays listed, marked, out of the figures. A view narrowed to batches counts only the courses those batches have. The dashboard and the progress report apply the same rule. |
| P2  | **No longer a learner, no longer in a batch.** When the learner role goes and no remaining role lets the person hand in work, their batch places end through the same rule as an administrator's removal (audited; enrolments withdrawn by the existing event). The learner record stays.                    |
| P3  | **An archived batch or programme is history**: nothing new is given to it (422 `audience_archived`). A completed batch still takes content.                                                                                                                                                                  |
| P4  | **Staff search reuses each module's list rules** (`CoursesService.list`, `AssignmentsService.list`, `TestsService.list`), so it never reaches more than the list page; hits open in the portal the searcher's roles give them.                                                                               |
| P5  | **Opening a thread reads its notices** (`NotificationsService.markReadAt`), whichever portal they were sent for.                                                                                                                                                                                             |

## 3. Items built

| ID    | Item                                                                                           | Commit               |
| ----- | ---------------------------------------------------------------------------------------------- | -------------------- |
| P5-01 | Staff search for courses, assignments and tests; portal-correct links for every staff hit (G4) | `87d37a0`            |
| P5-02 | Reading a doubt's thread reads its notices (G5)                                                | `3ef0a61`            |
| P5-03 | One course-progress rule for the dashboard and the progress report (G1)                        | `1d52556`            |
| P5-04 | Batch places end with the learner role (G2)                                                    | `3330270`            |
| P5-05 | Nothing new for an archived batch or programme (G3)                                            | `d3d1256`            |
| P5-06 | The integration spec: one learner followed across the modules, and the staff-search boundary   | all above, `5f83c46` |

## 4. Record (3 October 2026)

**The integration spec** (`apps/api/test/integration.e2e-spec.ts`) follows one learner through a
course published to their batch: reached by them and by the batch's trainer and found by search,
and by nobody else; a doubt taken to the trainer and the answer back, read once the thread is
opened; the lesson completed into a completed enrolment, a certificate and the trainer's view; one
attendance figure for the learner, the trainer and the report; nothing new for an archived batch;
batch places ending with the learner role; staff search bounded by the staff lists; and the
learner moved to another batch, after which access ends, the record and the certificate stay, what
the new batch already has reaches them, the old batch's trainer reaches neither the learner nor
their doubt, and the withdrawn course leaves the new batch's figures. Work that events finish after the response is awaited the way the specs
already did (one shared helper, `test/setup/eventually.ts`).

**Evidence:** the progress log, session 24, gives the exact counts of the final run.

## 5. Deferred, with the phase that owns it

| Item                                                                                                                                                                                                                   | Phase  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Whether a deactivated account keeps its batch places (it does today: rosters and roll calls still list it)                                                                                                             | client |
| Whether learners of a completed or archived batch keep their courses, and a completed course after a move (D4 withdraws it)                                                                                            | client |
| Reading other notices on opening their page (reviews, released results: their links carry query strings)                                                                                                               | 12     |
| A partial unique index for live course publications (two identical publishes at once)                                                                                                                                  | 6      |
| A scheduled reconciliation of event-driven effects (enrolments, certificates): finding 9 of Phase 2, unchanged                                                                                                         | 6      |
| List pages read their rows and total in one array transaction, which Prisma 7 runs under its 5-second limit; on this 7 GB machine, starved of memory during the browser run, two assignment-list reads failed with 500 | 6      |
| Staff search for labs and the question bank; a learner's search of their own documents                                                                                                                                 | 12     |
| An "overdue" notice for assignments (a "due soon" notice exists)                                                                                                                                                       | 12     |
