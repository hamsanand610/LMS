## 9. Functional Feature Specifications

Each feature is specified under the thirteen headings requested in the brief. Entity IDs (`E-`) refer to §14, API groups to §15. To keep the document usable, common elements are stated once here and not repeated: every write endpoint validates input with a schema (Zod), every action is authorised by permission and scope (§7), every mutation of sensitive data writes an audit record, every failure returns a structured error (§15.6), and every feature ships with unit, integration and end-to-end tests (§17).

### F-01 Authentication and sessions

1. **What.** Sign-in with email and password (MVP); mobile OTP (Standard); invitation acceptance; email verification; password reset; session management (refresh-token rotation, device list, sign out everywhere); optional two-factor for staff (Standard).
2. **Why.** All portals are private; staff accounts hold sensitive data.
3. **Who.** All users.
4. **Interaction.** Login page → credentials → redirect to role home. Invitation email → set password → consent → home. Forgot → email link → reset. Staff can enable an authenticator app (Standard).
5. **Backend.** Argon2id password hashing; short-lived access JWT (15 min) + rotating refresh token (30 days, httpOnly secure cookie, stored hashed in `E-06`); revocation list in Redis; throttling per IP and per account; OTP generation/verification with provider adapter (`E-07`); invitation and reset tokens single-use and hashed; login events to audit log.
6. **Frontend.** Forms with inline validation; generic error messages; session refresh handled by the API client; route guards by role; "session expired" dialog that preserves unsaved work (test attempts and editors keep local drafts).
7. **Entities.** E-01 users, E-06 sessions, E-07 otp_codes, E-66 audit_logs.
8. **APIs.** `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/invitations/{token}/accept`, `/auth/password/forgot|reset`, `/auth/email/verify`, `/auth/otp/send|verify`, `/auth/sessions`.
9. **Validation.** Email format; password policy (min 10 chars, breached-password check optional); OTP 6 digits; token format.
10. **Security.** Rate limits (5 login failures/15 min per account, 20 per IP), constant-time comparisons, no account enumeration, cookies `SameSite=Lax`, CSRF token for cookie-authenticated mutations, device/session list, forced logout on role change or deactivation.
11. **Failure cases.** Provider outage for OTP/email → clear message and retry-after; refresh failure → sign-in prompt with draft preservation; clock skew → server time in responses.
12. **Testing.** Unit (hashing, token rotation), integration (all flows, throttling), E2E (login/logout/reset), security tests (enumeration, brute force, replay of refresh tokens).
13. **Done when.** All flows pass tests; throttling verified; sessions listed and revocable; audit entries present; documentation of flows in OpenAPI.

### F-02 Roles and permissions (RBAC)

1. **What.** Roles, permissions, scopes and guards as designed in §7.
2. **Why.** Separate student, trainer, admin and placement data and actions.
3. **Who.** Super Admin manages; everyone is subject to it.
4. **Interaction.** Super Admin edits role bundles in a matrix UI; Admin assigns roles to users; trainers are scoped by batch assignment.
5. **Backend.** Permission resolution cached per user (Redis, 60 s TTL, invalidated on change); decorators and guards; scope injection; route-table test ensuring every route declares a permission or is explicitly public.
6. **Frontend.** `useCan(permission)` hook hides controls; server components check the same claims.
7. **Entities.** E-02 roles, E-03 permissions, E-04 role_permissions, E-05 user_roles, E-13 batch_trainers.
8. **APIs.** `/roles`, `/roles/{id}/permissions`, `/users/{id}/roles`, `/me/permissions`.
9. **Validation.** Permission keys must exist in the seeded catalogue; cannot remove the last Super Admin.
10. **Security.** Deny by default; audited changes; impersonation time-boxed and banner-visible.
11. **Failure cases.** Cache unavailable → fall back to database lookup; unknown permission → 500 with alert (should never happen after CI check).
12. **Testing.** Matrix-driven tests: for each (role, endpoint) pair assert allow/deny; scope tests for trainers.
13. **Done when.** Matrix tests pass 100%; role editor works; docs list every permission.

### F-03 User and student management

1. **What.** Create, invite, import (CSV/XLSX), edit, deactivate, reactivate users; student records with status (prospect → enrolled → active → completed → alumni / dropped); batch membership; document verification; notes; audit.
2. **Why.** Foundation of every admin metric; bulk onboarding is a weekly task for institutes.
3. **Who.** Admin (all), Placement (verification, read), Trainer (read, batch).
4. **Interaction.** Students list with filters → create or import → invitations sent → student accepts → assigned to batch (during import or later) → status transitions automatically (enrolled when added to a batch; completed at batch end) or manually.
5. **Backend.** Import job parses file, validates rows (email/mobile uniqueness, required fields), previews, then creates users and enrolments transactionally in chunks; sends invitations via queue; deactivation revokes sessions.
6. **Frontend.** Data table with server-side pagination and saved filters; import wizard with mapping and error report download; detail page with tabs.
7. **Entities.** E-01 users, E-08 student_profiles, E-12 batch_members, E-56 documents, E-66 audit_logs.
8. **APIs.** `/users`, `/students`, `/students/import`, `/students/{id}/status`, `/students/{id}/documents/{docId}/verify`.
9. **Validation.** Unique email (and mobile if used for login); status transitions restricted to a state machine; import limited to 5,000 rows per file.
10. **Security.** Sensitive fields gated; exports audited; soft delete only.
11. **Failure cases.** Partial import failure → per-row report, successful rows kept (idempotent re-import by email skips existing); email provider failure → invitations retried with backoff and visible in a "pending invitations" list.
12. **Testing.** Import fixtures (valid, duplicates, bad rows, 5,000 rows); state machine unit tests; E2E invite acceptance.
13. **Done when.** AC-16.1–16.3 pass; import of 200 students under 60 s; audit entries for all changes.

### F-04 Trainer management

1. **What.** Trainer profiles (subjects, bio, photo, availability notes), batch assignments, subject tags, performance summary (Standard).
2. **Why.** Live classes, attendance and "Trainer Performance" need trainers as entities.
3. **Who.** Admin.
4. **Interaction.** Create trainer (user with Trainer role) → assign to batches/subjects → schedule uses assignments → performance page aggregates.
5. **Backend.** CRUD; assignment validation; performance aggregation job (Standard) using attendance, test averages, feedback, on-time sessions with weights from settings.
6. **Frontend.** List/detail; assignment picker; performance charts (Admin only).
7. **Entities.** E-09 trainer_profiles, E-13 batch_trainers.
8. **APIs.** `/trainers`, `/trainers/{id}/batches`, `/reports/trainers`.
9. **Validation.** A trainer cannot be assigned twice to the same batch/subject.
10. **Security.** Performance data visible to Admin/Super Admin only; trainers see their own aggregates without ranking.
11. **Failure cases.** Removing a trainer with future sessions → warning and reassignment prompt.
12. **Testing.** Assignment rules; performance formula unit tests with fixtures.
13. **Done when.** Trainers schedulable; performance report matches fixture expectations.

### F-05 Batch management

1. **What.** Programmes (curriculum templates) and batches (instances with dates, mode online/offline/hybrid, capacity, trainers, students, timetable, published content, status planned → running → completed → archived).
2. **Why.** Batches scope almost everything: schedule, attendance, assignments, tests, eligibility, reports.
3. **Who.** Admin (manage), Trainer (view own), Student (see own), Placement (filter by batch).
4. **Interaction.** Create batch from programme → add trainers → add students (pick or import) → build timetable (series) → publish courses/assignments/tests to batch → run → complete (triggers certificate rules, alumni status).
5. **Backend.** State machine; membership with join/leave dates (history retained on transfer); timetable series generation; batch-level aggregates for dashboards refreshed by job.
6. **Frontend.** Batch detail with tabs; transfer dialog; capacity warnings.
7. **Entities.** E-10 programs, E-11 batches, E-12 batch_members, E-13 batch_trainers, E-22 live_sessions.
8. **APIs.** `/programs`, `/batches`, `/batches/{id}/members`, `/batches/{id}/trainers`, `/batches/{id}/timetable`, `/batches/{id}/publications`, `/batches/{id}/status`.
9. **Validation.** Dates valid; capacity ≥ members; cannot complete a batch with unmarked past sessions (warning) unless forced with reason.
10. **Security.** Trainers limited to assigned batches; all changes audited.
11. **Failure cases.** Timetable generation conflict → list of conflicts and options.
12. **Testing.** State machine, membership history, aggregate correctness.
13. **Done when.** A batch can be created, filled, scheduled, published to, run and completed with reports reflecting each step.

### F-06 Courses, modules and lessons

1. **What.** Course authoring (outline, lesson types, resources, completion rules, versions, publishing scopes), catalogue, overview, player with progress, inline practice, live-recording lessons, discussions and ratings (Standard).
2. **Why.** Primary learning content; recorded live classes must land here.
3. **Who.** Content authors and Admin (author/publish), Student (learn), Trainer (attach recordings).
4. **Interaction.** Described in card R-03.
5. **Backend.** Outline stored as ordered tree; lesson content stored as JSON blocks (rich text with code, images, embeds); video handled through provider adapter (upload via direct-to-provider or via presigned storage then provider ingest; playback via signed URL/tokens); publication records per scope with version pinning; progress events processed to lesson/module/course completion.
6. **Frontend.** Builder with drag-and-drop (dnd-kit), autosave, preview; player with HLS playback (hls.js or provider player), keyboard shortcuts, resume; curriculum sidebar/drawer.
7. **Entities.** E-14 courses, E-15 course_modules, E-16 lessons, E-17 lesson_resources, E-18 course_publications, E-19 enrollments, E-20 lesson_progress, E-72 files.
8. **APIs.** `/courses`, `/courses/{id}/outline`, `/lessons/{id}`, `/lessons/{id}/progress`, `/courses/{id}/publish`, `/me/courses`, `/files/uploads`, `/videos/{id}/playback`.
9. **Validation.** Outline depth (course → module → lesson only); lesson must have content; video must be "ready" before publish; resource types whitelist; size limits.
10. **Security.** Signed playback with short TTL bound to user; resources served through presigned URLs; no public listing of storage; content versions immutable once published.
11. **Failure cases.** Video processing failure → lesson marked "processing failed" with retry; provider outage → player shows retry with cached position; progress event loss → idempotent replay from client buffer.
12. **Testing.** Outline operations, publication scoping, progress calculation with fixtures, player E2E (resume, complete), signed URL expiry.
13. **Done when.** AC-03.1–03.4 pass; author can publish a course to a batch and a student can complete it; recordings attach from sessions.

### F-07 Learning resources and file storage

1. **What.** Central file registry for lesson resources, kits, resumes, documents, project files, exports and certificates; private buckets; presigned upload/download; virus scan hook (optional); quotas.
2. **Why.** Many features upload files; one secure path prevents mistakes.
3. **Who.** All (scoped).
4. **Interaction.** Upload control → presigned PUT → registry record → attached to owner entity.
5. **Backend.** `files` table with owner type/id, MIME (sniffed), size, checksum, visibility, retention; lifecycle job deletes orphans and expired exports.
6. **Frontend.** Upload component with progress, retry, type/size hints.
7. **Entities.** E-72 files.
8. **APIs.** `/files/uploads` (create presigned), `/files/{id}` (metadata), `/files/{id}/url` (presigned GET), `DELETE /files/{id}`.
9. **Validation.** Allowed MIME per context; size per context (resume ≤ 2 MB PDF, video ≤ 4 GB, resources ≤ 100 MB); filename sanitised.
10. **Security.** Never trust client MIME; private ACL; short-lived URLs; download audit for sensitive docs; optional ClamAV scan queue.
11. **Failure cases.** Upload interrupted → resumable (multipart) for large files; storage outage → clear error, retry.
12. **Testing.** MIME sniffing, limits, URL expiry, orphan cleanup.
13. **Done when.** All features use the registry; no direct bucket access from clients except presigned operations.

### F-08 Live sessions and schedule

1. **What.** Session series and occurrences per batch, join links, status, recordings, reminders, calendar views, iCal (Standard), native provider integration (Advanced/optional).
2. **Why.** Live classes are the core delivery mode.
3. **Who.** Admin (manage), Trainer (run), Student (attend).
4. **Interaction.** Card R-04.
5. **Backend.** Series with recurrence rules (RRULE subset) materialised into occurrences; exception handling; reminder jobs (24 h, 30 min); status transitions; recording attachment creates a lesson; conflict detection.
6. **Frontend.** Calendar (month/week/agenda) built on a lightweight calendar component; timetable editor for admins; trainer "start class" flow.
7. **Entities.** E-22 live_sessions (+ series), E-24 attendance_records, E-16 lessons (recordings).
8. **APIs.** `/batches/{id}/timetable`, `/sessions`, `/sessions/{id}/status`, `/sessions/{id}/recording`, `/me/schedule`, `/trainer/sessions`.
9. **Validation.** Time ranges, trainer availability, link URL.
10. **Security.** Join links visible only to enrolled students within the window; recordings follow course permissions.
11. **Failure cases.** Provider link changed → admins edit; reminders failing → retry queue with dead-letter alert.
12. **Testing.** Recurrence generation, timezone handling, reminder scheduling, conflict detection.
13. **Done when.** AC-04.1–04.3 pass; reminders delivered in staging; recordings visible to students.

### F-09 Question bank

1. **What.** Authoring of all question types with metadata, versions, review workflow, bulk import/export, validation (reference solution must pass), tagging by subject/topic/company/difficulty, usage tracking.
2. **Why.** Shared source for assignments, tests, practice and company kits.
3. **Who.** Admin, Content Manager, Trainer (own).
4. **Interaction.** Card R-06 (author workflow).
5. **Backend.** Polymorphic question model with type-specific JSON payloads validated by per-type schemas; versions; import parsers (XLSX/CSV for objective, JSON for coding/SQL/web); validation job runs reference solutions through the execution service.
6. **Frontend.** Per-type editors with live preview; markdown with code fences; test-case table; import wizard.
7. **Entities.** E-25 questions, E-26 question_options, E-27 coding_problems, E-28 test_cases.
8. **APIs.** `/questions`, `/questions/{id}/versions`, `/questions/{id}/validate`, `/questions/import`, `/questions/export`.
9. **Validation.** Per type (see card R-06); tags from controlled vocabularies; explanation required for published objective questions (configurable).
10. **Security.** Hidden test cases and reference solutions never sent to student clients; exports audited.
11. **Failure cases.** Validation failure → question stays draft with the failing case shown; import errors → row report.
12. **Testing.** Schema tests per type; import fixtures; validation pipeline integration test.
13. **Done when.** All types authorable and importable; validation gate enforced; AC-06.1.

### F-10 Assignments

1. **What.** Assignments built from question-bank items into modules, published to batches with settings (due date, attempts, unlock rules, marks visibility, explanation visibility), student solving workspace, progress, review, bookmarks, trainer monitoring and descriptive grading.
2. **Why.** Daily practice loop; "Assignment Status" metric.
3. **Who.** Admin/Trainer (author/publish/monitor), Student.
4. **Interaction.** Card R-06.
5. **Backend.** Assignment structure; publication per batch; submission pipeline (objective graded instantly; coding routed to execution service; descriptive queued for grading); progress aggregates per student per assignment; unlock evaluation; points to gamification.
6. **Frontend.** Assignment list/detail/workspace (P-C06–C08); trainer progress tables.
7. **Entities.** E-29 assignments, E-30 assignment_modules, E-31 assignment_questions, E-32 assignment_publications, E-33 submissions, E-34 submission_results.
8. **APIs.** `/assignments`, `/assignments/{id}/publish`, `/assignments/{id}/me`, `/questions/{id}/submissions`, `/submissions/{id}`, `/assignments/{id}/progress`.
9. **Validation.** Attempt limits; due dates; unlock rules; answer payload per type.
10. **Security.** Correct answers hidden until allowed; submissions immutable; rate limits on submissions.
11. **Failure cases.** Execution service down → submission queued with "pending" state and notification when graded; duplicate submission (double click) → idempotency key.
12. **Testing.** Grading rules per type; unlock logic; concurrency (idempotency); E2E solve flow.
13. **Done when.** AC-06.2–06.4 pass; trainer can see progress and grade descriptive answers.

### F-11 Tests and assessments

1. **What.** Test builder, scheduling, attempt engine with server timer, autosave, resume, auto-grading, manual grading, results release, analytics, leaderboard (optional), self-paced practice tests, company-style tests, contests.
2. **Why.** Measures learning; feeds scores metric and placement eligibility.
3. **Who.** Admin/Trainer, Student, Placement (read scores).
4. **Interaction.** Card R-07.
5. **Backend.** Attempt state machine (not started → in progress → submitted → graded → released); server-side clock with deadline = min(start + duration, window end); answer upserts; auto-submit job at deadline; grading pipeline; per-question analytics job; anti-cheat event log (tab switches, full-screen exits).
6. **Frontend.** Attempt screen with resilient autosave (queue + retry), palette, timer synced from server every 30 s; result and review pages; trainer monitor.
7. **Entities.** E-35 tests, E-36 test_sections, E-37 test_questions, E-38 test_schedules, E-39 test_attempts, E-40 test_answers.
8. **APIs.** `/tests`, `/tests/{id}/schedules`, `/tests/{id}/attempts`, `/attempts/{id}/state`, `/attempts/{id}/answers`, `/attempts/{id}/submit`, `/attempts/{id}/result`, `/tests/{id}/monitor`, `/tests/{id}/release`, `/tests/{id}/analytics`.
9. **Validation.** One active attempt; answers accepted only while in progress; grading only after submission.
10. **Security.** Questions delivered per section on demand; answers never include correctness during the attempt; integrity events recorded; results released explicitly.
11. **Failure cases.** Client disconnect → resume; server restart → deadline persisted in DB; grading job failure → retry with alert; late submissions within grace (configurable 30 s) accepted.
12. **Testing.** Timer tests with fake clocks; concurrency tests; grading with fixtures; E2E attempt including reload.
13. **Done when.** AC-07.1–07.4 pass; a weekly test can be run for a 100-student batch in staging without data loss.

### F-12 Code execution service and labs

Summarised here; full architecture in §10.

1. **What.** An isolated execution service (self-hosted Judge0 behind an internal API) with a queue, per-language limits and quotas, used by Code Practice (F-12a), Debug Challenges (F-12b), Playground (F-12c), SQL Lab (F-12d, via SQLite runner first, MySQL-compatible runner later) and by test/assignment coding questions. Web Lab (F-12e) runs in the browser sandbox and does not use the service.
2. **Why.** Coding practice is a Must requirement and a market differentiator; secure execution is mandatory.
3. **Who.** Students (execute), authors (validate), Super Admin (operate).
4. **Interaction.** Editor → run (sample/custom input) → results; submit → hidden tests → verdicts and points.
5. **Backend.** `execution` module: submission record → BullMQ job → worker calls Judge0 (batched test cases) → results persisted → real-time update via WebSocket/SSE; quotas in Redis; language catalogue; problem limits.
6. **Frontend.** Monaco editor (lazy loaded), language selector, run/submit buttons with progress, verdict table, resizable panes; Web Lab iframe sandbox with test harness.
7. **Entities.** E-27 coding_problems, E-28 test_cases, E-33 submissions, E-34 submission_results, E-61 points_ledger.
8. **APIs.** `/practice/problems`, `/practice/problems/{id}/submissions`, `/execute` (playground), `/submissions/{id}`, `/submissions/{id}/events` (SSE), `/admin/execution/stats`.
9. **Validation.** Source size ≤ 64 KB; language in catalogue; stdin ≤ 64 KB; quotas (e.g. 60 runs/hour/student, configurable).
10. **Security.** §10.6 and §16.
11. **Failure cases.** Worker down → queue backlog with user-visible "queued" state; timeouts → TLE verdict; compile errors → CE with stderr (sanitised).
12. **Testing.** Language matrix tests; limit tests (loops, fork bombs, large output, network attempts); load test at 50 concurrent.
13. **Done when.** AC-08.1–08.4 pass; security test suite green; runbook written.

---
