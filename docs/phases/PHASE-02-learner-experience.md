# Phase 2 — Complete learner experience

| Field    | Value                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | **Built, awaiting the client's gate approval** — started and built 2 October 2026; the record is §7                                                                  |
| Scope    | The client's Phase 2 brief of 2 October 2026 ("Phase 2 — Complete all learner modules"); the items in §3 are its approved backlog (operating rule 2)                 |
| Roadmap  | `docs/ROADMAP.md`, Phase 2                                                                                                                                           |
| ADRs     | ADR-0022 (certificates); ADR-0010, ADR-0016, ADR-0018 to ADR-0021 kept as they are                                                                                   |
| Boundary | Learner side only. Staff screens, admin operations, hardening and AI stay in Phases 3, 4, 6 and 7–11; a staff capability is added only where a learner flow needs it |

## 1. Audit (2 October 2026)

All 19 learner modules were read end to end before any change: API services and controllers, shared
schemas, web pages, module READMEs and the existing tests. A module is **complete** only if its core
learner workflow works end to end; a page existing is not enough.

| #   | Module        | State             | Main findings                                                                                                                                                                                                                                                                                               | Action           |
| --- | ------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Dashboard     | Partial           | "Today" is a rolling window, not the institute's day, and finished classes push upcoming ones out; activity and notifications are computed but not shown; Labs are fetched but not shown; an error reads as "nothing to do"; task status uses a different rule from the assignment pages                    | LRN-01           |
| 2   | Courses       | Partial           | Editing an outline never recomputes progress; module counts include optional lessons; a finished course still offers "Continue"; archived courses and learners moved out of the batch keep access (ADR-0010's remedy is not honoured); a learner's `?status=` lifts the published filter                    | LRN-02           |
| 3   | Lessons       | Broken            | The video player remounts in a loop once a lesson is complete; the `watch` rule trusts a percentage the browser sends; practice lessons can be skipped with "Mark complete"; rules that can never be met can be authored; "Next" leads into locked lessons                                                  | LRN-03           |
| 4   | Schedule      | Partial           | No deadlines; no class detail or notes; "Live now" 15 minutes early; a past class may still read "Scheduled"; ranges start at UTC midnight; the join link is sent before the class is joinable                                                                                                              | LRN-04           |
| 5   | Attendance    | Partial           | One percentage is computed three ways (progress page, attendance detail, weekly alert); no page of its own; history without class times                                                                                                                                                                     | LRN-05           |
| 6   | Assignments   | Partial           | Lateness is promised but never recorded; handed-in files are never shown back; a sandbox error counts as answered; **answer keys leak** under `after_due` while late answers are still accepted; the attempt limit can be raced                                                                             | LRN-06           |
| 7   | Tests         | Broken            | The countdown starts short and can lock a learner out early; SQL, file, practical and project questions can be put on a paper that cannot answer them; a submitted paper reopens as editable; **the key is reachable during an attempt**; section scores show before release; the review policy is bypassed | LRN-07           |
| 8   | Coding        | Partial           | One execution path (ExecutionService → runner), but assignment runs skip the per-person gate of ADR-0021; tests take code in a plain text box                                                                                                                                                               | LRN-08           |
| 9   | Labs          | Needs integration | Engine complete (Phase 1). The dashboard ignores Labs; the progress page calls them "Practice", counts retired labs and does not link to them; passing a catalogue lab leaves the course page stale                                                                                                         | LRN-09           |
| 10  | Progress      | Partial           | Stored and live figures disagree after content changes; the overall figure is weighted differently from staff reports; "Test average 0%" when nothing is released; the activity feed records only lessons and courses                                                                                       | LRN-10           |
| 11  | Streaks       | Partial           | Computed on read in the institute's time zone, not writable by the client (sound). The leaderboard adds every retake; attempts the server auto-submitted count as the learner's activity                                                                                                                    | LRN-11           |
| 12  | Doubts        | Complete (core)   | Ask, track, answer, resolve work and are private. Staff links always point at the trainer portal; reopening an answered doubt does nothing; a learner without a trainer notifies nobody                                                                                                                     | LRN-12           |
| 13  | Profile       | Partial           | **One rejected document keeps verification pending for ever**; field and upload errors show only "One or more fields are invalid"; learners cannot download their documents or hear when one is reviewed; uploaded files attached to records can be deleted; password change is not throttled               | LRN-13           |
| 14  | Projects      | Partial           | The whole loop works as project assignments (publish, hand in links/files/checklist, review, resubmit), but there is no Projects view and handed-in files cannot be reopened                                                                                                                                | LRN-14           |
| 15  | Certificates  | Missing           | Nothing issues certificates; `course.completed` is emitted and nobody listens. Requirements already approved: F-16, CR-S10, AC-10.1 to AC-10.3                                                                                                                                                              | LRN-15, ADR-0022 |
| 16  | Notifications | Partial           | No e-mail links back to the portal (relative links are dropped); no notice for a new class, a test opening, an assignment due soon, a reviewed document or a certificate; "Open" leaves items unread; `unread=false` behaves as true; announcement links point at the page itself                           | LRN-16           |
| 17  | Placement     | Partial           | Board, eligibility, apply and withdraw, stages and kits work and are rechecked on the server. An expired drive reads "Not eligible"; applying without a résumé succeeds while the page says it is attached                                                                                                  | LRN-17           |
| 18  | Search        | Partial           | Courses are found whatever their status; only coding labs are found, at an old address; individually assigned work is missed; no tests or announcements; no ordering; the results page is unreachable; staff search ignores trainer and batch scope                                                         | LRN-18           |
| 19  | Documents     | Partial           | Access is checked per object and no route takes a storage key (sound). Downloads open a pop-up after an awaited call, which phones block; a missing file shows a raw storage error                                                                                                                          | LRN-19           |

Browser journeys today: J1, J3, J10 and J16 covered; J2, J4–J9, J14, J15 and J17 partly; J11, J12,
J13 and J18 not at all.

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **One progress model.** A course's percentage is completed mandatory lessons over mandatory lessons (all lessons when none is mandatory), recomputed whenever a lesson completes and whenever the course's lessons change. Completion follows the percentage, as today. Every figure shown to a learner reads it from one service.                                                           |
| D2  | **Watch time is measured by the server.** A `watch` lesson completes on watched seconds the API accumulates between progress reports, bounded by the time that really passed (at most twice real time, for faster playback), never on a percentage the browser asserts.                                                                                                                      |
| D3  | **Completion rules fit the lesson type**, enforced on save: video `watch`, `view` or `manual`; article and resources `view` or `manual`; practice and lab `pass` (practice passes on a correct answer). Existing practice lessons move to `pass`; any rule a type cannot meet moves to that type's default.                                                                                  |
| D4  | **Course access follows ADR-0010's own remedy.** A learner opens a course only while it is published and their enrolment is active or completed. Leaving every batch a publication reaches marks the enrolment `withdrawn`: access ends, the record stays, and it comes back if they rejoin. Withdrawing a publication still keeps learners who started (ADR-0010, rule 3).                  |
| D5  | **Certificates (ADR-0022).** Issued automatically when a course is completed, as an immutable record with a public verification code; a PDF drawn with pdf-lib and kept in private storage; downloaded through a signed link; verified on a public, rate-limited page. Behind the `certificates` module flag. Revocation is recorded and verified now; the admin screens for it are Phase 4. |
| D6  | **Projects reuse assignments.** The Projects view lists the assignments that contain a project question; the hand-in, review and resubmission flow stays the assignment flow. No new tables.                                                                                                                                                                                                 |
| D7  | **Answer keys and scores never reach a learner early.** Keys and explanations appear only once the learner can no longer answer (the assignment closed for them, or no attempts left; a test submitted and its results released); section scores follow the score policy.                                                                                                                    |
| D8  | **Deferred, not invented.** Hosted video (needs a CSP change for a third-party player, a security decision for the client), interview scheduling and placement documents (staff authoring, Phases 3–4), session revocation in the access-token guard (Phase 6), inline document previews and server drafts for assignments (§6).                                                             |

## 3. Items (the approved backlog of this phase)

| ID     | Item                                                                                                                                                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LRN-01 | **Dashboard.** The institute's day for "today"; finished classes leave the list; recent activity, recent notifications and Labs (continue a lab) shown; task status from the assignment module's own rules; separate first-time, nothing-to-do and error states; certificates shown when there are any. |
| LRN-02 | **Courses.** Recompute on outline changes (D1); module counts on mandatory lessons; "Continue" only while something mandatory remains; access per D4; a learner cannot list unpublished courses; the course page links its assignments.                                                                 |
| LRN-03 | **Lessons.** The player remount loop fixed; watch evidence on the server (D2); completion rules per type (D3); no "Mark complete" where an answer or a pass completes; "Next" skips locked lessons; progress saved on pause and when the page is hidden; caches refreshed after a practice answer.      |
| LRN-04 | **Schedule.** Assignment and test deadlines on the schedule; class detail with notes and the cancellation reason; status by the clock; ranges by the institute's day; the join link only once the class is joinable.                                                                                    |
| LRN-05 | **Attendance.** One summary rule for every figure; an Attendance page for the learner with class times and history.                                                                                                                                                                                     |
| LRN-06 | **Assignments.** Late answers recorded and shown; handed-in files shown back; a sandbox error is not an answer; D7 for `after_due`; the attempt limit checked inside the transaction.                                                                                                                   |
| LRN-07 | **Tests.** The countdown anchored to the server; papers refuse question types a test cannot take; a submitted paper never reopens for editing; D7 for results and scores; the review policy enforced on the paper; the test's instructions shown; attempt history.                                      |
| LRN-08 | **Coding.** Assignment runs go through the per-person execution gate (ADR-0021).                                                                                                                                                                                                                        |
| LRN-09 | **Labs.** Labs on the dashboard and the progress page with the hub's own counting; the course page refreshed after a pass.                                                                                                                                                                              |
| LRN-10 | **Progress.** D1 everywhere; "—" when no test result is out; activity for assignments, tests and labs as well as lessons.                                                                                                                                                                               |
| LRN-11 | **Streaks.** The leaderboard counts the best attempt per test; auto-submitted attempts are not the learner's activity.                                                                                                                                                                                  |
| LRN-12 | **Doubts.** Staff links per portal; reopening works; with no trainer, staff who answer for everyone are notified.                                                                                                                                                                                       |
| LRN-13 | **Profile and documents.** Verification from the latest document of each kind; per-field errors shown; learners download their own documents and are told when one is reviewed; files attached to records cannot be deleted; password change throttled.                                                 |
| LRN-14 | **Projects.** A Projects page and navigation entry (D6); handed-in files reopened from the history.                                                                                                                                                                                                     |
| LRN-15 | **Certificates.** D5: issue on completion (event plus sweep), learner list and download, notification, public verification page.                                                                                                                                                                        |
| LRN-16 | **Notifications.** Absolute links in e-mail; notices for a new class, a test opening, an assignment due soon, a reviewed document and a certificate; "Open" marks read; correct `unread` filter; announcement links; learner-facing category names.                                                     |
| LRN-17 | **Placement.** Expired drives read as closed; applying without a résumé is explained before it happens.                                                                                                                                                                                                 |
| LRN-18 | **Search.** Published courses only; every live lab at `/labs`; individually assigned work; tests and announcements; ordering; a "see all" link, error state and the query kept in the address; staff search honours trainer and batch scope.                                                            |
| LRN-19 | **Documents and resources.** Downloads without pop-ups; a missing file answered as "not found"; link resources labelled.                                                                                                                                                                                |
| LRN-20 | **Cross-module journeys.** Completion → progress → dashboard → streak → notification, and the chains of the brief, verified end to end.                                                                                                                                                                 |
| LRN-21 | **Security.** Object-level authorisation proved for submissions, attempts, attendance, doubts, certificates, notifications and documents; no answer key early; no client-asserted completion.                                                                                                           |
| LRN-22 | **Tests.** Unit and property tests for the rules; API tests with allow and deny for every new endpoint; browser journeys J1–J18 on Chromium and the phone; the full regression including the Phase 1 Labs.                                                                                              |
| LRN-23 | **Documentation.** ADR-0022, module READMEs, runbooks, the roadmap and implementation baseline, the progress log, the OpenAPI document.                                                                                                                                                                 |

## 4. Design summary

As built (§7 records where it differs from the plan):

- **Schema (one additive migration):** `lesson_progress.watched_seconds` and `last_progress_at`;
  the `withdrawn` enrolment status; `submissions.is_late`; the `certificates` table; practice
  lessons moved to `pass`, and any rule a type cannot meet moved to that type's default.
- **Events and jobs:** saving an outline recomputes progress directly (the courses module already
  calls the progress service); `course.completed` → certificate issue, with a five-minute sweep;
  `batch.members_changed` with removals → withdrawal; `submission.created`, `attempt.submitted`
  and `execution.completed` → recent activity; hourly reminders for assignments due and test
  windows closing; notices for a class scheduled, a document reviewed and a certificate issued.
- **New learner routes:** `/projects`, `/certificates`, `/attendance`; public `/verify/[code]`.
- **New API:** `GET /me/certificates`, `GET /me/certificates/:id/download`,
  `GET /public/certificates/:code`, `GET /me/deadlines`, `GET /me/documents/:id/download`;
  `GET /me/assignments?questionType=project` serves the Projects page (no `/me/projects` route);
  `POST /me/notifications/read-all?category=`.

## 5. Quality gate

The phase is complete only when type-check, lint, unit, API, sandbox, question-bank and browser
journeys (Chromium and the phone) pass, the build passes, the Phase 1 Labs regression passes, the
migration applies to a copy of the sample data, no secret is introduced, no control is weakened, the
documentation is updated and the diff has been reviewed.

## 6. Deferred, with the phase that owns it

| Item                                                                                 | Phase  |
| ------------------------------------------------------------------------------------ | ------ |
| Hosted video (a third-party player needs a CSP frame allowance: a security decision) | client |
| Interview slots and placement documents on applications (staff authoring)            | 3–4    |
| Certificate administration: manual issue, revoke, templates, signatories             | 4      |
| Project and certificate tiles and reports for staff                                  | 3–4    |
| Ending a revoked session's access token before it expires                            | 6      |
| Inline previews of documents                                                         | 5      |
| Server-side drafts for assignment answers (the browser keeps them today)             | 5      |
| A full code editor with "Run" inside timed tests                                     | 3      |
| Signed storage links reachable from browsers on staging (finding 1)                  | 6, 14  |
| A scheduled reconciliation of enrolments against memberships (review finding 9)      | 6      |
| Requiring a length for a `watch` video when it is authored (review finding 5)        | 3      |
| An embedded Unicode font for certificates (names in other scripts)                   | 4      |

## 7. Implementation record (2 October 2026)

Every item of §3 is built. What changed from §2 to §4 while building it, and why:

- **Projects need no route of their own** (D6). The learner's assignment list takes a question
  type, so the Projects page reads `GET /me/assignments?questionType=project`.
- **Deadlines have an endpoint of their own** (`GET /me/deadlines`), so the schedule's week shows
  what is due without loading the assignment and test lists.
- **An outline change recomputes progress directly**, not through an event: the courses module
  already depends on the progress service, and the save should answer with figures that are right.
- **Found and fixed on the way:** the dashboard listed notifications without leading to them; the
  sign-in form showed a raw validation message for an empty password; every project card's link
  read only "Open" to a screen reader; `unread=false` returned everything.

**Security review.** An independent, read-only review of the whole change; every finding was
checked against the code before it was acted on, and every fix has an API test
(`learner.e2e-spec.ts`, `tests.e2e-spec.ts`).

| #   | Finding                                                                                | Outcome                                                                                              |
| --- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | A class's join link could still be read days ahead through `/sessions` and a series    | Fixed: held back on every route a learner reads classes through                                      |
| 2   | A test's key opened when the learner's own batch's window closed, not the test's last  | Fixed: the review waits for every window of the test                                                 |
| 3   | Which answers were right showed before the windows closed (usable on a second attempt) | Fixed: totals only until then                                                                        |
| 4   | Watch credit was counted per lesson, so several videos at once earned several clocks   | Fixed: one clock per learner; their reports taken one at a time                                      |
| 5   | A `watch` video with no recorded length can be marked complete                         | Kept: it cannot be measured, and refusing would leave it unfinishable; authoring check deferred (§6) |
| 6   | The password-change limit counted per session, so refreshing reset it                  | Fixed: counted per account as well                                                                   |
| 7   | Two certificate issues racing could audit and announce twice                           | Fixed: only the call that created the record announces it                                            |
| 8   | A learner withdrawn from a course could still raise doubts on it                       | Fixed: the course pages' reach rule                                                                  |
| 9   | Withdrawal follows the membership event; nothing reconciles one that was missed        | Deferred to Phase 6 (§6)                                                                             |
| 10  | The verify page forwarded the visitor's session and passed any path to the API         | Fixed: well-formed codes only, no session, not indexed                                               |

**Evidence.**

| Check                                                                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type-check, lint                                                       | clean, every package                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Unit                                                                   | 279: shared 105, API 145, web 13, runner 16, including invariants over 2,000 generated watch reports                                                                                                                                                                                                                                                                                                                                               |
| API (`test:e2e`, real PostgreSQL)                                      | 19 files, 295 tests; `learner.e2e-spec.ts` 47                                                                                                                                                                                                                                                                                                                                                                                                      |
| Sandbox, real containers                                               | 27 tests                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Question bank in the sandbox (`verify:questions`)                      | 53 questions, 107 language runs: every reference passes every case                                                                                                                                                                                                                                                                                                                                                                                 |
| Browser (Playwright, real runner)                                      | every spec passes on Chromium and the phone (QA copy, two workers). Chromium: 82 first time, 1 flaky (a Web Lab check timed out under load), J17 phone-only; J-10 started a test the new journeys had opened, now starts the demo's own (assessment spec then 15 of 15). Phone: 80 first time, 6 flaky (timeouts with under 1 GB free), all passed on retry; J1's panel check matched the phone's hidden sidebar, now scoped (then passed on both) |
| Build                                                                  | every package                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Migration on a copy of the local sample data (`lms` → `lms_phase2_qa`) | applied cleanly; it moved the one practice lesson to `pass` and changed nothing else                                                                                                                                                                                                                                                                                                                                                               |

**Journeys J1–J18** (the brief's list; `apps/web/e2e`).

| #   | Journey                         | Where it is walked                                                                            |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| J1  | Login → Dashboard               | `learner-signin.spec.ts` (no trace: it types a password)                                      |
| J2  | Dashboard → Course → Lesson     | `learner-journeys.spec.ts`                                                                    |
| J3  | Lesson complete → Progress      | `learner-journeys.spec.ts`; `learning.spec.ts` J-03b                                          |
| J4  | Assignment → Submit → Result    | `learner-journeys.spec.ts`; `assessment.spec.ts` J-09                                         |
| J5  | Test → Submit → Result          | `learner-journeys.spec.ts` (immediate results, answers held); `assessment.spec.ts` J-10       |
| J6  | Coding Run → Submit → Result    | `assessment.spec.ts` J-09b and the coding lab, in the real sandbox                            |
| J7  | Lab → Complete → Progress       | `labs.spec.ts` 5–11 and the lab lesson completed where it is passed                           |
| J8  | Schedule → Session → Attendance | `learner-journeys.spec.ts` (class, notes, deadline, Attendance page); `learning.spec.ts` J-07 |
| J9  | Doubt → status                  | `learner-journeys.spec.ts` (resolve, reopen); `engagement.spec.ts` (asked, answered)          |
| J10 | Profile update                  | `self-service.spec.ts`                                                                        |
| J11 | Project                         | `learner-journeys.spec.ts`                                                                    |
| J12 | Certificate                     | `learner-journeys.spec.ts`: lessons read to the end, the PDF, the public check                |
| J13 | Notification → Source           | `learner-journeys.spec.ts`                                                                    |
| J14 | Search → Content                | `learner-journeys.spec.ts`; `admin-people.spec.ts` (the palette)                              |
| J15 | Documents access                | `learner-journeys.spec.ts`; `self-service.spec.ts`                                            |
| J16 | Placement                       | `engagement.spec.ts` (apply and withdraw)                                                     |
| J17 | Mobile                          | `learner-journeys.spec.ts` J17, and the suite on the phone project                            |
| J18 | Dark/light                      | `learner-journeys.spec.ts`                                                                    |

**Known limitations** (none blocks the gate): certificates print Western European characters only
(ADR-0022); a `watch` video without a recorded length completes on the learner's word; under
`after_due` a learner who has finished could show the key to one whose own due date is later
(per-learner dates are how assignments work); rate limits and the password-change count live in
one API process's memory (one instance today; Phase 12); withdrawal follows the membership event
(finding 9).

The gate in §5 is met. ADR-0022 awaits the client's approval at the Phase 2 gate.
