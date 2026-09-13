## 11. Reusable Module Structure

### 11.1 Template modules

| ID | Module key | Master features | Purpose | Owns (tables) | Publishes → Subscribes | Navigation contributed | Flag | Demo status |
|---|---|---|---|---|---|---|---|---|
| M-01 | `auth` | F-01 | Sign-in, invitations, reset, sessions | `sessions`, `invitations`, `password_resets`, `otp_codes` (future) | `user.logged_in`, `user.invited` → — | Auth pages | always on | **Full** |
| M-02 | `rbac` | F-02 | Roles, permissions, scopes, guards | `roles`, `permissions`, `role_permissions`, `user_roles` | `role.changed` → `module.registered` | Admin › Roles | always on | **Full** |
| M-03 | `users` | F-03 | Accounts, staff management, deactivation | `users` | `user.created`, `user.deactivated` | Admin › Users | always on | **Full** |
| M-04 | `students` | F-03, F-21 (core) | Student records, import, documents, profile sections | `student_profiles`, `documents`, `resumes`, `student_skills` | `student.enrolled`, `student.status_changed` → `batch.member_added` | Admin › Students; Student › Profile | always on | **Full** |
| M-05 | `trainers` | F-04 | Trainer profiles and assignments | `trainer_profiles`, `batch_trainers` | `trainer.assigned` | Admin › Trainers | always on | **Full** |
| M-06 | `batches` | F-05 | Programmes, batches, membership | `programs`, `program_courses`, `batches`, `batch_members` | `batch.created`, `batch.member_added`, `batch.status_changed` | Admin › Batches; Trainer › Batches | always on | **Full** |
| M-07 | `courses` | F-06, F-07 | Course authoring, publication, catalogue, player | `courses`, `course_modules`, `lessons`, `lesson_resources`, `course_publications` | `course.published`, `lesson.viewed` → `session.recording_attached` | Admin › Courses; Student › Courses | always on | **Full** |
| M-08 | `progress` | F-14 | Enrolments, lesson progress, activity, aggregates | `enrollments`, `lesson_progress`, `activity_events` | `lesson.completed`, `course.completed` → `lesson.viewed`, `submission.graded`, `attendance.marked` | Student › Progress | always on | **Full** |
| M-09 | `sessions` | F-08 | Series, occurrences, links, recordings, calendar | `session_series`, `live_sessions` | `session.scheduled`, `session.rescheduled`, `session.completed` | Schedule (all portals) | `module.sessions` | **Full** (link-based) |
| M-10 | `attendance` | F-13 | Roll-call, corrections, thresholds | `attendance_records` | `attendance.marked`, `attendance.corrected` → `session.completed` | Trainer › Attendance; Admin › Attendance | `module.attendance` | **Full** (roll-call) |
| M-11 | `questions` | F-09 | Question bank, versions, import, validation | `questions`, `question_options`, `coding_problems`, `test_cases`, `question_versions` | `question.published` | Admin › Question bank | always on | **Full** (MCQ, true/false, descriptive, coding) |
| M-12 | `assignments` | F-10 | Assignments, modules, publication, submissions, grading | `assignments`, `assignment_modules`, `assignment_questions`, `assignment_publications`, `submissions`, `submission_results` | `submission.created`, `submission.graded` → `execution.completed` | Assignments (all portals) | `module.assignments` | **Full** |
| M-13 | `tests` | F-11 | Test builder, schedules, attempts, grading, results | `tests`, `test_sections`, `test_questions`, `test_schedules`, `test_attempts`, `test_answers` | `test.scheduled`, `attempt.submitted`, `test.released` | Tests (all portals) | `module.tests` | **Full** (objective + descriptive + coding via adapter) |
| M-14 | `practice` | F-12 (core) | Problem catalogue, execution adapter, verdicts | `practice_problems` (view over questions), `execution_runs` | `execution.completed` | Student › Practice | `module.practice` | **Prototype** (browser sandbox; Judge0 driver optional) |
| M-15 | `reports` | F-19 (core) | Dashboard metrics, report pages, exports | `report_exports`, `report_definitions`, `reporting.*` aggregates | → all | Admin › Dashboard/Reports; Trainer › Reports | always on | **Full** (core metrics; placeholders for future modules) |
| M-16 | `notifications` | F-20 | In-app, email, preferences, announcements | `notifications`, `notification_preferences`, `announcements`, `email_templates` | → many | Notifications (all portals); Admin › Announcements | always on | **Full** (in-app + email) |
| M-17 | `files` | F-07 | File registry, presigned upload/download, storage drivers, video driver | `files` | `file.uploaded` | — | always on | **Full** |
| M-18 | `settings` | F-26 | Settings, branding, flags, navigation config, taxonomies, custom fields, integrations, content pages | `organizations`, `settings`, `branding_settings`, `feature_flags`, `navigation_config`, `taxonomies`, `taxonomy_terms`, `custom_field_definitions`, `custom_field_values`, `integration_configs`, `content_pages` | `settings.changed`, `branding.changed`, `flag.changed` | Admin › Settings | always on | **Full** |
| M-19 | `audit` | F-26 | Append-only audit log and viewer | `audit_logs` | → all mutations | Admin › Audit log | always on | **Full** |
| M-20 | `search` | F-25 | Full-text search across permitted entities | search indexes | → publish events | Utility bar | always on | **Basic** |
| M-21 | `health` | — | Liveness/readiness, queue and integration status | — | — | Admin › System health | always on | **Full** |
| M-22 | `placement` | F-17 | Companies, drives, applications (data model and role only in demo) | `companies`, `placement_drives`, `drive_applications`, `application_events`, `offers` | — | Hidden until enabled | `module.placement` (off) | **Data-only** |
| — | `projects`, `certificates`, `feedback`, `gamification`, `doubts`, `events`, `ai`, `labs` | F-15, F-16, F-18, F-22, F-27, F-28, F-23/24, F-12b–e | Future modules | — | — | — | off | **Future** |

### 11.2 Module contract (summary)

Every module ships: `manifest.ts` (as in §6.5), `*.module.ts` (Nest module wiring), `controllers/`, `services/`, `repositories/`, `events/`, `jobs/`, `dto/` (re-exporting shared Zod schemas), `migrations/` (Prisma migrations are global per app, but each migration is tagged with the module key in its name), `seeds/`, `README.md`, and tests. The web side ships `apps/web/src/modules/<key>/` with pages (re-exported into route groups), components and hooks. Module manifests are validated at boot; an invalid manifest fails startup with a clear message.

### 11.3 Lifecycle at boot

1. Load core module manifests, then overlay extension manifests for `CLIENT_KEY`.
2. Evaluate feature flags from the database (defaults from manifests); disabled modules are not registered.
3. Register permissions into the catalogue (idempotent), navigation items (merged with `navigation_config` overrides), routes, job handlers, settings sections (validated against each module's schema), and event subscriptions.
4. Run health checks for required integrations of enabled modules; report on the system-health page.
5. Expose `/me` with the effective navigation, flags and branding for the web app.

### 11.4 Extension points available to overlays (initial set)

`navigation.transform`, `dashboard.widgets` (add/remove widgets per portal), `student.customFields` (schema contributions), `enrollment.beforeCreate`, `attendance.rules`, `assessment.gradingHooks`, `reports.definitions`, `notifications.templates`, `settings.sections`, `auth.postLogin`. Each is a typed interface in `packages/module-sdk` with a test harness.

---

## 12. Demo Scope

### 12.1 Demo roles

| Role | In demo? | Reason |
|---|---|---|
| Super Admin | **Yes** | Shows settings, branding, flags, roles, audit and system health — the white-label story |
| Admin (Operations) | **Yes** | The main staff journey: onboarding, batches, content, timetable, reports |
| Trainer | **Yes** | Attendance, assignments, tests, grading, batch health |
| Student | **Yes** | The experience the customer images describe |
| Placement Coordinator | Seeded role, **no portal** | Placement module is future; keeping the role and tables shows readiness without half-built pages |
| Content Manager | Seeded permission bundle, **no separate portal** | Uses the admin content pages; demonstrates role configurability |
| Support Staff, Company, Parent | Not seeded | Future (master §7.1) |

### 12.2 Demo modules (fully implemented)

| Module | Purpose | Users | Pages (§14) | Main features | Required APIs (§18) | Database entities (§17) | Permissions (§13) | Navigation | Dependencies | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|
| **Authentication (M-01)** | Secure entry for every role | All | DP-P02…P07 | Email/password sign-in, invitation acceptance, forgot/reset, session list, sign out, role-based redirect | `/auth/*`, `/me` | `users`, `sessions`, `invitations`, `password_resets` | — (public + `auth:self`) | Auth pages; profile menu | None | All auth flows pass tests; throttling works; invitation email visible in Mailpit; redirect by role |
| **Roles & permissions (M-02)** | Configurable RBAC | Super Admin | DP-A03 | Role list, permission matrix editor, assign roles to users, scope display | `/roles/*`, `/users/{id}/roles` | `roles`, `permissions`, `role_permissions`, `user_roles` | `roles:manage`, `roles:read` | Admin › Settings › Roles | M-01 | Matrix tests pass for all demo roles; editing a bundle changes access within 60 s |
| **Users, students, trainers (M-03–M-05)** | People management | Admin | DP-A02, A04–A08 | Staff users CRUD, student list/detail/import/status/documents, trainer profiles and assignments | `/users/*`, `/students/*`, `/trainers/*` | `users`, `student_profiles`, `documents`, `resumes`, `trainer_profiles`, `batch_trainers` | `users:manage`, `students:manage`, `students:read_sensitive`, `trainers:manage` | Admin › Users/Students/Trainers | M-01, M-02, M-17 | Import of the demo sheet (60 rows) succeeds with error report for 3 bad rows; sensitive fields gated |
| **Batches (M-06)** | Cohorts and timetables | Admin, Trainer | DP-A09–A11, T03 | Programmes, batches, members, trainers, status, content publication tab, timetable tab | `/programs/*`, `/batches/*` | `programs`, `program_courses`, `batches`, `batch_members` | `batches:manage`, `batches:read` | Admin › Batches; Trainer › Batches | M-03–M-05 | Create batch → add students/trainers → publish content → status transitions; trainer sees only own batches |
| **Courses & lessons (M-07)** | Content delivery | Admin (author), Student | DP-A12–A14, S03–S05 | Course builder (outline, lesson types video/article/resources/practice), file/video upload, publication scopes, catalogue, course overview, player with curriculum, resources, mark complete | `/courses/*`, `/lessons/*`, `/files/*`, `/videos/*` | `courses`, `course_modules`, `lessons`, `lesson_resources`, `course_publications`, `files` | `courses:manage`, `courses:publish`, `courses:read` | Admin › Courses; Student › Courses | M-06, M-17 | AC-03.1–03.4 (master) pass with file-based video |
| **Progress (M-08)** | Single source of progress | System, Student, staff views | DP-S06 | Enrolments derived from publications, lesson progress, course/assignment/test progress, overall progress, activity feed | `/me/progress`, `/students/{id}/progress` | `enrollments`, `lesson_progress`, `activity_events` | `progress:read` (own/batch/all) | Student › Progress; embedded widgets | M-07, M-12, M-13 | Numbers agree across dashboard, course page, profile and reports |
| **Schedule (M-09)** | Live classes | Admin, Trainer, Student | DP-A11 (tab), T02, S07 | Series with recurrence, occurrences, join links, status, recording attach, reminders (email), month/agenda views | `/batches/{id}/timetable`, `/sessions/*`, `/me/schedule` | `session_series`, `live_sessions` | `sessions:manage`, `sessions:read` | Schedule item in all portals | M-06, M-16 | AC-04.1–04.3 pass; reminder emails visible in Mailpit |
| **Attendance (M-10)** | Roll-call and reporting | Trainer, Admin, Student | DP-T06, A15, S06 (widget) | Mark/correct with reason, defaults, thresholds, student calendar, admin management view | `/sessions/{id}/attendance`, `/me/attendance`, `/reports/attendance` | `attendance_records` | `attendance:mark`, `attendance:read`, `attendance:manage` | Trainer › Attendance; Admin › Attendance | M-09 | AC-05.1–05.3 pass |
| **Question bank (M-11)** | Reusable questions | Admin, Trainer (own) | DP-A18–A20, T11 | MCQ single/multi, true/false, descriptive, coding (statement, starter code, tests, limits), tags, difficulty, marks, versions, import XLSX/CSV, validation (coding via execution adapter) | `/questions/*` | `questions`, `question_options`, `coding_problems`, `test_cases`, `question_versions` | `questions:manage`, `questions:create_own` | Admin › Question bank; Trainer › Question bank | M-14 (validation), M-17 | Import with error report; coding question validated by reference solution in the available driver |
| **Assignments (M-12)** | Practice sets | Admin/Trainer, Student | DP-A16–A17, T07, S08–S10 | Wizard (questions → modules → settings → batches), unlock rules, attempts, marks, explanations, workspace per type, grading queue for descriptive, progress table | `/assignments/*`, `/questions/{id}/submissions`, `/submissions/*` | `assignments`, `assignment_modules`, `assignment_questions`, `assignment_publications`, `submissions`, `submission_results` | `assignments:manage`, `assignments:publish`, `assignments:grade`, `assignments:submit` | Assignments (all portals) | M-11, M-14, M-16 | AC-06.1–06.4 pass; coding submissions graded by browser driver marked *untrusted*, by Judge0 driver marked *trusted* |
| **Tests (M-13)** | Timed assessments | Admin/Trainer, Student | DP-A21–A23, T08–T09, S11–S14 | Builder (sections, questions, marks, shuffle, settings), schedule per batch, instructions, attempt engine (server timer, autosave, resume, palette, integrity events), auto-grading, manual grading, release, results/review, monitor | `/tests/*`, `/attempts/*` | `tests`, `test_sections`, `test_questions`, `test_schedules`, `test_attempts`, `test_answers` | `tests:manage`, `tests:schedule`, `tests:grade`, `tests:release`, `tests:attempt`, `tests:read` | Tests (all portals) | M-11, M-14, M-16 | AC-07.1–07.4 pass |
| **Practice (M-14)** | Coding-practice structure | Student | DP-S15–S16 | Problem list with filters, workspace (statement, editor, run with sample input, submit), verdict table, submissions history; execution adapter with `browser-sandbox` driver (JavaScript, Python via Pyodide) and optional `judge0` driver | `/practice/*`, `/execute` | `execution_runs`, uses M-11 tables | `practice:use` | Student › Practice | M-11 | Solve a JavaScript and a Python problem end to end in the browser driver; verdict shown; results stored with trust level; Judge0 path verified on a Linux host if available |
| **Reports (M-15)** | Admin dashboard and reports | Admin, Trainer (scoped) | DP-A01, A24–A26, T10 | Tiles: total/active students (7/30 days), batch-wise, course-wise, attendance %, completion %, assessment scores, assignment status; placeholders for future metrics; report pages with filters, charts, tables; CSV/XLSX export as jobs; definitions drawer | `/reports/*`, `/exports/*` | `report_exports`, `report_definitions`, `reporting.*` | `reports:read`, `reports:export` | Admin › Dashboard/Reports; Trainer › Reports | all | AC-01.1–01.3 pass; export row counts equal filtered totals |
| **Notifications (M-16)** | Communication | All | DP-S21, A27 | In-app centre, email via SMTP (Mailpit), preferences, announcements with audience and schedule, templates editable | `/me/notifications*`, `/announcements/*`, `/notifications/broadcast` | `notifications`, `notification_preferences`, `announcements`, `email_templates` | `notifications:read`, `announcements:manage` | Bell; Admin › Announcements | M-01 | AC-15.1–15.2 pass |
| **Profile (M-04 student side)** | Student self-service | Student | DP-S17–S20 | Sections (overview, personal, education, experience, projects list, skills), completeness, resumes (upload, default), documents with verification status | `/me/profile*`, `/me/resumes`, `/me/documents` | `student_profiles`, `resumes`, `documents` | `profile:read`, `profile:update` (own) | Student › Profile | M-17 | AC-12.1–12.3 pass |
| **Settings, branding, flags (M-18)** | White-label control | Super Admin | DP-A28–A34 | General, branding (logo, colours, fonts, favicon, login appearance), feature flags, navigation labels, taxonomies, custom fields, email templates, content pages, integrations (write-only) | `/settings/*`, `/branding`, `/flags`, `/navigation`, `/custom-fields`, `/templates`, `/content-pages` | as M-18 | `settings:manage`, `settings:read` | Admin › Settings | — | Changing branding re-themes the app without redeploy; disabling `module.tests` hides tests everywhere and blocks its API |
| **Audit & health (M-19, M-21)** | Trust and operations | Super Admin | DP-A35–A36 | Audit log viewer with filters/export; system health (DB, storage, email, queue, execution driver) | `/audit-logs`, `/admin/health` | `audit_logs` | `audit:read`, `settings:manage` | Admin › Settings | — | Every mutation endpoint produces an audit row (test) |
| **Search (M-20)** | Find things | All | utility | Command palette over courses, lessons, questions, students (staff) | `/search` | indexes | `search:use` | Utility bar | — | Only permitted items returned |

### 12.3 Deliberately out of the demo (future, per master roadmap)

SQL Lab, Web Lab, Debug Challenges, Playground with server execution (F-12b–e); Projects (F-15); Certificates (F-16); Placement portal (F-17 pages; tables and role seeded only); Feedback (F-18); Gamification (F-22); AI assistant and interviews (F-23/24); Doubts (F-27); Events (F-28); OTP login; QR attendance; hosted video providers; scheduled/PDF reports; portfolio pages. Their navigation entries exist as flags (off) so the demo can show "modules can be enabled per client".

### 12.4 Demo storyline

One institute ("Demo Institute"), one programme (Java Full-Stack), three batches (running, planned, completed), eight trainers, sixty students, six courses, one hundred and twenty questions, four assignments, three tests (one released, one live-today, one upcoming), two weeks of sessions and attendance, notifications and announcements; details in §21.

---

## 13. User Roles and Permissions

### 13.1 Demo roles and the permission catalogue

The catalogue is generated from module manifests; the demo subset (keys) is:

| Module | Permission keys |
|---|---|
| auth | `auth:self` (implicit for authenticated users) |
| rbac | `roles:read`, `roles:manage` |
| users | `users:read`, `users:manage`, `users:import` |
| students | `students:read`, `students:manage`, `students:read_sensitive`, `students:verify_documents` |
| trainers | `trainers:read`, `trainers:manage` |
| batches | `batches:read`, `batches:manage`, `programs:manage` |
| courses | `courses:read`, `courses:manage`, `courses:publish` |
| progress | `progress:read` |
| sessions | `sessions:read`, `sessions:manage`, `sessions:run` (mark live/complete, attach recording) |
| attendance | `attendance:read`, `attendance:mark`, `attendance:manage` (corrections beyond window, thresholds) |
| questions | `questions:read`, `questions:create_own`, `questions:manage`, `questions:import` |
| assignments | `assignments:read`, `assignments:submit`, `assignments:manage`, `assignments:publish`, `assignments:grade` |
| tests | `tests:read`, `tests:attempt`, `tests:manage`, `tests:schedule`, `tests:grade`, `tests:release`, `tests:monitor` |
| practice | `practice:use`, `practice:manage` |
| reports | `reports:read`, `reports:export` |
| notifications | `notifications:read`, `notifications:broadcast`, `announcements:manage` |
| profile | `profile:read`, `profile:update` |
| files | `files:upload`, `files:read` (contextual) |
| settings | `settings:read`, `settings:manage`, `branding:manage`, `flags:manage` |
| audit | `audit:read` |
| search | `search:use` |
| placement (seeded) | `placements:read`, `placements:manage`, `placements:apply` |

### 13.2 Demo role–permission matrix

Scope: **all** / **batch** (assigned batches) / **own**.

| Permission group | Super Admin | Admin | Trainer | Student | Placement Coordinator (seeded) | Content Manager (seeded) |
|---|---|---|---|---|---|---|
| roles:* | manage | read | — | — | — | — |
| users:* | manage, import | manage, import | — | — | — | — |
| students:* | manage, read_sensitive, verify_documents | manage, read_sensitive, verify_documents | read (batch) | — | read, read_sensitive, verify_documents | — |
| trainers:* | manage | manage | read (own) | — | read | — |
| batches/programs | manage | manage | read (batch) | — | read | — |
| courses | manage, publish | manage, publish | read (batch) | read (enrolled) | — | manage (no publish) |
| progress | read (all) | read (all) | read (batch) | read (own) | read (all) | — |
| sessions | manage, run | manage, run | read (batch), run (batch) | read (batch) | read | — |
| attendance | manage | manage | mark (batch), read (batch) | read (own) | read | — |
| questions | manage, import | manage, import | create_own, read | — | — | manage, import |
| assignments | manage, publish, grade | manage, publish, grade | manage (batch), publish (batch), grade (batch) | read, submit (own) | — | manage (no publish) |
| tests | manage, schedule, grade, release, monitor | same | manage (batch), schedule (batch), grade (batch), release (batch), monitor (batch) | read, attempt (own) | read results (all) | manage (no schedule) |
| practice | manage | manage | — | use | — | manage |
| reports | read, export (all) | read, export (all) | read, export (batch) | — | read, export (placement) | — |
| notifications/announcements | broadcast, manage | broadcast, manage | broadcast (batch) | read | broadcast (placement) | — |
| profile | — | — | — | read, update (own) | — | — |
| settings/branding/flags | manage | read | — | — | — | — |
| audit | read | read (own actions) | — | — | — | — |
| search | use | use | use | use | use | use |
| placements | manage (when enabled) | read | — | read, apply (when enabled) | manage | — |

### 13.3 Enforcement (unchanged from master §7.5)

Guards check permission and scope on every endpoint; scope filters are injected into queries; the web hides what the API forbids; every route declares a permission or is public (CI test); role bundles are editable by Super Admin within the catalogue; changes are audited and propagate within a minute (cache TTL).

### 13.4 Role configurability for clients

Clients may rename roles, change bundles, add roles composed from existing permissions, and restrict scopes; they cannot invent permissions (those come from modules). Role changes are data, so they survive template upgrades; a migration check warns if a permission a client role references was removed by an upgrade.

---
