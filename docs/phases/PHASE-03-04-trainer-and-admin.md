# Phases 3 and 4 — Trainer and staff completion, Admin and operations completion

| Field    | Value                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **In progress** — started 3 October 2026 on the client's approval                                                                                                 |
| Scope    | The client's brief of 3 October 2026 ("Combined Phase 3 + Phase 4"); the items in §3 are its approved backlog (operating rule 2). Phases 3 and 4 run as one batch |
| Roadmap  | `docs/ROADMAP.md`, Phases 3 and 4 (gates: the trainer is a genuine operational role; every operation uses server-side authorisation, proved by the matrix tests)  |
| Baseline | Phase 2 is locked (`3f9ec2c`); it is changed only where a regression or blocker is found                                                                          |
| Boundary | Non-AI. No RAG, embeddings, agents or LLM calls (Phases 7–11). Cross-module journeys as a phase of their own stay Phase 5; hardening stays Phase 6                |

## 1. Audit (3 October 2026)

Five read-only audits covered the trainer's delivery, assessment and insight modules and the
administrator's people, system and academic operations, reading each page, route, service,
authorisation check and test. The detailed findings are in the progress log's session entry; the
summary:

| Area                      | State before                             | Most important findings                                                                                                                                              |
| ------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role boundaries           | Sound at the guard                       | Every route refuses a role that lacks its permission (now proved for every route); the holes are object-level and in role administration                             |
| Tests (staff)             | **Broken (authorisation, data)**         | A trainer could change another author's test for every batch; saving a paper after attempts deleted submitted answers                                                |
| Question bank             | Partial                                  | Any published question could be put on a paper by id, showing its key to the author of the paper; in-use questions stayed editable; edits left coding questions live |
| Users and roles           | **Partial (escalation)**                 | An administrator could grant themselves any role but the Super Admin's, including roles carrying Super Admin-only permissions; bundles accepted any scope            |
| Batches and students      | **Partial (data integrity)**             | Transfers were not atomic; students created or imported with a batch were never enrolled in its courses; `unassigned` exposed every unassigned learner to trainers   |
| Trainer dashboard         | Partial                                  | Announcements shown whatever their audience; counts disagree with queues; no courses or deadlines                                                                    |
| Trainer batches, students | Partial                                  | Links into admin pages (403); a learner in two batches exposes the other batch's records                                                                             |
| Trainer courses, lessons  | Read-only; lesson management **missing** | No trainer-course assignment exists; the course page is the learner's; recordings reach courses outside the batch                                                    |
| Attendance                | Mostly complete                          | Correction history only in the audit log; save not atomic                                                                                                            |
| Assignments, reviews      | Complete (core)                          | Late work not shown to reviewers; dashboard and queue disagree                                                                                                       |
| Labs                      | Complete                                 | Debugging and web labs are not yet usable in assignments (ADR-0018 gives that to Phase 3)                                                                            |
| Doubts                    | Complete (core)                          | No notices on resolve/reopen; no filters by course or batch                                                                                                          |
| Reports and exports       | Built (5 reports)                        | No trainer-performance, certificates, projects or placement reports; exports scoped by read, not export, permission                                                  |
| Announcements             | Missing for trainers                     | Broadcasts are not audited and have no screen                                                                                                                        |
| Feedback (F-18)           | Missing                                  | No model, module or permission                                                                                                                                       |
| Enrolment                 | Partial                                  | Derived from publication only (ADR-0010); no individual enrolment                                                                                                    |
| Certificates admin        | Missing                                  | No staff list, revoke, reinstate or reissue                                                                                                                          |
| Feature flags             | Partial                                  | Audiences ignored by the module guard (fixed first); ids unvalidated; no audience screen                                                                             |
| Audit, health, privacy    | Partial                                  | Admin audit scope is `own`; no failed-job retry; no data export or erasure; no retention                                                                             |

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Trainer reach stays the batch** (the requirements' permission matrix), shared by a batch's co-trainers. **Authority over course content comes from course staff**: an administrator assigns trainers to a course (ADR-0023, proposed).                                                                                                         |
| D2  | **Authored staff content is changed by its author or by institute-wide staff** — assignments (already), tests (fixed), questions (already). Reaching content through a batch is enough to use it, not to change it for every batch.                                                                                                              |
| D3  | **What has been answered is fixed.** A test's paper cannot change once anyone has sat it; a question's answer cannot change once it has been answered; a coding or SQL question must pass its check to be put on a paper.                                                                                                                        |
| D4  | **No privilege is handed out by someone who does not hold it.** Granting, removing or managing a role needs every permission the role carries, at the same scope or wider (own-record grants aside); nobody but a Super Admin changes their own roles.                                                                                           |
| D5  | **Flag audiences are enforced on the server**, by role and by batch; staff with no batch of their own are not limited by a batch audience; the Super Admin is never shut out.                                                                                                                                                                    |
| D6  | **A trainer sees a learner within the trainer's batches**: attendance, progress, tests and doubts from the batches they teach, not every batch the learner is in. Which batches a learner is in stays visible, as context; a question's answer count stays institute-wide, because it says whether the question is fixed (D3), not who answered. |
| D7  | **Trainers announce to their own batches** (`announcements:manage` at batch scope) and manage only what they wrote; broadcasts are audited and rate-limited.                                                                                                                                                                                     |
| D8  | **Individual enrolment is a publication to one learner** (a new publication scope), so enrolment stays derived from publication (ADR-0010) and withdrawing follows its rules.                                                                                                                                                                    |
| D9  | **Certificates are administered, never rewritten**: revoke and reinstate with a reason, reissue the PDF, all audited; the record's text stays the snapshot taken at issue.                                                                                                                                                                       |
| D10 | **Feedback (F-18)** answers the open questions Q-16 and Q-17 with the approved criteria: responses anonymous unless the form says otherwise and never traceable when anonymous (AC-13.2); aggregates hidden under five responses; a trainer sees their own.                                                                                      |

## 3. Items (the approved backlog of this batch)

**P0 — security and data integrity**

| ID     | Item                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEC-01 | Role boundary proved on every route for student, trainer and administrator (done: `role-boundaries.e2e-spec.ts`)                                                                                 |
| SEC-02 | D2 and D3 for tests and questions; papers take only questions the author may read                                                                                                                |
| SEC-03 | D4 for user roles; role bundles keep to the catalogue's scopes; no copy of the Super Admin role                                                                                                  |
| SEC-04 | Batch membership through one path: atomic transfers, status and capacity checks, enrolment for created and imported students                                                                     |
| SEC-05 | Trainer scope holes: `unassigned` students, dashboard announcements, a learner's other batches (D6), recordings outside the batch, exports by export scope, staff scope from taught batches only |
| SEC-06 | Audit gaps: broadcasts, document links through `/files`, re-marks after release                                                                                                                  |
| SEC-07 | D5 flag audiences (done in the guard); audience ids validated                                                                                                                                    |

**P1 — trainer workflows (Phase 3)**

| ID     | Item                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| TRN-01 | Dashboard: assigned courses, deadlines, review counts that match the queues, the institute's day                                    |
| TRN-02 | Batches and students: trainer links throughout, a students list, batch progress and assessments                                     |
| TRN-03 | Courses and lessons: course staff (D1), a trainer course view with learner progress, lesson editing and publishing to their batches |
| TRN-04 | Attendance: correction history, filters, an atomic save                                                                             |
| TRN-05 | Tests: window edit and extension, unpublish and archive, a grading queue with re-marking that moves attempts to graded              |
| TRN-06 | Reviews: late work shown; test answers waiting for marks reachable                                                                  |
| TRN-07 | Doubts: notices on resolve and reopen, filters by course and batch, context links                                                   |
| TRN-08 | Announcements (D7): a trainer screen with history                                                                                   |
| TRN-09 | Reports: export links per portal; dashboard figures that match the reports                                                          |
| TRN-10 | Feedback (D10): forms to a batch, anonymous responses, aggregates for the trainer and the administrator                             |

**P1 — administration and operations (Phase 4)**

| ID     | Item                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADM-01 | Users: unlock, a user's sessions with revoke, profiles created with learner and trainer roles                                                                          |
| ADM-02 | Students: an administrator's overview (progress, attendance, results); a verification queue                                                                            |
| ADM-03 | Programmes and batches: editing and transfers from the screens                                                                                                         |
| ADM-04 | Enrolment (D8): per-course enrolments with individual enrol and withdraw                                                                                               |
| ADM-05 | Certificates (D9): staff list, revoke and reinstate, reissue                                                                                                           |
| ADM-06 | Reports: certificates, projects, placement and trainer performance; stale pending reasons removed                                                                      |
| ADM-07 | Placement: staff access to an applicant's résumé; applicant export                                                                                                     |
| ADM-08 | Feature flags: an audience editor                                                                                                                                      |
| ADM-09 | Audit: filters (person, dates) and a CSV export; administrators keep their own actions, as the requirements' matrix sets it (the institute's log is the Super Admin's) |
| ADM-10 | Operations: failed jobs with retry beside system health (Super Admin)                                                                                                  |

**P2 — completions the roadmap places here**

| ID     | Item                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------ |
| TRN-11 | Debugging and web labs usable in assignments (ADR-0018: "available to assignments in Roadmap Phase 3")                   |
| TRN-12 | A code editor with Run on the visible cases inside timed tests (deferred from Phase 2 to Phase 3)                        |
| ADM-11 | Privacy operations (roadmap Phase 4): a learner's data export; erasure by anonymisation, Super Admin only, audited       |
| ADM-12 | Retention (finding 10): expired exports and finished import sheets removed; audit retention configurable, off by default |
| ADM-13 | Certificate signatory on the PDF (the "templates, signatories" deferred from Phase 2)                                    |

**P3 — verification**

| ID     | Item                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| TST-01 | Object-scope API tests: trainer batch A against B, course A against B, learner A against B; administrator against Super Admin |
| TST-02 | Browser journeys for the trainer and the administrator, desktop and phone; the Phase 1 and 2 suites as regression             |

## 4. Quality gate

As Phase 2's: type-check, lint, unit, API, sandbox, question bank and browser suites pass; the
build passes; the migration applies to a copy of the sample data and then to the main database
after a verified backup; the role-boundary and object-scope tests pass; no secret is introduced; no
control is weakened; the documentation is updated.

## 5. Deferred, with the phase that owns it

| Item                                                                                                 | Phase |
| ---------------------------------------------------------------------------------------------------- | ----- |
| An embedded Unicode font for certificates (a new dependency and font file, so an ADR-0022 amendment) | 6     |
| Question versions screen; transactional question import that writes versions                         | 5     |
| Doubt attachments, FAQ conversion and response-time metrics (F-27 extras)                            | 5     |
