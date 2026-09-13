## 14. Database Architecture

> **Status: preliminary.** Entity names, fields and relationships below are a starting point for Phase 1 modelling and will change as requirements are confirmed. Only entities justified by approved scope are created in each phase.

### 14.1 Conventions

- Table names plural snake_case; primary keys `id` as UUID v7 (time-ordered); `created_at`, `updated_at` on every table; `deleted_at` for soft-deleted user-facing entities; `created_by`/`updated_by` where an actor exists.
- Times stored in UTC `timestamptz`; display in IST.
- Enumerations as PostgreSQL enums or check-constrained text (decided per table); JSONB payloads versioned with a `schema_version` field.
- Every foreign key indexed; composite indexes for scope queries; unique constraints listed below.

### 14.2 Entity catalogue

| ID | Entity | Purpose | Important fields | Relationships | Constraints and indexes | Audit |
|---|---|---|---|---|---|---|
| E-01 | `users` | Identity for every person | email (unique), mobile (unique, nullable), password_hash, status (invited/active/suspended/deactivated), name, avatar_file_id, email_verified_at, mobile_verified_at, last_login_at, timezone | roles via E-05; profiles E-08/E-09 | unique(email); unique(mobile) where not null; index(status) | Yes (all changes) |
| E-02 | `roles` | Role bundles | key (unique), name, description, is_system | E-04, E-05 | unique(key) | Yes |
| E-03 | `permissions` | Permission catalogue (seeded) | key (unique), resource, action, description | E-04 | unique(key) | No (seeded) |
| E-04 | `role_permissions` | Bundle membership | role_id, permission_id, scope (all/batch/own) | E-02, E-03 | pk(role_id, permission_id) | Yes |
| E-05 | `user_roles` | Role assignment | user_id, role_id, granted_by, granted_at | E-01, E-02 | pk(user_id, role_id) | Yes |
| E-06 | `sessions` | Refresh sessions and devices | user_id, refresh_token_hash, device_label, ip, user_agent, expires_at, revoked_at, last_used_at | E-01 | index(user_id), index(expires_at) | Login/logout events |
| E-07 | `otp_codes` | OTP challenges | user_id or mobile, code_hash, purpose, expires_at, attempts, consumed_at | E-01 | index(mobile, purpose) | Yes (issue/verify) |
| E-08 | `student_profiles` | Student-specific data | user_id (unique), student_code (unique, institute ID), status (prospect/enrolled/active/completed/alumni/dropped), personal JSONB (gender, dob, addresses), education JSONB[], experience JSONB[], links JSONB (github, linkedin, portfolio), summary, hobbies, languages, relocation_ready, placed_at, verification_status, completeness_score | E-01, E-12, E-54–E-56 | unique(user_id); index(status); GIN on searchable JSONB | Yes; sensitive fields gated |
| E-09 | `trainer_profiles` | Trainer-specific data | user_id (unique), subjects text[], bio, joined_at | E-01, E-13 | unique(user_id) | Yes |
| E-10 | `programs` | Programme templates | name, code, duration_weeks, description, certificate_template_id | E-11, E-14 via `program_courses` | unique(code) | Yes |
| E-11 | `batches` | Cohort instances | program_id, name, code (unique), mode (online/offline/hybrid), start_date, end_date, capacity, status (planned/running/completed/archived), timezone | E-10, E-12, E-13, E-22, publications | unique(code); index(status, start_date) | Yes |
| E-12 | `batch_members` | Student membership with history | batch_id, student_id, joined_at, left_at, reason, is_active | E-11, E-08 | unique(batch_id, student_id, joined_at); index(student_id) partial where is_active | Yes |
| E-13 | `batch_trainers` | Trainer assignment | batch_id, trainer_id, subject, role (lead/assistant) | E-11, E-09 | unique(batch_id, trainer_id, subject) | Yes |
| E-14 | `courses` | Course definitions | title, slug, description, thumbnail_file_id, level, tags text[], status (draft/published/archived), current_version, estimated_minutes, owner_id | E-15, E-18, E-19 | unique(slug); tsvector index on title/description | Yes (publish) |
| E-15 | `course_modules` | Ordered modules | course_id, title, position, unlock_rule JSONB | E-14, E-16 | unique(course_id, position) | Content versioning |
| E-16 | `lessons` | Lessons of any type | module_id, title, type (video/article/resources/link/practice/live_recording), position, duration_seconds, content JSONB (blocks), video_provider_id, question_id (practice), session_id (recording), completion_rule (watch_pct/manual), is_mandatory | E-15, E-17, E-25, E-22 | unique(module_id, position); index(type) | Content versioning |
| E-17 | `lesson_resources` | Attachments per lesson | lesson_id, file_id or url, title, position | E-16, E-72 | index(lesson_id) | — |
| E-18 | `course_publications` | Visibility scopes and versions | course_id, scope_type (all/program/batch), scope_id, version, published_at, published_by, unpublished_at | E-14, E-10/E-11 | unique(course_id, scope_type, scope_id) active | Yes |
| E-19 | `enrollments` | Student ↔ course (derived from publications or explicit) | student_id, course_id, source (batch/program/manual), enrolled_at, completed_at, progress_pct | E-08, E-14 | unique(student_id, course_id) | — |
| E-20 | `lesson_progress` | Per-lesson state | student_id, lesson_id, status (not_started/in_progress/completed), position_seconds, watched_pct, completed_at, last_accessed_at | E-08, E-16 | unique(student_id, lesson_id); index(student_id, last_accessed_at) | — |
| E-21 | `activity_events` | Append-only activity stream | user_id, type, entity_type, entity_id, payload JSONB, occurred_at, idempotency_key | E-01 | index(user_id, occurred_at); unique(idempotency_key); monthly partitions later | Append-only |
| E-22 | `live_sessions` | Session occurrences (+ `session_series` for recurrence) | series_id, batch_id, trainer_id, subject, title, starts_at, ends_at, join_url, provider (zoom/meet/other/event), status (scheduled/live/completed/cancelled), recording_lesson_id, type (class/event) | E-11, E-09, E-16, E-24 | index(batch_id, starts_at); index(trainer_id, starts_at) | Yes (status, reschedule) |
| E-24 | `attendance_records` | Attendance per session per student | session_id, student_id, status (present/absent/late/excused/holiday), marked_by, marked_at, source (manual/qr/auto), corrected_from, reason | E-22, E-08 | unique(session_id, student_id); index(student_id) | Yes (corrections) |
| E-25 | `questions` | Question bank (all types) | type (mcq_single/mcq_multi/true_false/fill/descriptive/coding/sql/web/debug), title, body (markdown), payload JSONB (type-specific), difficulty, marks, negative_marks, subject, topic, tags text[], company_id (nullable), status (draft/review/published/retired), version, author_id, explanation | E-26–E-28, E-31, E-37, E-48 | index(type, status, subject, difficulty); GIN(tags); tsvector | Yes (publish, version) |
| E-26 | `question_options` | Options for objective types | question_id, text, is_correct, position, explanation | E-25 | unique(question_id, position) | — |
| E-27 | `coding_problems` | Executable problem details (1:1 with coding/sql/web/debug questions) | question_id, languages JSONB (starter code, reference solution per language), time_limit_ms, memory_limit_mb, io_format, sample_io JSONB, sql_schema, sql_seed, web_files JSONB, web_checks JSONB, points | E-25, E-28 | unique(question_id) | Yes |
| E-28 | `test_cases` | Hidden/sample tests | problem_id, input, expected_output, is_sample, weight, position, comparator (exact/token/float) | E-27 | index(problem_id, position) | Yes |
| E-29 | `assignments` | Practice sets | title, description, level, status, settings JSONB (attempts, show_explanation, unlock_rule, due_policy), author_id | E-30, E-32 | index(status) | Yes |
| E-30 | `assignment_modules` | Ordered modules | assignment_id, title, position, unlock_rule JSONB | E-29, E-31 | unique(assignment_id, position) | — |
| E-31 | `assignment_questions` | Question membership | module_id, question_id, question_version, position, marks_override | E-30, E-25 | unique(module_id, position) | — |
| E-32 | `assignment_publications` | Batch publication | assignment_id, batch_id, published_at, due_at, published_by | E-29, E-11 | unique(assignment_id, batch_id) | Yes |
| E-33 | `submissions` | Any answer submission (assignment/practice/test) | student_id, question_id, question_version, context_type (assignment/practice/test), context_id, attempt_no, answer JSONB (options/text/code/language), status (pending/running/graded/error), verdict, score, max_score, time_spent_seconds, idempotency_key, execution_ref | E-08, E-25, E-34 | index(student_id, question_id); index(context_type, context_id); unique(idempotency_key) | Immutable |
| E-34 | `submission_results` | Per-test-case results | submission_id, test_case_id, verdict, time_ms, memory_kb, stdout_excerpt, stderr_excerpt | E-33, E-28 | index(submission_id) | Immutable |
| E-35 | `tests` | Test definitions | title, type (weekly/on_demand/company/contest/practice), duration_minutes, settings JSONB (shuffle, sections timing, integrity, release), status, author_id, company_id | E-36–E-38 | index(type, status) | Yes |
| E-36 | `test_sections` | Sections | test_id, title, position, duration_minutes (nullable) | E-35, E-37 | unique(test_id, position) | — |
| E-37 | `test_questions` | Questions per section | section_id, question_id, question_version, position, marks, negative_marks | E-36, E-25 | unique(section_id, position) | — |
| E-38 | `test_schedules` | Windows per batch | test_id, batch_id (nullable for open practice), window_start, window_end, max_attempts, results_released_at | E-35, E-11 | index(batch_id, window_start) | Yes |
| E-39 | `test_attempts` | Attempts | schedule_id, student_id, started_at, deadline_at, submitted_at, status (in_progress/submitted/graded/released), auto_submitted, score, max_score, rank, integrity JSONB (tab_switches, fullscreen_exits) | E-38, E-08, E-40 | unique(schedule_id, student_id, attempt_no); partial unique active attempt | Yes (submit, grade) |
| E-40 | `test_answers` | Answers per question | attempt_id, test_question_id, answer JSONB, submission_id (coding), is_correct, score, graded_by, graded_at, flagged | E-39, E-37, E-33 | unique(attempt_id, test_question_id) | Yes (manual grading) |
| E-41 | `projects` | Project briefs | title, brief (markdown), rubric JSONB, resources JSONB, milestones JSONB, deadline_policy, status, author_id | E-42, publications | index(status) | Yes |
| E-42 | `project_submissions` | Submissions | project_id, student_id, version, repo_url, demo_url, file_id, notes, status (submitted/under_review/approved/rework), submitted_at | E-41, E-08, E-43 | unique(project_id, student_id, version) | Yes |
| E-43 | `project_reviews` | Reviews | submission_id, reviewer_id, rubric_scores JSONB, total, comments, decision, reviewed_at | E-42, E-01 | index(submission_id) | Yes |
| E-44 | `certificate_templates` | Templates | name, type, layout JSONB, signatory, rules JSONB, is_active | E-45 | — | Yes |
| E-45 | `certificates` | Issued certificates | template_id, student_id, course_id/program_id, code (unique), code_hash, issued_at, file_id, status (issued/revoked), revoked_reason | E-44, E-08, E-14/E-10, E-72 | unique(code); index(student_id) | Yes |
| E-46 | `feedback_forms` | Forms and schedules | title, questions JSONB, target_type, schedule JSONB, is_anonymous, status | E-47 | — | Yes |
| E-47 | `feedback_responses` | Responses | form_id, target_id (session/course/trainer), respondent_token_hash (anonymous) or student_id, answers JSONB, submitted_at | E-46 | unique(form_id, target_id, respondent_token_hash) | Anonymity-preserving |
| E-48 | `companies` | Hiring companies | name, slug, sector, locations text[], website, tags text[], contacts JSONB (gated), status | E-49, E-53, E-25 | unique(slug); tsvector | Yes |
| E-49 | `placement_drives` | Drives/jobs | company_id, code (unique, e.g. DRV-2026-0001), title, description, type (technical/non_technical/internal), locations, package_min, package_max, openings, eligibility JSONB (rules), rounds JSONB, deadline_at, status (draft/open/closed/completed), visibility JSONB (batches), created_by | E-48, E-50 | index(status, deadline_at) | Yes |
| E-50 | `drive_applications` | Applications | drive_id, student_id, stage (applied/shortlisted/interview/offered/joined/rejected/withdrawn), resume_file_id (snapshot), applied_at, current_round, notes (staff) | E-49, E-08, E-51, E-52 | unique(drive_id, student_id); index(stage) | Yes |
| E-51 | `application_events` | Stage history | application_id, from_stage, to_stage, actor_id, note, occurred_at | E-50 | index(application_id) | Append-only |
| E-52 | `offers` | Offers and joining | application_id, package, role_title, location, offered_at, accepted_at, joined_at, status | E-50 | unique(application_id) | Yes |
| E-53 | `company_kits` (+ `kit_items`) | Preparation kits | company_id, title, status; items: type (pdf/video/link/question_set/note), file_id/url/question ids, position | E-48, E-72, E-25 | index(company_id) | Yes |
| E-54 | `student_skills` | Declared and derived skills | student_id, skill, source (declared/derived), level, rating, evidence JSONB, updated_at | E-08 | unique(student_id, skill, source) | — |
| E-55 | `resumes` | Resume files | student_id, file_id, title, is_default, source (uploaded/generated), created_at | E-08, E-72 | index(student_id); one default per student (partial unique) | Yes |
| E-56 | `documents` | Verification documents | student_id, type (id_proof/degree/marksheet/other), file_id, status (pending/verified/rejected), reviewed_by, reason | E-08, E-72 | index(student_id, type) | Yes |
| E-57 | `notifications` | In-app notifications | user_id, type, title, body, link, data JSONB, read_at, created_at | E-01 | index(user_id, read_at, created_at) | — |
| E-58 | `notification_preferences` | Channel preferences | user_id, category, in_app, email, sms, push | E-01 | unique(user_id, category) | — |
| E-59 | `announcements` | Targeted announcements | title, body, audience JSONB, starts_at, ends_at, channels, created_by | — | index(starts_at, ends_at) | Yes |
| E-60 | `bookmarks` | Saved items | user_id, entity_type, entity_id, created_at | E-01 | unique(user_id, entity_type, entity_id) | — |
| E-61 | `points_ledger` | Points events | student_id, source_type, source_id, points, occurred_at | E-08 | index(student_id, occurred_at); unique(source_type, source_id, student_id) | Append-only |
| E-62 | `streaks` | Streak state | student_id, current_days, longest_days, last_active_date | E-08 | unique(student_id) | — |
| E-63 | `ai_conversations` | Conversations/interviews | user_id, type (assistant/interview), mode, context JSONB, status, model, created_at | E-01, E-64 | index(user_id, created_at) | Retention policy |
| E-64 | `ai_messages` | Messages | conversation_id, role, content, tokens_in, tokens_out, created_at | E-63 | index(conversation_id) | Retention policy |
| E-65 | `ai_usage` | Daily usage/cost | user_id, date, requests, tokens_in, tokens_out, est_cost | E-01 | unique(user_id, date) | — |
| E-66 | `audit_logs` | Append-only audit | actor_id, action, resource_type, resource_id, before JSONB, after JSONB, ip, user_agent, request_id, occurred_at | E-01 | index(resource_type, resource_id); index(actor_id, occurred_at); partitioned by month later | Append-only, no updates/deletes |
| E-67 | `settings` | Typed settings | key (unique), value JSONB, updated_by | — | unique(key) | Yes |
| E-68 | `feature_flags` | Flags with audiences | key (unique), enabled, audience JSONB (roles, batches, percentage) | — | unique(key) | Yes |
| E-69 | `report_exports` | Export jobs | requested_by, report, params JSONB, format, status, file_id, row_count, expires_at | E-01, E-72 | index(requested_by, created_at) | Yes |
| E-70 | `event_registrations` | Registrations for events (sessions with type=event) | session_id, student_id, registered_at, attended | E-22, E-08 | unique(session_id, student_id) | — |
| E-71 | `doubts` (+ `doubt_messages`) | Q&A threads | student_id, batch_id, context_type, context_id, title, status (open/answered/resolved), assigned_trainer_id | E-08, E-11, E-09 | index(batch_id, status) | — |
| E-72 | `files` | File registry | owner_type, owner_id, bucket, key, mime, size, checksum, visibility, scan_status, retention_until, uploaded_by | many | index(owner_type, owner_id) | Yes (sensitive downloads) |

Supporting tables not listed individually: `program_courses` (program ↔ course ordering), `session_series` (recurrence definitions), `kit_items`, `doubt_messages`, `saved_filters`, `email_templates`, `privacy_requests`, `integration_configs` (encrypted), `language_catalogue` (execution language mapping), `reporting.*` aggregates (`agg_batch_daily`, `agg_course_progress`, `agg_assignment_status`, `agg_test_scores`, `agg_attendance`, `agg_placement_funnel`).

### 14.3 Entity relationship overview

```
users 1─1 student_profiles 1─* batch_members *─1 batches *─1 programs 1─* program_courses *─1 courses
users 1─1 trainer_profiles 1─* batch_trainers *─1 batches
users *─* roles (user_roles) ; roles *─* permissions (role_permissions)

courses 1─* course_modules 1─* lessons 1─* lesson_resources *─1 files
courses 1─* course_publications (scope: all | program | batch)
student_profiles 1─* enrollments *─1 courses ; student_profiles 1─* lesson_progress *─1 lessons

batches 1─* live_sessions (series) 1─* attendance_records *─1 student_profiles
live_sessions 0─1 lessons (recording) ; live_sessions 1─* event_registrations

questions 1─* question_options ; questions 1─0..1 coding_problems 1─* test_cases
assignments 1─* assignment_modules 1─* assignment_questions *─1 questions
assignments 1─* assignment_publications *─1 batches
tests 1─* test_sections 1─* test_questions *─1 questions ; tests 1─* test_schedules *─1 batches
test_schedules 1─* test_attempts 1─* test_answers 0─1 submissions
student_profiles 1─* submissions 1─* submission_results *─1 test_cases

projects 1─* project_submissions 1─* project_reviews
certificate_templates 1─* certificates *─1 student_profiles
feedback_forms 1─* feedback_responses
companies 1─* placement_drives 1─* drive_applications 1─* application_events ; drive_applications 0─1 offers
companies 1─* company_kits 1─* kit_items
student_profiles 1─* student_skills / resumes / documents ; users 1─* notifications / bookmarks / sessions
student_profiles 1─* points_ledger ; 1─1 streaks
users 1─* ai_conversations 1─* ai_messages ; users 1─* ai_usage
users 1─* audit_logs (actor) ; users 1─* activity_events
```

### 14.4 Audit and retention policy (preliminary)

| Data | Retention | Notes |
|---|---|---|
| Audit logs | 3 years minimum | Append-only; exportable |
| Activity events | 2 years raw, aggregates indefinitely | Partitioned |
| Submissions and attempts | Life of the student record | Needed for disputes and analytics |
| AI conversations | 90 days (configurable) | Usage aggregates kept |
| Exports | 7 days | Auto-deleted |
| Personal data after erasure request | Anonymised within 30 days | Aggregates retained without identifiers |

---

## 15. API Architecture

### 15.1 Conventions

| Topic | Convention |
|---|---|
| Base path and versioning | `https://api.example.com/api/v1/...`; version in the path; breaking changes produce `/v2` with a deprecation window; additive changes are unversioned. |
| Style | Resource-oriented REST; nouns plural; nested resources at most two levels (`/batches/{id}/members`); actions as sub-resources (`POST /tests/{id}/release`). |
| Authentication | `Authorization: Bearer <access JWT>` for API clients; browser uses httpOnly cookie plus `X-CSRF-Token` header on mutations. |
| Identifiers | UUID v7 strings; public codes where humans need them (student code, drive code, certificate code). |
| Request/response | JSON (`application/json`); dates ISO 8601 UTC; money as integer paise/INR with currency; enums as lowercase snake_case strings. |
| Pagination | Offset pagination for admin tables (`?page=1&pageSize=25`, max 100) returning `{ data, meta: { page, pageSize, total } }`; cursor pagination for feeds (`?cursor=…&limit=…`) returning `{ data, meta: { nextCursor } }`. |
| Filtering | Query parameters per field (`?status=active&batchId=…`), ranges with suffixes (`?startsAtFrom=…&startsAtTo=…`), free text `?q=`. Unknown filters rejected with 400. |
| Sorting | `?sort=-createdAt,name` (leading `-` for descending); allowed fields whitelisted per endpoint. |
| Field selection | `?include=batch,trainer` for related objects on detail endpoints; no arbitrary GraphQL-like expansion. |
| Errors | RFC 9457 problem details: `{ type, title, status, detail, instance, errors?: [{ path, message, code }], requestId }`; standard codes 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (state/idempotency), 422 domain rule, 429 rate limited (with `Retry-After`), 500 with request ID. |
| Idempotency | `Idempotency-Key` header on POST submissions/applications/imports; server stores the key for 24 h. |
| Rate limits | Per user and per IP buckets (default 600 requests/5 min per user; login 5/15 min; execution per §10.4); headers `RateLimit-Limit/Remaining/Reset`. |
| Documentation | OpenAPI 3.1 generated from code with examples; served at `/api/docs` (staging and internal only); client SDK generated in CI. |
| Real-time | WebSocket namespace `/ws` (notifications, submission status, test monitor) and SSE endpoints for simple streams (`/submissions/{id}/events`, AI message streaming). |
| Health | `/health/live`, `/health/ready` (checks DB, Redis, storage, execution reachability). |

### 15.2 Endpoint groups

| Group | Base | Representative endpoints (method — purpose — role) |
|---|---|---|
| Auth | `/auth` | POST `/login` (email/password) — All; POST `/refresh`; POST `/logout`; POST `/logout-all`; POST `/invitations/{token}/accept`; POST `/password/forgot`; POST `/password/reset`; POST `/email/verify`; POST `/otp/send`, `/otp/verify` (Standard); GET `/sessions`; DELETE `/sessions/{id}` |
| Me | `/me` | GET `/me` (identity, roles, permissions, flags); GET `/me/dashboard`; GET `/me/schedule`; GET `/me/courses`; GET `/me/assignments`; GET `/me/tests`; GET `/me/progress`; GET `/me/attendance`; GET `/me/notifications`; PATCH `/me/notifications/{id}/read`; GET/PATCH `/me/notification-preferences`; GET/PATCH `/me/profile`, `/me/profile/{section}`; GET/POST `/me/resumes`; POST `/me/resumes/generate`; GET/POST `/me/documents`; GET `/me/certificates`; GET `/me/drives`; GET `/me/applications`; GET `/me/bookmarks`; GET `/me/gamification`; GET `/me/events` |
| Users | `/users` | GET (list, Admin); POST (create/invite); GET `/{id}`; PATCH `/{id}`; POST `/{id}/deactivate`; POST `/{id}/reactivate`; PUT `/{id}/roles`; POST `/{id}/password-reset` |
| Students | `/students` | GET (filters: batch, status, program, verification, q); POST; POST `/import` (job); GET `/import/{jobId}`; GET `/{id}`; PATCH `/{id}`; POST `/{id}/status`; GET `/{id}/progress`; GET `/{id}/attendance`; GET `/{id}/submissions`; POST `/{id}/documents/{docId}/verify`; POST `/{id}/notes` |
| Trainers | `/trainers` | GET; POST; GET `/{id}`; PATCH `/{id}`; PUT `/{id}/batches` |
| Programmes & batches | `/programs`, `/batches` | CRUD; POST `/batches/{id}/members` (add), DELETE `/batches/{id}/members/{studentId}` (leave with reason), POST `/batches/{id}/members/transfer`; PUT `/batches/{id}/trainers`; GET/PUT `/batches/{id}/timetable`; GET `/batches/{id}/publications`; POST `/batches/{id}/status`; GET `/batches/{id}/reports/{name}` |
| Courses | `/courses`, `/lessons` | GET `/courses` (staff list), POST, GET `/{id}`, PATCH, PUT `/{id}/outline`, POST `/{id}/publish`, POST `/{id}/unpublish`, GET `/{id}/progress` (own), GET `/lessons/{id}`, POST `/lessons/{id}/progress`, POST `/lessons/{id}/complete`, GET `/courses/{id}/discussions` (Standard) |
| Files & video | `/files`, `/videos` | POST `/files/uploads` (presign), POST `/files/uploads/{id}/complete`, GET `/files/{id}`, GET `/files/{id}/url`, DELETE `/files/{id}`; POST `/videos` (create with provider), GET `/videos/{id}/status`, GET `/videos/{id}/playback` (signed) |
| Live sessions | `/sessions` | GET (filters batch, trainer, range); POST (single/series); PATCH `/{id}`; POST `/{id}/status` (live/completed/cancelled); POST `/{id}/recording`; GET `/{id}/attendance`; PUT `/{id}/attendance`; GET `/{id}/qr` (Standard); POST `/attendance/checkin` (Standard) |
| Questions | `/questions` | GET (filters type, subject, topic, difficulty, company, status, q); POST; GET `/{id}`; PATCH `/{id}`; POST `/{id}/publish`; POST `/{id}/retire`; GET `/{id}/versions`; POST `/{id}/validate`; POST `/import`; GET `/export` |
| Assignments | `/assignments` | CRUD; POST `/{id}/publish` (batches, due); GET `/{id}/me` (student view); GET `/{id}/progress` (staff); POST `/questions/{id}/submissions` (answer/run/submit with context); GET `/submissions/{id}`; GET `/submissions/{id}/events` (SSE); POST `/submissions/{id}/grade` (descriptive) |
| Tests | `/tests`, `/attempts` | CRUD; PUT `/tests/{id}/structure`; POST `/tests/{id}/schedules`; PATCH `/schedules/{id}`; POST `/tests/{id}/attempts` (start; returns attempt with deadline); GET `/attempts/{id}/state`; GET `/attempts/{id}/sections/{sid}/questions`; PATCH `/attempts/{id}/answers` (upsert batch); POST `/attempts/{id}/submit`; POST `/attempts/{id}/events` (integrity); GET `/attempts/{id}/result`; GET `/tests/{id}/monitor`; GET `/tests/{id}/results`; POST `/tests/{id}/release`; PATCH `/attempts/{id}/answers/{answerId}/grade`; GET `/tests/{id}/analytics` |
| Practice & execution | `/practice`, `/execute` | GET `/practice/summary`; GET `/practice/problems` (type, topic, difficulty, company, status); GET `/practice/problems/{slug}`; POST `/practice/problems/{id}/submissions` (mode run/submit); GET `/practice/problems/{id}/submissions` (own history); POST `/execute` (playground); GET `/languages`; GET `/admin/execution/stats` |
| Projects | `/projects` | CRUD; POST `/{id}/publish`; GET `/{id}/submissions`; POST `/{id}/submissions`; PATCH `/project-submissions/{id}/review` |
| Certificates | `/certificates`, `/public/certificates` | GET (list, filters); POST (manual issue); POST `/{id}/revoke`; GET `/templates`; POST/PATCH `/templates/{id}`; GET `/public/certificates/{code}` |
| Feedback | `/feedback-forms`, `/feedback` | CRUD forms; POST `/feedback-forms/{id}/schedule`; POST `/feedback/{formId}/responses`; GET `/feedback-forms/{id}/results` |
| Placement | `/companies`, `/drives`, `/applications`, `/kits` | CRUD companies; CRUD drives; POST `/drives/{id}/publish`, `/close`; GET `/drives/{id}/eligible-students`; POST `/drives/{id}/shortlist`; POST `/drives/{id}/applications` (student apply); PATCH `/applications/{id}/stage`; POST `/applications/{id}/withdraw`; POST `/applications/{id}/offer`; PATCH `/offers/{id}` (accept/decline/join); CRUD kits; GET `/companies/{id}/kit` (student) |
| Notifications & announcements | `/notifications`, `/announcements` | POST `/notifications/broadcast` (staff, audience); CRUD announcements |
| Reports & exports | `/reports`, `/exports` | GET `/reports/dashboard` (filters); GET `/reports/{students|attendance|progress|assessments|assignments|projects|trainers|placements|certificates|feedback}`; POST `/exports` (report, params, format); GET `/exports`; GET `/exports/{id}`; GET `/exports/{id}/download`; CRUD `/reports/schedules` (Standard) |
| Search | `/search` | GET `?q=&types=` |
| Gamification | `/leaderboards` | GET `/leaderboards/{scope}` (batch/overall) |
| AI | `/ai` | POST `/conversations`; POST `/conversations/{id}/messages` (SSE stream); GET `/conversations`; POST `/interviews`; POST `/interviews/{id}/turns`; GET `/interviews/{id}/report`; GET `/usage`; GET/PATCH `/admin/ai/settings` |
| Doubts & events | `/doubts`, `/events` | POST `/doubts`; GET `/doubts` (scope); POST `/doubts/{id}/answers`; POST `/doubts/{id}/status`; CRUD `/events`; POST `/events/{id}/register` |
| Administration | `/settings`, `/roles`, `/flags`, `/templates`, `/integrations`, `/audit-logs`, `/privacy-requests`, `/admin/health` | GET/PATCH settings and branding; CRUD roles and permissions matrix; flags; email templates; integrations (write-only secrets, test); audit log queries; privacy request processing; health/queue stats; POST `/admin/jobs/{id}/retry` |

### 15.3 Representative endpoint specifications

**POST `/api/v1/auth/login`** — Sign in (All). Request: `{ "email": "string", "password": "string", "rememberMe": boolean }`. Response 200: `{ "user": { id, name, roles }, "accessToken": "…", "expiresIn": 900 }` plus `Set-Cookie: refresh_token=…; HttpOnly; Secure; SameSite=Lax`. Validation: email format, password 1–128 chars. Errors: 400 validation; 401 `invalid_credentials` (generic); 423 `account_locked`; 429 too many attempts.

**POST `/api/v1/students/import`** — Bulk import (users:import). Multipart: `file` (CSV/XLSX ≤ 5 MB, ≤ 5,000 rows), fields `batchId?`, `sendInvites` (bool), `dryRun` (bool). Response 202: `{ "jobId": "…" }`; GET `/students/import/{jobId}` → `{ status: queued|running|completed|failed, processed, created, skipped, errors: [{ row, field, message }], reportFileId }`. Errors: 400 bad file; 409 job already running for same file hash; 413 too large.

**POST `/api/v1/batches/{batchId}/timetable`** — Create session series (sessions:manage, scope batch). Request: `{ "subject": "Core Java", "trainerId": "…", "startsAt": "2026-10-01T04:30:00Z", "endsAt": "2026-10-01T06:00:00Z", "recurrence": { "freq": "weekly", "byDay": ["MO","TU","WE","TH","FR"], "until": "2026-12-20" }, "joinUrl": "https://…", "provider": "zoom", "skipDates": ["2026-10-02"] }`. Response 201: `{ seriesId, occurrences: 57, conflicts: [] }`. Validation: end after start; trainer assigned to batch; until ≤ batch end + 30 days. Errors: 409 trainer conflict (with list); 422 batch not running/planned.

**PUT `/api/v1/sessions/{sessionId}/attendance`** — Mark attendance (attendance:mark, scope batch). Request: `{ "records": [{ "studentId": "…", "status": "present|absent|late|excused" }], "reason": "string (required when correcting)" }`. Response 200: `{ marked: 40, corrected: 2 }`. Errors: 403 not the session trainer; 409 correction window closed; 422 session not completed.

**POST `/api/v1/questions/{questionId}/submissions`** — Submit or run an answer (assignments:submit / practice:use, own). Headers: `Idempotency-Key`. Request: `{ "context": { "type": "assignment", "id": "…" }, "mode": "run|submit", "answer": { "type": "coding", "language": "java", "source": "…", "stdin": "…" } }` or `{ "answer": { "type": "mcq", "optionIds": ["…"] } }`. Response 202 (coding) `{ submissionId, status: "pending" }` or 200 (objective) `{ submissionId, status: "graded", verdict, score, maxScore, explanation? }`. Errors: 409 attempt limit/locked module; 422 unsupported language; 429 quota exceeded (Retry-After).

**GET `/api/v1/submissions/{id}`** — Submission state. Response: `{ id, status, verdict, score, maxScore, results: [{ testCaseId?, isSample, verdict, timeMs, memoryKb, stdoutExcerpt?, expectedExcerpt? (samples only), stderrExcerpt? }], compileOutput?, createdAt, gradedAt }`. Hidden test inputs and outputs are never included.

**POST `/api/v1/tests/{testId}/attempts`** — Start an attempt (tests:attempt). Request: `{ "scheduleId": "…" }`. Response 201: `{ attemptId, startedAt, deadlineAt, serverTime, sections: [{ id, title, questionCount }] }`. Errors: 409 active attempt exists (returns it); 422 outside window or attempts exhausted.

**PATCH `/api/v1/attempts/{attemptId}/answers`** — Autosave answers (own, in progress). Request: `{ "answers": [{ "testQuestionId": "…", "answer": {…}, "flagged": false, "clientSavedAt": "…" }] }`. Response 200: `{ saved: 3, serverTime, deadlineAt }`. Errors: 409 attempt not in progress; 410 deadline passed (grace 30 s).

**POST `/api/v1/drives`** — Create drive (drives:manage). Request: `{ companyId, title, description, type, locations: [], packageMin, packageMax, openings, eligibility: { passingYears: [2026], degrees: ["BE","B.Tech"], minAttendancePct: 75, minTestAvgPct: 60, skills: [] }, rounds: [{ name, type }], deadlineAt, visibility: { batchIds: [] } }`. Response 201 drive. Validation: deadline in future; packages ≥ 0; eligibility schema.

**GET `/api/v1/reports/dashboard?from=&to=&programId=&batchId=&courseId=&trainerId=`** — Admin metrics (reports:read, scoped). Response: `{ asOf, filters, metrics: { totalStudents, activeStudents7d, activeStudents30d, batchWise: [...], courseWise: [...], attendancePct, completionPct, assessmentScores: {...}, assignmentStatus: {...}, projectStatus: {...}, trainerPerformance: [...] (Admin only), placementStatus: {...}, companyWisePlacements: [...], certificatesIssued, feedback: {...} }, definitions: {...} }`.

**POST `/api/v1/exports`** — Request export (reports:export). Request: `{ report: "attendance", params: {...}, format: "xlsx|csv|pdf" }`. Response 202 `{ exportId }`; notification on completion; GET `/exports/{id}/download` returns a presigned URL (expires 7 days).

### 15.4 Client SDK and contract testing

The OpenAPI document is the contract: the web app's client is generated from it in CI; contract tests verify every documented response schema against a running API with seed data; breaking changes fail CI unless the version is bumped.

---
