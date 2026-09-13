### F-13 Attendance

1. **What.** Roll-call marking, statuses, corrections with audit, QR self check-in (Standard), online-join auto-marking (Advanced), thresholds and alerts, student and admin views, per-subject filters.
2. **Why.** Client metric; dropout signal; eligibility criterion.
3. **Who.** Trainer, Student, Admin.
4. **Interaction.** Card R-05.
5. **Backend.** One record per (session, student); default generation at session end; corrections within window with reason; percentage computation; weekly threshold job; QR: rotating one-time codes (30 s) bound to session and location-free.
6. **Frontend.** Fast marking UI (P-D04); student calendar; admin reports.
7. **Entities.** E-24 attendance_records, E-22 live_sessions.
8. **APIs.** `/sessions/{id}/attendance`, `/me/attendance`, `/reports/attendance`, `/sessions/{id}/qr` (Standard), `/attendance/checkin` (Standard).
9. **Validation.** Session must be started/completed; status enum; reason required for corrections.
10. **Security.** Only assigned trainer/admin; audit; QR codes single-use.
11. **Failure cases.** Trainer forgets → reminder 1 h after session end and "unmarked sessions" list; conflicting corrections → last write wins with full history.
12. **Testing.** Formula tests; window tests; QR replay tests.
13. **Done when.** AC-05.1–05.3 pass; attendance appears on dashboards.

### F-14 Progress and activity tracking

1. **What.** Activity event log (login, lesson progress, submission, test, project) and derived progress: lesson/module/course completion, assignment progress, test participation, overall progress, "active" flags, skills derived from performance (Standard).
2. **Why.** Single source for every progress number (D-03) and for "Active Students".
3. **Who.** System; consumed by all dashboards.
4. **Interaction.** Invisible; surfaced in dashboards, profile and reports.
5. **Backend.** Append-only `activity_events`; projections updated synchronously for the acting user and asynchronously for aggregates (per batch/course); overall progress formula configurable (default: courses 40%, assignments 40%, tests 20%).
6. **Frontend.** Progress components read one API.
7. **Entities.** E-20 lesson_progress, E-21 activity_events, E-54 student_skills.
8. **APIs.** `/me/progress`, `/students/{id}/progress`, `/reports/progress`.
9. **Validation.** Event schema per type; idempotency keys for client-sent events.
10. **Security.** Students see only their own; aggregates anonymised where required.
11. **Failure cases.** Projection lag → "updated N minutes ago" labels; rebuild command for projections.
12. **Testing.** Formula fixtures; replay/rebuild tests.
13. **Done when.** All progress numbers across pages come from this module and agree.

### F-15 Projects (Standard)

1. **What.** Project briefs with rubric and milestones, batch publication, submissions (repo/demo/zip), reviews, statuses, profile display.
2. **Why.** Client requirement; portfolio value; "Project Status" metric.
3. **Who.** Trainer/Admin, Student.
4. **Interaction.** Card R-09.
5. **Backend.** Project, submission, review entities; state machine; rubric scoring; notifications.
6. **Frontend.** Brief page, submission form, review UI.
7. **Entities.** E-41 projects, E-42 project_submissions, E-43 project_reviews.
8. **APIs.** `/projects`, `/projects/{id}/publish`, `/projects/{id}/submissions`, `/project-submissions/{id}/review`.
9. **Validation.** URLs valid; zip ≤ 50 MB; one active submission per student per project (resubmission creates a new version).
10. **Security.** Files private; links opened in new tab with warning (external).
11. **Failure cases.** Deadline passed → late submission allowed if configured, flagged.
12. **Testing.** State machine; rubric totals; E2E submit/review.
13. **Done when.** AC-09.1–09.2 pass.

### F-16 Certificates (Standard)

1. **What.** Templates, issuance rules, PDF generation, verification code and page, manual issue/revoke, student download and share.
2. **Why.** Client requirement (CR-S10, CR-A13).
3. **Who.** Admin, Student, public verifier.
4. **Interaction.** Card R-10.
5. **Backend.** Rule evaluation job on completion events; PDF rendering worker (HTML template → PDF via headless Chromium); unique code (e.g. 12-char base32) stored with hash; storage in private bucket with presigned download; public verification endpoint rate-limited.
6. **Frontend.** Template designer (limited: logo, colours, signatory, text blocks); student certificate cards.
7. **Entities.** E-44 certificate_templates, E-45 certificates.
8. **APIs.** `/certificates`, `/certificates/{id}/revoke`, `/me/certificates`, `/public/certificates/{code}`.
9. **Validation.** Rule thresholds; template variables.
10. **Security.** Unguessable codes; revocation; no personal data beyond name/course on the public page.
11. **Failure cases.** Rendering failure → retry, alert; rule change → no retroactive revocation without admin action.
12. **Testing.** Rule engine fixtures; PDF snapshot tests; verification endpoint tests.
13. **Done when.** AC-10.1–10.3 pass.

### F-17 Placement management (Standard)

1. **What.** Companies, contacts, drives with eligibility rules, applications pipeline, interviews, offers, joining, company kits, guidance content, readiness filters, placement reports, student drive board and tracker.
2. **Why.** Client metrics CR-A11/A12; CR-S23/S24; the institute's placement promise.
3. **Who.** Placement Coordinator, Student, Admin (reports).
4. **Interaction.** Card R-11.
5. **Backend.** Eligibility rule engine (JSON rules: passing year, degree, min attendance, min test average, skills, batch); application state machine with events; offer records; kit items referencing files/questions; aggregates for funnel and company-wise reports; notifications at every stage change.
6. **Frontend.** Pipeline board (drag between stages), applicant drawer, rules builder, student board with eligibility badges.
7. **Entities.** E-48 companies, E-49 placement_drives, E-50 drive_applications, E-51 application_events, E-52 offers, E-53 company_kits.
8. **APIs.** `/companies`, `/drives`, `/drives/{id}/publish`, `/drives/{id}/eligible-students`, `/drives/{id}/applications`, `/applications/{id}/stage`, `/applications/{id}/offer`, `/kits`, `/me/drives`, `/me/applications`, `/reports/placements`.
9. **Validation.** Deadline in future at publish; eligibility rules valid; one application per student per drive; offer requires stage ≥ interviewed.
10. **Security.** Placement data restricted; resumes snapshot at application time; audit of stage changes.
11. **Failure cases.** Student becomes ineligible after applying → flagged, not auto-withdrawn; drive closed with open applications → bulk status "closed".
12. **Testing.** Rule engine fixtures; state machine; funnel report correctness.
13. **Done when.** AC-11.1–11.3 pass; placement dashboard live.

### F-18 Feedback (Standard)

1. **What.** Form builder (rating, multiple choice, text), targets (session, course, trainer, batch), schedules (after each session, weekly, end of course), anonymity option, reminders, aggregates, exports.
2. **Why.** CR-A14; trainer performance input.
3. **Who.** Admin (manage), Student (respond), Trainer (own aggregates).
4. **Interaction.** Card R-13.
5. **Backend.** Form definitions (JSON), response storage with optional anonymisation (no user id stored, a per-form token prevents duplicates), aggregation job.
6. **Frontend.** Builder; response form; charts.
7. **Entities.** E-46 feedback_forms, E-47 feedback_responses.
8. **APIs.** `/feedback-forms`, `/feedback-forms/{id}/schedule`, `/feedback/{formId}/responses`, `/reports/feedback`.
9. **Validation.** Required questions; rating ranges.
10. **Security.** Anonymity guaranteed at storage level; small-group suppression (aggregates hidden when < 5 responses).
11. **Failure cases.** Duplicate submission blocked by token.
12. **Testing.** Anonymity tests; aggregation fixtures.
13. **Done when.** AC-13.1–13.2 pass.

### F-19 Reports, exports and admin dashboard

1. **What.** All 15 metrics; detailed report pages; exports (CSV/XLSX in MVP, PDF in Standard); scheduled reports (Standard); definitions drawer; scoped views for trainers and placement.
2. **Why.** CR-A01–A15.
3. **Who.** Admin, Super Admin, Trainer (scoped), Placement (scoped).
4. **Interaction.** Card R-01.
5. **Backend.** Read models: nightly and on-demand aggregation tables (`agg_batch_daily`, `agg_course_progress`, `agg_test_scores`, …) plus live queries for small scopes; export jobs stream rows to XLSX (exceljs) or CSV; PDF via headless Chromium from a print layout; scheduled reports via cron jobs and email.
6. **Frontend.** Dashboard tiles/charts (Recharts or ECharts), report tables (TanStack Table) with server pagination, export buttons, job status toasts.
7. **Entities.** E-69 report_exports plus aggregate tables.
8. **APIs.** `/reports/dashboard`, `/reports/{name}`, `/exports`, `/exports/{id}`, `/reports/schedules`.
9. **Validation.** Filter bounds; export caps.
10. **Security.** Scope enforced in queries; exports audited and expiring; PII minimised in exports (configurable columns).
11. **Failure cases.** Aggregation job failure → stale-data banner and alert; export failure → retry and notification.
12. **Testing.** Metric definition tests against fixtures; export row-count tests; scope tests.
13. **Done when.** AC-01.1–01.4 pass; all 15 metrics documented and exportable.

### F-20 Notifications and announcements

1. **What.** In-app notification centre with unread badge and real-time updates; email delivery with templates and digests; preferences; announcements/banners with audience and schedule; optional SMS/WhatsApp/push adapters.
2. **Why.** IR-18; reminders drive attendance and deadlines.
3. **Who.** All.
4. **Interaction.** Bell → list → open target; announcements at top of dashboard; preferences page.
5. **Backend.** Notification service with channel adapters; templates; batching/digest job; WebSocket (or SSE) push; announcement targeting.
6. **Frontend.** Bell dropdown and page; toast for real-time; announcement cards.
7. **Entities.** E-57 notifications, E-58 notification_preferences, E-59 announcements.
8. **APIs.** `/me/notifications`, `/me/notifications/{id}/read`, `/me/notification-preferences`, `/announcements`, `/notifications/broadcast`.
9. **Validation.** Audience must be within sender scope; schedule windows.
10. **Security.** No sensitive content in emails/SMS beyond necessity; unsubscribe for non-critical emails.
11. **Failure cases.** Provider failure → retry with backoff, dead-letter queue, admin alert.
12. **Testing.** Template rendering; preference honouring; delivery integration in staging (mail catcher locally).
13. **Done when.** AC-15.1–15.2 pass.

### F-21 Student profile, resumes and portfolio

1. **What.** Multi-section profile, documents and verification, declared skills, resumes (upload, default, generate from profile in Standard), completeness score, public portfolio (Advanced).
2. **Why.** CR-S29–S33, CR-S21, CR-S22; placement readiness.
3. **Who.** Student, Admin/Placement (verify, read).
4. **Interaction.** Card R-12.
5. **Backend.** Profile sections as typed JSON columns validated per section; documents with verification workflow; resume generation as PDF job from templates; completeness rules; portfolio visibility flags.
6. **Frontend.** Section forms with autosave drafts; resume manager; portfolio page.
7. **Entities.** E-08 student_profiles, E-54 student_skills, E-55 resumes, E-56 documents.
8. **APIs.** `/me/profile`, `/me/profile/{section}`, `/me/resumes`, `/me/resumes/generate`, `/me/documents`, `/students/{id}/documents/{docId}/verify`, `/public/portfolios/{slug}`.
9. **Validation.** Field-level (phone formats, URLs, dates); document types; resume limits.
10. **Security.** Sensitive fields gated; consent text; portfolio shows only opted-in fields; erasure support.
11. **Failure cases.** Document rejected → reason and re-upload; generation failure → retry.
12. **Testing.** Section validation; completeness; verification workflow; portfolio visibility.
13. **Done when.** AC-12.1–12.3 pass.

### F-22 Gamification (Standard)

1. **What.** Points for solved questions/tests/attendance (weights configurable), daily practice streaks with calendar heat-map, batch and overall leaderboards (opt-in display name, can be disabled), badges for milestones, share cards.
2. **Why.** Present in reference; daily practice habit (O-2).
3. **Who.** Student; Admin configures.
4. **Interaction.** Dashboard widgets; leaderboard page; badge notifications.
5. **Backend.** Points ledger (append-only), streak calculation in IST day boundaries, leaderboard snapshots (daily) to avoid heavy queries.
6. **Frontend.** Heat-map, ranks, badges.
7. **Entities.** E-61 points_ledger, E-62 streaks.
8. **APIs.** `/me/gamification`, `/leaderboards/{scope}`.
9. **Validation.** Points only from server-side events.
10. **Security.** Display names only; opt-out honoured; anti-gaming (points for first correct submission only).
11. **Failure cases.** Snapshot job failure → last snapshot shown with timestamp.
12. **Testing.** Ledger and streak fixtures across day boundaries.
13. **Done when.** Widgets live, configurable, opt-out works.

### F-23 AI learning assistant (Advanced)

1. **What.** Chat assistant with modes: explain this lesson, clarify a doubt, hint for my failed submission (no full solutions when policy says so), quiz me, generate practice questions (SQL/coding) for review, aptitude help; grounded in lesson transcript/notes and the current problem; per-student quotas; escalation to human doubt queue; usage and cost reporting.
2. **Why.** CR-S25–S27; support load reduction; 24/7 help.
3. **Who.** Student; Admin monitors usage and cost.
4. **Interaction.** Assistant page or contextual "Ask" buttons inside lesson and problem pages → streamed answers → feedback thumbs → escalate.
5. **Backend.** `ai` module using the Anthropic SDK: system prompt with institute policy, context assembly (lesson text, problem statement, student's code and failing test summary — never hidden tests), streaming responses, conversation storage, quotas in Redis, cost accounting from usage fields, prompt caching for stable system/context prefixes, model configurable per mode (default `claude-opus-5`; a cheaper model such as `claude-sonnet-5` selectable per mode by the client after evaluation), safety: refusal handling and fallbacks, content filters for off-topic use.
6. **Frontend.** Chat UI with streaming, code rendering, context chips, quota meter.
7. **Entities.** E-63 ai_conversations, E-64 ai_messages, E-65 ai_usage.
8. **APIs.** `/ai/conversations`, `/ai/conversations/{id}/messages` (SSE), `/ai/usage`, `/admin/ai/settings`.
9. **Validation.** Message length; mode allowed; quota.
10. **Security.** API key server-side only; no personal data in prompts beyond first name; logs retained per policy; feature flag; per-batch enablement; prompt-injection hardening (student content is data, not instructions).
11. **Failure cases.** Provider error/timeout → retry once, then friendly message; quota exceeded → message with reset time; refusal → suggest escalation.
12. **Testing.** Prompt regression suite with recorded fixtures; quota tests; cost accounting tests; red-team tests for solution leakage.
13. **Done when.** AC-14.1–14.4 pass; cost dashboard live; client accepts answer quality on an evaluation set.

### F-24 AI mock interviews (Advanced)

1. **What.** Text-based mock interview sessions (role, topics, difficulty, duration) with adaptive questions, follow-ups, and a final report (rubric scores: communication, correctness, depth; strengths; improvements; suggested resources). Voice is Future.
2. **Why.** CR-S20/S28; placement readiness.
3. **Who.** Student; Placement (aggregate readiness, optional).
4. **Interaction.** Setup → timed conversation → report → history on profile.
5. **Backend.** Same `ai` module; interview state machine; structured output for the report; quotas (e.g. 2 per week).
6. **Frontend.** Interview UI with timer and turn indicator; report page.
7. **Entities.** E-63/E-64 with `type=interview`, E-65.
8. **APIs.** `/ai/interviews`, `/ai/interviews/{id}/turns`, `/ai/interviews/{id}/report`.
9. **Validation.** Duration ≤ 45 min; topics from catalogue.
10. **Security.** As F-23; reports visible to the student and, if the student opts in, to placement staff.
11. **Failure cases.** Interrupted session → resume within 24 h or auto-close with partial report.
12. **Testing.** Scenario fixtures; report schema validation.
13. **Done when.** Client accepts quality on sample interviews; quotas and costs enforced.

### F-25 Global search

1. **What.** Search across courses, lessons, questions, drives, companies and (for staff) students; scoped results; keyboard shortcut.
2. **Why.** IR-19; large content sets.
3. **Backend.** PostgreSQL full-text search (tsvector with weights) in MVP; upgrade path to Meilisearch/OpenSearch if needed.
4. **Frontend.** Command palette style dialog and results page.
5. **Entities.** Search indexes (generated columns) on existing tables.
6. **APIs.** `/search?q=&types=`.
7. **Validation.** Query length 2–100.
8. **Security.** Results filtered by permission and scope at query time.
9. **Failure cases.** Slow query → limit and timeout with partial results.
10. **Testing.** Scope tests; relevance smoke tests.
11. **Done when.** Search returns only permitted items with p95 < 300 ms on seed data.

### F-26 System administration

1. **What.** Settings, branding, roles, integrations (write-only secrets), feature flags, email templates, audit log viewer, privacy requests, system health.
2. **Why.** IR-21, IR-22, IR-24.
3. **Who.** Super Admin (all), Admin (read some).
4. **Backend.** Settings table with typed keys and cache; secrets encrypted at rest with a KMS/key from environment; flag evaluation service; audit log middleware; health endpoints aggregating queue/storage/integration checks; privacy jobs (export bundle, anonymisation).
5. **Frontend.** Settings pages (P-I01–I09).
6. **Entities.** E-66 audit_logs, E-67 settings, E-68 feature_flags.
7. **APIs.** `/settings`, `/settings/branding`, `/integrations/{provider}`, `/flags`, `/templates`, `/audit-logs`, `/privacy-requests`, `/admin/health`.
8. **Validation.** Typed settings; template variables.
9. **Security.** Secrets never returned; all changes audited; two-person rule optional for role changes (Future).
10. **Failure cases.** Integration test failure → shown with provider error; flag service down → defaults from code.
11. **Testing.** Settings typing; flag evaluation; audit coverage test (every mutation endpoint produces an audit row).
12. **Done when.** Operations can run without code changes for the listed settings.

### F-27 Doubt queue (Standard)

1. **What.** Students raise doubts with context (lesson/question auto-attached); trainers of the batch answer; statuses; FAQ conversion; response-time metrics; AI escalation target.
2. **Why.** CR-S26 without AI cost; trainer–student loop.
3. **Backend.** Doubt entity with thread; notifications; metrics.
4. **Frontend.** P-C32, P-D09.
5. **Entities.** E-71 doubts.
6. **APIs.** `/doubts`, `/doubts/{id}/answers`, `/doubts/{id}/status`.
7. **Security.** Batch scope; attachments private.
8. **Done when.** Doubt raised, answered, resolved, and metrics visible.

### F-28 Events (Standard)

1. **What.** Webinars and workshops outside batch timetables: audience, registration, join link, recording, attendance; progress shown on student dashboard (CR-S03).
2. **Backend.** Reuses session machinery with `type=event` and registrations.
3. **Entities.** E-70 events (or sessions with type), registrations.
4. **APIs.** `/events`, `/events/{id}/register`, `/me/events`.
5. **Done when.** An event can be created, registered for, attended and reported.

---
