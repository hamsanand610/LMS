## 17. Database Architecture

### 17.1 Conventions (as master §14.1, plus template additions)

UUID v7 primary keys; `created_at`, `updated_at`, `created_by`, `updated_by` on every mutable table; `deleted_at` soft delete on user-facing entities (users, students, trainers, batches, courses, questions, assignments, tests, drives); explicit `status` columns backed by PostgreSQL enums; foreign keys with `ON DELETE RESTRICT` (cascades only for pure child rows such as options and test cases); every foreign key indexed; JSONB payloads carry `schema_version`; all timestamps `timestamptz` in UTC; plain PostgreSQL features only so the same migrations run on Neon, Supabase, RDS or a container.

### 17.2 Client/tenant strategy

| Option | Description | Isolation | Complexity | Cost per client | Fit for demo | Fit for white-label |
|---|---|---|---|---|---|---|
| A. Single-client architecture (no tenant concept) | One code base, one database, institute identity hard-coded | Strong by deployment | Lowest | One deployment | Fits | Poor: customisation by code edits |
| **B. Configuration-based reusable deployment (one instance + one database per client)** | Same template deployed per client; all client specifics in configuration tables and an overlay; an `organizations` row anchors settings | **Strong** (separate databases, separate storage prefixes/buckets, separate secrets) | Low | One small deployment (can share a host with Compose projects) | **Fits** | **Good**: no forks, isolated data, independent upgrades |
| C. Multi-tenant shared database with `organization_id` | One deployment serves many clients; every scoped table carries `organization_id`; row-level filtering | Logical only (bugs can leak data) | High (every query, index, job, export, search, file path) | Lowest per client | Not needed | Only for a hosted SaaS model with many small clients |
| D. Separate database per client behind one deployment | One app, connection switched per request by tenant | Strong data isolation, shared runtime | Medium–high (connection routing, migrations × N) | Medium | Not needed | Possible later |

**Recommendation: Option B** for the demo and the first white-label deployments. **Tenant-ready conventions** so C or D can be adopted later without rewriting: an `organizations` table with exactly one row now; no table stores institute identity except through `organizations`; all settings/branding/flags/navigation/custom fields reference `organization_id`; storage keys and search indexes are prefixed by organisation key; a `TenantContext` service exists (returns the single organisation now) and is the only place that would change when a resolver-by-host is added; no unique constraints that would break with multiple organisations (e.g. `users.email` unique is acceptable now and would become `(organization_id, email)` in a migration).

### 17.3 Core entities for the template (demo subset)

Master §14.2 remains the full catalogue. The demo implements the following (grouped by module); fields listed are the important ones.

| Entity | Key fields | Foreign keys | Unique / indexes | Status field | Soft delete | Audited |
|---|---|---|---|---|---|---|
| `organizations` | key, name, timezone, locale, settings_version | — | unique(key) | active | no | yes |
| `users` | email, mobile, password_hash, name, avatar_file_id, email_verified_at, last_login_at | avatar → files | unique(email); unique(mobile) nullable; idx(status) | invited/active/suspended/deactivated | yes | yes |
| `invitations` | user_id, token_hash, expires_at, accepted_at, role_keys[] | user | unique(token_hash) | pending/accepted/expired | no | yes |
| `password_resets` | user_id, token_hash, expires_at, used_at | user | unique(token_hash) | — | no | yes |
| `sessions` | user_id, refresh_token_hash, device_label, ip, user_agent, expires_at, revoked_at | user | idx(user_id), idx(expires_at) | — | no | login/logout events |
| `roles` | key, name, description, is_system | organization | unique(org, key) | — | no | yes |
| `permissions` | key, resource, action, module_key, description | — | unique(key) | — | no | seeded |
| `role_permissions` | role_id, permission_id, scope | role, permission | pk(role, permission) | — | no | yes |
| `user_roles` | user_id, role_id, granted_by | user, role | pk(user, role) | — | no | yes |
| `student_profiles` | user_id, student_code, personal JSONB, education JSONB[], experience JSONB[], links JSONB, summary, skills_declared text[], completeness_score, verification_status, custom JSONB | user | unique(user_id); unique(student_code); idx(status); GIN(personal) | prospect/enrolled/active/completed/alumni/dropped | via user | yes (sensitive gated) |
| `documents` | student_id, type, file_id, status, reviewed_by, reason | student, file, user | idx(student_id, type) | pending/verified/rejected | no | yes |
| `resumes` | student_id, file_id, title, is_default, source | student, file | idx(student_id); partial unique(student_id) where is_default | — | no | yes |
| `trainer_profiles` | user_id, subjects text[], bio | user | unique(user_id) | — | via user | yes |
| `programs` | code, name, duration_weeks, description | organization | unique(code) | active/archived | yes | yes |
| `program_courses` | program_id, course_id, position | program, course | unique(program_id, position) | — | no | — |
| `batches` | program_id, code, name, mode, start_date, end_date, capacity, custom JSONB | program | unique(code); idx(status, start_date) | planned/running/completed/archived | yes | yes |
| `batch_members` | batch_id, student_id, joined_at, left_at, reason, is_active | batch, student | unique(batch_id, student_id, joined_at); partial idx active | — | no | yes |
| `batch_trainers` | batch_id, trainer_id, subject, role | batch, trainer | unique(batch_id, trainer_id, subject) | — | no | yes |
| `courses` | title, slug, description, thumbnail_file_id, level_term_id, subject_term_id, tags text[], estimated_minutes, current_version, owner_id, custom JSONB | taxonomy terms, file, user | unique(slug); tsvector idx | draft/published/archived | yes | publish |
| `course_modules` | course_id, title, position, unlock_rule JSONB | course | unique(course_id, position) | — | no | content versions |
| `lessons` | module_id, title, type, position, duration_seconds, content JSONB, video_ref JSONB (driver, key), question_id, session_id, completion_rule, is_mandatory | module, question, session | unique(module_id, position); idx(type) | — | no | content versions |
| `lesson_resources` | lesson_id, file_id, url, title, position | lesson, file | idx(lesson_id) | — | no | — |
| `course_publications` | course_id, scope_type, scope_id, version, published_by, published_at, unpublished_at | course | unique active(course, scope_type, scope_id) | — | no | yes |
| `enrollments` | student_id, course_id, source, enrolled_at, completed_at, progress_pct | student, course | unique(student_id, course_id) | active/completed | no | — |
| `lesson_progress` | student_id, lesson_id, status, position_seconds, watched_pct, completed_at, last_accessed_at | student, lesson | unique(student_id, lesson_id); idx(student_id, last_accessed_at) | — | no | — |
| `activity_events` | user_id, type, entity_type, entity_id, payload JSONB, occurred_at, idempotency_key | user | idx(user_id, occurred_at); unique(idempotency_key) | — | append-only | — |
| `session_series` | batch_id, subject, trainer_id, rrule, starts_time, ends_time, from_date, until_date, join_url, provider, skip_dates[] | batch, trainer | idx(batch_id) | active/ended | no | yes |
| `live_sessions` | series_id, batch_id, trainer_id, subject, title, starts_at, ends_at, join_url, provider, recording_lesson_id, type | series, batch, trainer, lesson | idx(batch_id, starts_at); idx(trainer_id, starts_at) | scheduled/live/completed/cancelled | no | yes |
| `attendance_records` | session_id, student_id, status, marked_by, marked_at, source, corrected_from JSONB, reason | session, student, user | unique(session_id, student_id); idx(student_id) | present/absent/late/excused/holiday | no | yes |
| `questions` | type, title, body, payload JSONB, difficulty, marks, negative_marks, subject_term_id, topic_term_id, tags text[], explanation, version, author_id | terms, user | idx(type, status, subject, difficulty); GIN(tags); tsvector | draft/review/published/retired | yes | publish/version |
| `question_versions` | question_id, version, snapshot JSONB, created_by | question | unique(question_id, version) | — | no | — |
| `question_options` | question_id, text, is_correct, position, explanation | question (cascade) | unique(question_id, position) | — | no | — |
| `coding_problems` | question_id, languages JSONB (starter, reference), time_limit_ms, memory_limit_mb, sample_io JSONB, points | question (cascade) | unique(question_id) | — | no | yes |
| `test_cases` | problem_id, input, expected_output, is_sample, weight, position, comparator | problem (cascade) | idx(problem_id, position) | — | no | yes |
| `assignments` | title, description, level_term_id, settings JSONB, author_id | term, user | idx(status) | draft/published/archived | yes | yes |
| `assignment_modules` | assignment_id, title, position, unlock_rule JSONB | assignment | unique(assignment_id, position) | — | no | — |
| `assignment_questions` | module_id, question_id, question_version, position, marks_override | module, question | unique(module_id, position) | — | no | — |
| `assignment_publications` | assignment_id, batch_id, published_by, published_at, due_at | assignment, batch | unique(assignment_id, batch_id) | — | no | yes |
| `submissions` | student_id, question_id, question_version, context_type, context_id, attempt_no, answer JSONB, verdict, score, max_score, time_spent_seconds, trust (trusted/untrusted), idempotency_key, execution_run_id | student, question, execution_run | idx(student_id, question_id); idx(context_type, context_id); unique(idempotency_key) | pending/running/graded/awaiting_manual/error | immutable | — |
| `submission_results` | submission_id, test_case_id, verdict, time_ms, memory_kb, stdout_excerpt, stderr_excerpt | submission (cascade), test case | idx(submission_id) | — | immutable | — |
| `execution_runs` | driver, language, source_hash, stdin_hash, status, result JSONB, requested_by | user | idx(requested_by, created_at) | queued/running/done/failed | no | — |
| `tests` | title, type, duration_minutes, settings JSONB, author_id | user | idx(type, status) | draft/published/archived | yes | yes |
| `test_sections` | test_id, title, position, duration_minutes | test (cascade) | unique(test_id, position) | — | no | — |
| `test_questions` | section_id, question_id, question_version, position, marks, negative_marks | section (cascade), question | unique(section_id, position) | — | no | — |
| `test_schedules` | test_id, batch_id, window_start, window_end, max_attempts, results_released_at, released_by | test, batch | idx(batch_id, window_start) | scheduled/live/closed/released | no | yes |
| `test_attempts` | schedule_id, student_id, attempt_no, started_at, deadline_at, submitted_at, auto_submitted, score, max_score, rank, integrity JSONB | schedule, student | unique(schedule_id, student_id, attempt_no); partial unique active per student | in_progress/submitted/graded/released | no | submit/grade |
| `test_answers` | attempt_id, test_question_id, answer JSONB, submission_id, is_correct, score, graded_by, graded_at, flagged | attempt (cascade), test question, submission | unique(attempt_id, test_question_id) | — | no | manual grading |
| `notifications` | user_id, type, title, body, link, data JSONB, read_at | user | idx(user_id, read_at, created_at) | — | no | — |
| `notification_preferences` | user_id, category, in_app, email | user | unique(user_id, category) | — | no | — |
| `announcements` | title, body, audience JSONB, starts_at, ends_at, channels[] | organization | idx(starts_at, ends_at) | scheduled/active/expired | yes | yes |
| `email_templates` | key, subject, body_html, body_text, variables[], is_custom | organization | unique(org, key) | — | no | yes |
| `files` | owner_type, owner_id, driver, bucket, key, mime, size, checksum, visibility, retention_until, uploaded_by | user | idx(owner_type, owner_id) | pending/ready/failed | no | sensitive downloads |
| `report_exports` | requested_by, report, params JSONB, format, file_id, row_count, expires_at | user, file | idx(requested_by, created_at) | queued/running/done/failed | no | yes |
| `report_definitions` | key, name, source (sql template or builder JSON), columns JSONB, filters JSONB, permission | organization | unique(org, key) | active/disabled | no | yes |
| `settings` | key, value JSONB, updated_by | organization | unique(org, key) | — | no | yes |
| `branding_settings` | organization_id, seeds JSONB (name, logos, colours, fonts, radius, density, login, dashboard, email), computed_tokens JSONB, version | organization, files | unique(org) | — | no | yes |
| `feature_flags` | key, enabled, audience JSONB, description | organization | unique(org, key) | — | no | yes |
| `navigation_config` | portal, items JSONB (key, label, order, hidden, icon) | organization | unique(org, portal) | — | no | yes |
| `taxonomies` / `taxonomy_terms` | key, name; term: taxonomy_id, key, label, parent_id, position | organization | unique(taxonomy, key) | active/archived | no | yes |
| `custom_field_definitions` | entity_type, key, label, type, options JSONB, required, visibility, position | organization | unique(org, entity_type, key) | active/archived | no | yes |
| `custom_field_values` | (stored in the owning entity's `custom` JSONB column, validated against definitions) | — | GIN on `custom` where queried | — | — | via owner |
| `integration_configs` | provider, driver, config JSONB (non-secret), secret_ciphertext, status, last_tested_at | organization | unique(org, provider) | — | no | yes (secrets excluded) |
| `content_pages` | slug, title, body JSONB, visibility | organization | unique(org, slug) | draft/published | yes | yes |
| `audit_logs` | actor_id, action, resource_type, resource_id, before JSONB, after JSONB, ip, user_agent, request_id, occurred_at | user | idx(resource_type, resource_id); idx(actor_id, occurred_at) | — | append-only | — |
| Placement (seeded, hidden): `companies`, `placement_drives`, `drive_applications`, `application_events`, `offers` | as master §14.2 | — | — | — | — | — |
| pg-boss schema `pgboss.*` | managed by pg-boss | — | — | — | — | — |
| `reporting.agg_*` | batch/course/day aggregates refreshed by jobs | — | pk(date, batch_id…) | — | — | — |

### 17.4 Entity relationship overview (demo subset)

```
organizations 1─* settings / branding_settings / feature_flags / navigation_config / taxonomies / custom_field_definitions / email_templates / content_pages / integration_configs
users 1─1 student_profiles 1─* batch_members *─1 batches *─1 programs 1─* program_courses *─1 courses
users 1─1 trainer_profiles 1─* batch_trainers *─1 batches
users *─* roles (user_roles); roles *─* permissions (role_permissions); users 1─* sessions / invitations / password_resets / notifications / audit_logs / activity_events
courses 1─* course_modules 1─* lessons 1─* lesson_resources *─1 files; courses 1─* course_publications
student_profiles 1─* enrollments *─1 courses; student_profiles 1─* lesson_progress *─1 lessons
batches 1─* session_series 1─* live_sessions 1─* attendance_records *─1 student_profiles; live_sessions 0─1 lessons (recording)
questions 1─* question_options; questions 1─0..1 coding_problems 1─* test_cases; questions 1─* question_versions
assignments 1─* assignment_modules 1─* assignment_questions *─1 questions; assignments 1─* assignment_publications *─1 batches
student_profiles 1─* submissions 1─* submission_results; submissions 0─1 execution_runs
tests 1─* test_sections 1─* test_questions *─1 questions; tests 1─* test_schedules *─1 batches; test_schedules 1─* test_attempts 1─* test_answers 0─1 submissions
student_profiles 1─* documents / resumes *─1 files
report_definitions; report_exports *─1 files
```

### 17.5 Migration, seed and data policies

- Migrations: Prisma Migrate; one migration per change; expand/contract for renames; CI applies all migrations to a fresh database, then seeds, then runs tests; destructive migrations require a label and review; overlay migrations run after core.
- Seeds: `base` (idempotent; roles, permissions from manifests, default settings, taxonomies, email templates, navigation defaults, organization row) and `demo` (idempotent by natural keys; §21); `clients/<client>/seeds` for client data.
- Retention as master §14.4; demo/staging databases hold synthetic data only.
- Expected demo volumes: ≈ 100 users, 60 students, 6 courses, 120 lessons, 120 questions, 4 assignments, 3 tests, 60 sessions, 3,000 attendance records, 2,000 submissions, 500 notifications — trivially small; indexes are still created as designed for production.

---

## 18. API Architecture

### 18.1 Conventions

As master §15.1 (versioned `/api/v1`, REST, JSON, ISO dates, offset pagination for tables and cursor for feeds, whitelisted sorting, problem+json errors, idempotency keys, rate limits, OpenAPI 3.1, SSE/WebSocket for real-time, health endpoints). Template additions: `GET /branding/public` and `GET /me` return branding tokens, effective navigation, flags and permissions so the web app can render a client-specific shell from one call; all list endpoints accept `q`, `page`, `pageSize`, `sort`, and typed filters; every mutation writes an audit record (column "Audit" below); permission names are the guard keys from §13.

Column legend: **Req** request shape, **Res** response shape, **Val** validation highlights, **Err** notable error cases beyond the standard 400/401/403/404/429, **P/F/S** pagination/filter/sort, **Audit** yes/no.

### 18.2 Authentication

| Method · Path | Purpose | Auth · Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| POST `/auth/login` | Sign in | public | email, password, rememberMe | user summary, accessToken, expiresIn (+ refresh cookie) | email format; password 1–128 | 401 invalid_credentials; 423 locked; 429 throttled | — | yes (login event) |
| POST `/auth/refresh` | Rotate tokens | refresh cookie | — | accessToken, expiresIn (+ new cookie) | — | 401 invalid/reused → session family revoked | — | yes on reuse |
| POST `/auth/logout` | End session | authenticated | — | 204 | — | — | — | yes |
| POST `/auth/logout-all` | End all sessions | authenticated | — | 204 | — | — | — | yes |
| GET `/auth/sessions` | List devices | authenticated | — | sessions[] | — | — | — | no |
| DELETE `/auth/sessions/{id}` | Revoke one | authenticated (own) | — | 204 | — | 404 | — | yes |
| POST `/auth/invitations/{token}/accept` | Activate account | public (token) | password, consents | user summary + tokens | policy; consents required | 410 expired; 409 already accepted | — | yes |
| POST `/auth/password/forgot` | Request reset | public | email | 202 always | email format | — | — | yes (no email leak) |
| POST `/auth/password/reset` | Set password | public (token) | token, password | 204 | policy | 410 expired; 409 used | — | yes |
| GET `/me` | Identity, roles, permissions, flags, navigation, branding tokens | authenticated | — | me object | — | — | — | no |

### 18.3 Users, roles, permissions

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/users` | List staff | users:read | — | page of users | — | — | page; filters role,status,q; sort name,lastLoginAt | no |
| POST `/users` | Invite user | users:manage | name, email, roleKeys[] | user (invited) | unique email; roles exist | 409 duplicate | — | yes |
| GET `/users/{id}` | Detail | users:read | — | user with roles, sessions count | — | — | — | no |
| PATCH `/users/{id}` | Edit | users:manage | name, mobile | user | — | 409 duplicate mobile | — | yes |
| POST `/users/{id}/deactivate` · `/reactivate` | Status | users:manage | reason | user | not self | 409 state | — | yes |
| PUT `/users/{id}/roles` | Assign roles | users:manage (Super Admin for Super Admin role) | roleKeys[] | user | last Super Admin protected | 409 | — | yes |
| POST `/users/{id}/invitations/resend` | Resend | users:manage | — | 202 | invited only | 409 | — | yes |
| GET `/roles` | Roles | roles:read | — | roles[] with permission counts | — | — | — | no |
| POST `/roles` | Create role | roles:manage | key, name, cloneFrom? | role | unique key | 409 | — | yes |
| GET `/roles/{id}/permissions` | Bundle | roles:read | — | [{permissionKey, scope}] | — | — | — | no |
| PUT `/roles/{id}/permissions` | Replace bundle | roles:manage | [{permissionKey, scope}] | role | keys in catalogue; scope valid; cannot strip own Super Admin | 422 | — | yes |
| GET `/permissions` | Catalogue | roles:read | — | permissions[] grouped by module | — | — | — | no |

### 18.4 Students and trainers

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/students` | List | students:read (scope) | — | page (code, name, batches, status, verification, progress, lastActive) | — | — | page; filters batchId, status, programId, verification, q; sort | no |
| POST `/students` | Create + invite | students:manage | name, email, mobile?, batchId?, custom{} | student | unique email; custom fields per definitions | 409 | — | yes |
| POST `/students/import` | Bulk import (job) | users:import | multipart file, batchId?, sendInvites, dryRun | 202 {jobId} | ≤ 5 MB, ≤ 5,000 rows | 413; 409 running | — | yes |
| GET `/students/import/{jobId}` | Job status | users:import | — | status, counts, errors[], reportFileId | — | — | — | no |
| GET `/students/{id}` | Detail | students:read (scope); sensitive fields need students:read_sensitive | — | student (fields filtered by permission) | — | — | — | no |
| PATCH `/students/{id}` | Edit | students:manage | profile sections, custom{} | student | section schemas | 422 | — | yes |
| POST `/students/{id}/status` | Transition | students:manage | status, reason | student | state machine | 409 | — | yes |
| GET `/students/{id}/progress` · `/attendance` · `/submissions` · `/tests` | Sub-resources | students:read (scope) | — | respective lists | — | — | page | no |
| GET `/students/{id}/documents` | Documents | students:read_sensitive | — | documents[] | — | — | — | no |
| POST `/students/{id}/documents/{docId}/verify` | Verify/reject | students:verify_documents | decision, reason? | document | reason on reject | 409 | — | yes |
| POST `/students/{id}/notes` | Staff note | students:read (scope) | text | note | ≤ 2,000 chars | — | — | yes |
| GET/POST `/trainers`, GET/PATCH `/trainers/{id}`, PUT `/trainers/{id}/batches` | Trainer management | trainers:manage / trainers:read | profile fields; assignments[] | trainer | unique per batch/subject | 409 | page; filters subject,status,q | yes |
| GET/PATCH `/trainers/me` | Own profile | authenticated trainer | — | trainer | — | — | — | yes |

### 18.5 Programmes, batches, sessions, attendance

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET/POST `/programs`, GET/PATCH `/programs/{id}` | Programme CRUD | programs:manage / batches:read | name, code, weeks, courseIds[] | program | unique code | 409 | page | yes |
| GET `/batches` | List | batches:read (scope) | — | page | — | — | page; filters programId,status,trainerId,from,to; sort | no |
| POST `/batches` | Create | batches:manage | programId, code, name, mode, startDate, endDate, capacity, custom{} | batch | dates; unique code | 409 | — | yes |
| GET `/batches/{id}` | Detail with stats | batches:read (scope) | — | batch, counts, trainers, health | — | — | — | no |
| PATCH `/batches/{id}` | Edit | batches:manage | fields | batch | — | — | — | yes |
| POST `/batches/{id}/status` | Transition | batches:manage | status, force?, reason? | batch | unmarked sessions warning | 409 | — | yes |
| GET/POST `/batches/{id}/members` | Roster / add | batches:read / batches:manage | studentIds[] | members | capacity; not already active | 409 | page | yes |
| DELETE `/batches/{id}/members/{studentId}` | Leave | batches:manage | reason | 204 | — | — | — | yes |
| POST `/batches/{id}/members/transfer` | Transfer | batches:manage | studentId, toBatchId, reason | member records | target running/planned | 409 | — | yes |
| PUT `/batches/{id}/trainers` | Assign | batches:manage | [{trainerId, subject, role}] | assignments | unique per subject | 409 | — | yes |
| GET `/batches/{id}/timetable` | Series + occurrences | sessions:read (scope) | from, to | series[], sessions[] | — | — | range | no |
| POST `/batches/{id}/timetable` | Create series | sessions:manage (scope) | subject, trainerId, startsAt, endsAt, recurrence, until, joinUrl, provider, skipDates[] | seriesId, occurrences, conflicts[] | end > start; trainer assigned; until ≤ batch end + 30 d | 409 conflicts | — | yes |
| GET `/batches/{id}/publications` | Published content | batches:read (scope) | — | courses[], assignments[], tests[] | — | — | — | no |
| GET `/sessions` | List | sessions:read (scope) | — | page | — | — | filters batchId,trainerId,from,to,status | no |
| PATCH `/sessions/{id}` | Reschedule/edit one | sessions:manage (scope) | startsAt, endsAt, joinUrl, notes | session | conflicts | 409 | — | yes |
| POST `/sessions/{id}/status` | live/completed/cancelled | sessions:run (scope) | status, reason? | session | transitions | 409 | — | yes |
| POST `/sessions/{id}/recording` | Attach recording | sessions:run (scope) | fileId or url, courseId? | lesson created | file ready | 422 | — | yes |
| GET `/sessions/{id}/attendance` | Records | attendance:read (scope) | — | records[] with defaults | — | — | — | no |
| PUT `/sessions/{id}/attendance` | Mark/correct | attendance:mark (scope); corrections after window need attendance:manage | records[{studentId,status,note?}], reason? | {marked, corrected} | session completed; status enum; reason on correction | 409 window closed; 422 not completed | — | yes |
| GET `/me/schedule` | Student/trainer calendar | authenticated | from, to | sessions[] with join eligibility | — | — | range | no |
| GET `/me/attendance` | Own attendance | authenticated student | from, to, subject? | records[], percentage | — | — | range | no |
| GET `/reports/attendance` | Report | reports:read (scope) | filters | rows, summary | — | — | page; filters; sort | no |

### 18.6 Courses, lessons, enrolments, progress, files

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/courses` | Staff list | courses:manage | — | page | — | — | filters status, level, subject, q | no |
| POST `/courses` | Create | courses:manage | title, description, level, subject, tags, thumbnailFileId | course | title 3–120 | — | — | yes |
| GET `/courses/{id}` | Detail (student view when enrolled; staff view otherwise) | courses:read (enrolled) or courses:manage | — | course + outline + (progress for students) | — | 403 if not in scope | — | no |
| PATCH `/courses/{id}` | Settings | courses:manage | fields | course | — | — | — | yes |
| PUT `/courses/{id}/outline` | Replace outline | courses:manage | modules[{id?, title, position, unlockRule, lessons[...]}] | outline | depth; positions unique; content per type | 422 | — | yes (version) |
| POST `/courses/{id}/publish` · `/unpublish` | Scope publication | courses:publish | scopeType, scopeId?, note | publication | ≥ 1 lesson; videos ready | 422 | — | yes |
| GET `/lessons/{id}` | Lesson content (student) | courses:read (enrolled) | — | lesson (content, resources, playback token) | — | 423 locked | — | no |
| POST `/lessons/{id}/progress` | Position/watched | courses:read (enrolled) | positionSeconds, watchedPct, idempotencyKey | progress | ≤ duration | — | — | no |
| POST `/lessons/{id}/complete` | Manual complete | courses:read (enrolled) | — | progress | rule allows manual | 409 | — | no |
| GET `/me/courses` | Student catalogue | authenticated student | status? | courses with progress | — | — | filters status, q | no |
| GET `/me/progress` | Progress overview | authenticated | — | overall, courses[], assignments[], tests[], attendance summary, activity[] | — | — | — | no |
| POST `/files/uploads` | Presign | files:upload (context) | context, filename, mime, size | uploadId, url (or multipart parts), fileId | mime/size per context | 413; 415 | — | no |
| POST `/files/uploads/{id}/complete` | Finalise | files:upload | parts? | file (ready after sniff) | checksum | 422 | — | yes (sensitive) |
| GET `/files/{id}/url` | Presigned download | files:read (context) | — | url, expiresAt | — | 403 | — | yes (sensitive) |
| DELETE `/files/{id}` | Remove | owner or manage | — | 204 | not referenced | 409 | — | yes |
| POST `/videos` | Register video (driver) | courses:manage | fileId or externalRef | video ref, status | — | — | — | yes |
| GET `/videos/{id}/playback` | Signed playback | courses:read (enrolled) | — | url/token, expiresAt | — | 403 | — | no |

### 18.7 Questions, assignments, submissions, practice

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/questions` | Bank | questions:read | — | page | — | — | filters type,subject,topic,difficulty,status,author,q; sort | no |
| POST `/questions` | Create draft | questions:manage or questions:create_own | type, title, body, payload, difficulty, marks, tags… | question | per-type schema | 422 | — | yes |
| GET `/questions/{id}` | Detail (staff; hidden data included) | questions:read | — | question | — | — | — | no |
| PATCH `/questions/{id}` | Edit (new version if published) | questions:manage / own | fields | question | — | 409 retired | — | yes |
| POST `/questions/{id}/validate` | Run reference solution | questions:manage / own | — | validation report | coding only | 422 | — | no |
| POST `/questions/{id}/publish` · `/retire` | Lifecycle | questions:manage | — | question | validation passed | 409 | — | yes |
| GET `/questions/{id}/versions` | History | questions:read | — | versions[] | — | — | — | no |
| POST `/questions/import` | Bulk (job) | questions:import | multipart, mapping, dryRun | 202 {jobId} | ≤ 5 MB | 413 | — | yes |
| GET/POST `/assignments`, GET/PATCH `/assignments/{id}` | CRUD | assignments:manage (scope) | title, description, level, settings | assignment | — | — | page; filters | yes |
| PUT `/assignments/{id}/structure` | Modules and questions | assignments:manage | modules[{title, unlockRule, questions[{questionId, marksOverride}]}] | structure | questions published | 422 | — | yes |
| POST `/assignments/{id}/publish` | Publish to batches | assignments:publish (scope) | batchIds[], dueAt? | publications | batches in scope | 409 | — | yes |
| GET `/assignments/{id}/me` | Student view | assignments:read (published to student) | — | modules with lock state, questions with attempt stats | — | 403 | — | no |
| GET `/assignments/{id}/progress` | Staff progress | assignments:manage (scope) | batchId | rows per student | — | — | page; sort | no |
| GET `/me/assignments` | Student list | authenticated student | — | assignments with progress | — | — | filters status,q | no |
| POST `/questions/{id}/submissions` | Submit/run | assignments:submit / tests:attempt / practice:use (own) | context{type,id,attemptId?}, mode, answer, Idempotency-Key | 200 graded (objective) or 202 pending (coding) | per-type answer; attempt limit; lock; quota | 409 locked/limit; 422 language; 429 quota | — | no (submission is the record) |
| GET `/submissions/{id}` | State/results | own or staff scope | — | submission with results (hidden tests summarised) | — | — | — | no |
| GET `/submissions/{id}/events` | SSE status | own | — | events | — | — | — | no |
| POST `/submissions/{id}/grade` | Manual grade | assignments:grade (scope) | score, feedback | submission | ≤ max | 409 not manual | — | yes |
| GET `/practice/problems` | Catalogue | practice:use | — | page (title, difficulty, points, status) | — | — | filters topic,difficulty,language,status,q | no |
| GET `/practice/problems/{slug}` | Problem | practice:use | — | statement, samples, starter code, languages available per driver | — | — | — | no |
| POST `/practice/problems/{id}/submissions` | Run/submit | practice:use | mode, language, source, stdin?, clientResults? (browser driver) | submission (trust marked) | source ≤ 64 KB; quota | 429 | — | no |
| POST `/execute` | Free run (future playground; used by validation now) | practice:use / questions:manage | language, source, stdin | run result | quotas | 429 | — | no |
| GET `/languages` | Available languages per driver | authenticated | — | languages[] with driver capabilities | — | — | — | no |

### 18.8 Tests and attempts

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET/POST `/tests`, GET/PATCH `/tests/{id}` | CRUD | tests:manage (scope) | title, type, duration, settings | test | — | — | page; filters | yes |
| PUT `/tests/{id}/structure` | Sections/questions | tests:manage | sections[{title, duration?, questions[{questionId, marks, negative}]}] | structure | published questions | 422 | — | yes |
| POST `/tests/{id}/schedules` | Schedule | tests:schedule (scope) | batchId, windowStart, windowEnd, maxAttempts | schedule | window valid; batch in scope | 409 overlap | — | yes |
| PATCH `/schedules/{id}` | Edit window | tests:schedule | fields | schedule | not started | 409 | — | yes |
| GET `/me/tests` | Student list | authenticated student | — | upcoming/live/history with status | — | — | filters | no |
| POST `/tests/{id}/attempts` | Start | tests:attempt | scheduleId | attempt (deadline, serverTime, sections) | in window; attempts left | 409 active exists (returns it); 422 outside window | — | yes |
| GET `/attempts/{id}/state` | Resume | own | — | answers, flags, deadline, serverTime | — | 410 ended | — | no |
| GET `/attempts/{id}/sections/{sid}/questions` | Questions (no answers) | own, in progress | — | questions[] | — | 409 | — | no |
| PATCH `/attempts/{id}/answers` | Autosave | own, in progress | answers[] | saved count, serverTime | — | 410 deadline passed (30 s grace) | — | no |
| POST `/attempts/{id}/events` | Integrity events | own | events[] | 204 | — | — | — | no |
| POST `/attempts/{id}/submit` | Submit | own | — | attempt (submitted) | — | 409 already | — | yes |
| GET `/attempts/{id}/result` | Result | own (released) or staff scope | — | score, sections, rank, review (policy) | — | 403 not released | — | no |
| GET `/tests/{id}/monitor` | Live monitor | tests:monitor (scope) | scheduleId | counts, per-student status, flags | — | — | — | no |
| GET `/tests/{id}/results` | Results table | tests:manage (scope) | scheduleId | rows | — | — | page; sort | no |
| PATCH `/attempts/{id}/answers/{answerId}/grade` | Manual grade | tests:grade (scope) | score, comment | answer, attempt totals | ≤ marks | 409 | — | yes |
| POST `/tests/{id}/release` | Release results | tests:release (scope) | scheduleId | schedule | grading complete or force | 409 | — | yes |

### 18.9 Reports, notifications, announcements

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/reports/dashboard` | Admin metrics | reports:read (scope) | from, to, programId, batchId, courseId, trainerId | metrics, definitions, asOf | ranges ≤ 24 months | — | — | no |
| GET `/reports` | Report catalogue (incl. client definitions) | reports:read | — | reports[] | — | — | — | no |
| GET `/reports/{name}` | Report data | reports:read (scope) | filters | summary, chart series, rows | — | — | page; filters; sort | no |
| POST `/exports` | Export job | reports:export (scope) | report, params, format | 202 {exportId} | caps | 429 too many | — | yes |
| GET `/exports`, GET `/exports/{id}`, GET `/exports/{id}/download` | Jobs and download | reports:export | — | list / status / presigned url | — | 410 expired | page | yes (download) |
| GET `/me/notifications` | List | authenticated | — | page (unread first) | — | — | cursor; filters type,unread | no |
| PATCH `/me/notifications/{id}/read` · POST `/me/notifications/read-all` | Mark read | authenticated | — | 204 | — | — | — | no |
| GET/PUT `/me/notification-preferences` | Preferences | authenticated | matrix | matrix | categories exist | — | — | no |
| POST `/notifications/broadcast` | Staff message | notifications:broadcast (scope) | audience, title, body, channels | 202 count | audience in scope | 422 | — | yes |
| GET/POST `/announcements`, PATCH/DELETE `/announcements/{id}` | Announcements | announcements:manage | title, body, audience, startsAt, endsAt, channels | announcement | window valid | — | page | yes |
| GET `/me/dashboard` | Student home aggregate | authenticated student | — | today, continue, progress, tasks, announcements, attendance | — | — | — | no |
| GET `/trainer/dashboard` | Trainer home | authenticated trainer | — | sessions, grading counts, batch health, at-risk | — | — | — | no |

### 18.10 Settings, branding, feature flags, navigation, fields, templates, audit, health, search

| Method · Path | Purpose | Permission | Req | Res | Val | Err | P/F/S | Audit |
|---|---|---|---|---|---|---|---|---|
| GET `/settings` | All settings (typed) | settings:read | — | sections | — | — | — | no |
| PATCH `/settings` | Update | settings:manage | partial sections | settings | per-section Zod schemas (attendance, assessment, academic, locale, legal) | 422 | — | yes |
| GET `/branding/public` | Public branding + tokens | public (cached, ETag) | — | name, logos, favicon, tokens{light,dark}, login, fonts | — | — | — | no |
| GET `/branding` · PATCH `/branding` | Manage seeds | branding:manage | seeds | branding + computed tokens | colour format; contrast ≥ 4.5:1; asset types | 422 contrast | — | yes |
| POST `/branding/preview` | Render preview tokens | branding:manage | seeds | tokens | — | — | — | no |
| GET `/flags` · PATCH `/flags/{key}` | Feature flags | flags:manage (read via /me for all) | enabled, audience | flag | key exists (module manifests) | 404 | — | yes |
| GET `/navigation/{portal}` · PATCH `/navigation/{portal}` | Labels/order/visibility | settings:manage | items[] | config | keys exist | 422 | — | yes |
| GET/POST `/taxonomies`, GET/POST/PATCH `/taxonomies/{key}/terms` | Taxonomies | settings:manage (read for all) | key, label, parent, position | terms | unique key | 409 | — | yes |
| GET/POST/PATCH `/custom-fields` | Definitions | settings:manage | entityType, key, label, type, options, required, visibility | definition | unique per entity; type enum | 409 | — | yes |
| GET/PATCH `/templates/{key}`, POST `/templates/{key}/test` | Email templates | settings:manage | subject, bodyHtml, bodyText; test recipient | template / 202 | variables valid | 422 | — | yes |
| GET/POST/PATCH `/content-pages`, GET `/content-pages/{slug}` (public) | Content pages | settings:manage / public | slug, title, body, visibility | page | unique slug | 409 | — | yes |
| GET/PATCH `/integrations/{provider}`, POST `/integrations/{provider}/test` | Providers | settings:manage | driver, config, secret (write-only) | config without secret / test result | driver supported | 422 | — | yes (no secret) |
| GET `/audit-logs` | Audit viewer | audit:read | — | page | — | — | page; filters actor, action, resourceType, from, to; sort occurredAt | no |
| GET `/admin/health` | Health cards | settings:manage | — | db, storage, email, queue{depth, failed}, execution driver, version | — | — | — | no |
| POST `/admin/jobs/{id}/retry` | Retry failed job | settings:manage | — | 202 | — | 404 | — | yes |
| GET `/health/live` · `/health/ready` | Probes | public (internal) | — | 200/503 | — | — | — | no |
| GET `/search` | Search | search:use | q, types[] | grouped results (permitted only) | 2 ≤ len ≤ 100 | — | limit | no |

### 18.11 Contract governance

OpenAPI generated from decorators; the web client regenerated in CI; contract tests validate every documented response; additive changes only within `/v1`; deprecations announced in the changelog; client overlays may add endpoints under `/api/v1/ext/<client>/...` and must not modify core routes.

---
