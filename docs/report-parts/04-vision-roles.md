## 6. Product Vision and Scope

### 6.1 Vision

> One platform on which a training institute runs every batch from enrolment to placement — where students learn, practise and prove their skills daily; trainers teach, track and grade without spreadsheets; the placement team turns readiness data into offers; and management sees the truth of the business in one dashboard.

### 6.2 Product objectives (measurable)

| # | Objective | Target (first 6 months after launch) |
|---|---|---|
| O-1 | Replace spreadsheets, WhatsApp and form tools for batch operations | 100% of active batches managed in the platform; attendance and tests recorded only in the platform |
| O-2 | Make daily practice a habit | ≥ 60% of active students practise ≥ 4 days/week (streak data) |
| O-3 | Give students a clear "what next" | Dashboard-to-first-action in ≤ 2 clicks; support tickets about "where is X" < 5/week |
| O-4 | Give management trustworthy metrics | All 15 admin metrics live with documented definitions; exports match source data 100% |
| O-5 | Support placement outcomes | Every drive, application and offer recorded; placement funnel report used weekly |
| O-6 | Operate cheaply and safely | Infrastructure ≤ a few hundred USD/month at 5,000 students (see §20); zero code-execution security incidents |
| O-7 | Stay maintainable | New developer productive within 2 days using docs and Docker setup; CI green on every merge |

### 6.3 Target users (personas)

| Persona | Description | Primary goals | Devices |
|---|---|---|---|
| **Student** (majority) | 18–26, graduate/final-year, learning Java/Python full-stack or data programmes in a batch of 30–200; often on a phone with limited data; motivated by placement. | Attend classes, watch recordings, practise daily, do well in weekly tests, get placed. | Android phone first; laptop for coding. |
| **Trainer** | Subject expert teaching 1–3 batches; runs live classes; wants minimal admin. | See today's schedule, mark attendance in seconds, publish assignments, grade quickly, spot struggling students. | Laptop; phone for attendance. |
| **Admin / Operations** | Institute operations staff; creates batches, onboards students, manages content and timetable, answers escalations. | Bulk onboarding, timetable management, content publishing, reports. | Laptop. |
| **Placement Coordinator** | Sources companies and drives; manages applications, interviews and offers; prepares students. | Publish drives, filter eligible students, track pipeline, report placements. | Laptop. |
| **Founder / Management** | Owns the business; wants the numbers. | Dashboard, exports, trends, trainer and placement performance. | Laptop, phone. |
| **Super Admin** | Technical owner; configures system. | Roles, integrations, flags, audit, backups. | Laptop. |

### 6.4 Business goals

- Increase student outcomes (completion, scores, placements) through structured daily practice and visibility.
- Reduce operational cost per batch (automation of onboarding, attendance, grading, reporting).
- Own the data and the student experience; build a defensible asset (content, question banks, company kits, placement network).
- Present a modern, professional product to students and hiring partners.

### 6.5 Core problems being solved

1. Fragmented tooling and no single source of truth for student progress.
2. Manual attendance, grading and reporting consume trainer and admin time.
3. Students lack a structured, gamified daily practice loop tied to their curriculum.
4. Placement readiness is not measurable; eligibility is decided by hand.
5. Management cannot see completion, scores, attendance and placements together.

### 6.6 Application boundaries

**Inside the boundary.** Identity and roles; student/trainer/batch administration; course authoring and delivery; live-class scheduling with external meeting links; attendance; question bank; assignments; tests; code execution and labs; projects; progress and gamification; certificates; feedback; placement management and company kits; notifications; reports and exports; AI assistant (gated); system administration.

**Outside the boundary (integrations or other systems).** Video conferencing itself (Zoom/Meet host the call); video transcoding and CDN (hosted video provider); email/SMS delivery (providers); payment processing (if ever in scope, via gateway); marketing website and CRM (lead management is not an LMS concern); HR/payroll for trainers; accounting.

### 6.7 Canonical feature list

The following feature identifiers are used in every later section.

| ID | Feature | Tier | ID | Feature | Tier |
|---|---|---|---|---|---|
| F-01 | Authentication and sessions | MVP | F-15 | Projects | Standard |
| F-02 | Roles and permissions (RBAC) | MVP | F-16 | Certificates | Standard |
| F-03 | User and student management | MVP | F-17 | Placement management (companies, drives, applications, kits) | Standard |
| F-04 | Trainer management | MVP | F-18 | Feedback | Standard |
| F-05 | Batch management | MVP | F-19 | Reports, exports and admin dashboard | MVP (core) / Standard (full) |
| F-06 | Courses, modules, lessons (authoring, catalogue, player) | MVP | F-20 | Notifications and announcements | MVP |
| F-07 | Learning resources and file storage | MVP | F-21 | Student profile, resumes, portfolio | MVP (profile, uploads) / Standard (resume generator) / Advanced (public portfolio) |
| F-08 | Live sessions and schedule | MVP | F-22 | Gamification (points, streaks, leaderboards, badges) | Standard |
| F-09 | Question bank | MVP | F-23 | AI learning assistant (doubts, hints, quizzes) | Advanced |
| F-10 | Assignments | MVP | F-24 | AI mock interviews | Advanced |
| F-11 | Tests and assessments | MVP | F-25 | Global search | MVP (basic) |
| F-12 | Code execution service and labs (F-12a Code Practice, F-12b Debug Challenges, F-12c Playground, F-12d SQL Lab, F-12e Web Lab) | MVP (12a) / Standard (12b–e) | F-26 | System administration (settings, branding, flags, integrations, audit) | MVP |
| F-13 | Attendance | MVP | F-27 | Doubt queue (human Q&A) | Standard |
| F-14 | Progress and activity tracking | MVP | F-28 | Events (webinars, workshops) | Standard |

### 6.8 Scope by tier

**MVP (Phases 1–5 and core of 7).** F-01–F-11, F-12a, F-13, F-14, F-19 (core metrics, XLSX/CSV export), F-20 (in-app + email), F-21 (profile, documents, resume upload), F-25, F-26. Outcome: a batch can be run end to end and the founders can see the core numbers.

**Standard.** F-12b–e, F-15, F-16, F-17, F-18, F-19 (all 15 metrics, PDF and scheduled reports), F-21 (resume generator, derived skills), F-22, F-27, F-28, OTP login, live-tool API integration (optional), QR attendance.

**Advanced.** F-23, F-24, public portfolio, advanced analytics (question analytics, cohort comparisons, at-risk prediction rules), test-integrity extras (browser lockdown prompts, tab-switch penalties), iCal/Google Calendar sync.

### 6.9 Out of scope (unless the client re-scopes)

Payments and fee management; marketing website and lead CRM; native iOS/Android apps; multi-institute tenancy; company/recruiter portal; proctoring with webcam; voice-based AI interviews; content marketplace; SCORM/xAPI import; offline desktop apps.

### 6.10 Future expansion opportunities

Company portal for hiring partners; parent/guardian portal; alumni network and referrals; mobile apps (React Native) reusing the API; multi-tenant white-label offering to other institutes; adaptive learning paths; AI-generated question banks with trainer review; SCORM import; integrations with Slack/Discord communities; fee management with Razorpay.

### 6.11 Feature priority matrix (MoSCoW)

| Classification | Features | Reasoning |
|---|---|---|
| **Must Have** | F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12a, F-13, F-14, F-19 (core), F-20, F-21 (core), F-25, F-26 | Without these a batch cannot be run or reported on; every admin metric in the client list except projects/placements/certificates/feedback depends on them. |
| **Should Have** | F-12b, F-12c, F-12d, F-12e, F-15, F-16, F-17, F-18, F-19 (full), F-21 (generator), F-22, F-27, F-28 | Explicitly requested by the client and present in the reference, but a batch can start without them; they raise engagement, placement effectiveness and the remaining admin metrics. |
| **Could Have** | F-23, F-24, public portfolio, advanced analytics, calendar sync, native live-tool integration | Requested (AI) or valuable, but costly, dependent on budget decisions, and not required for the core learning loop. |
| **Not Planned** | Payments, recruiter portal, native apps, proctoring, multi-tenancy, marketplace | Not requested; would materially change the architecture or cost; recorded for the future. |

---

## 7. User Roles and Permissions

### 7.1 Role evaluation

| Candidate role | Needed? | Purpose | Tier | Reasoning |
|---|---|---|---|---|
| Super Admin | **Yes** | Technical ownership: roles, integrations, feature flags, audit log, backups, impersonation for support. | MVP | Separates dangerous system settings from day-to-day administration; 1–2 people. |
| Admin | **Yes** | Institute operations: users, batches, programmes, content publishing, timetables, reports, announcements. | MVP | The primary staff role. |
| Trainer / Instructor | **Yes** | Teach batches: schedule, attendance, assignments, grading, doubts, student view for own batches. | MVP | Implied by "Trainer Performance" and by live classes **[Q-06]**. |
| Student | **Yes** | Learn, practise, test, project, apply to drives, maintain profile. | MVP | Core user. |
| Placement Coordinator | **Yes** | Companies, drives, applications, offers, kits, readiness reports. | Standard (role seeded in MVP) | Implied by placement metrics; keeps sensitive placement data away from trainers **[Q-06]**. |
| Content Manager | **Yes, as a permission bundle** | Author courses and question banks without user/batch administration rights. | MVP (seeded) | Cheap to add because the model is permission-based; useful once content work is delegated. |
| Support Staff | **Not initially** | Read-only user lookup and issue triage. | Future | No support workflow is requested; Admin covers it; add later as a read-only bundle if a helpdesk emerges. |
| Company / Recruiter | **No** | External access to candidates. | Future | Not requested; adds external-user security surface. |
| Parent / Guardian | **No** | View student progress. | Future | Not requested. |

### 7.2 Role definitions

| Role | Responsibilities | Accessible modules | Allowed actions (summary) | Restricted actions | Data visibility |
|---|---|---|---|---|---|
| **Super Admin** | System configuration, security, compliance | Everything; System Administration | All Admin actions plus manage roles/permissions, integrations, feature flags, email templates, audit log, data-privacy requests, impersonate users (audited) | Cannot bypass audit logging; cannot delete audit records | All data |
| **Admin** | Run the institute | Admin portal, reports, content, placement (read) | Create/edit/deactivate users; import students; create batches/programmes; assign trainers; author and publish courses, questions, assignments, tests; manage schedule; announcements; issue certificates; run reports and exports; view feedback | Cannot change roles/permissions definitions, integrations or flags; cannot hard-delete students; cannot edit audit logs | All operational data; placement data read-only unless also Placement role |
| **Trainer** | Deliver and assess | Trainer portal | View own batches and students; mark/correct attendance for own sessions; author questions (if Content permission granted); create/publish assignments and tests to own batches (subject to admin approval setting); grade; review projects; answer doubts; view own feedback aggregates; export own batch reports | Cannot see other trainers' batches, salaries or performance; cannot create users or batches; cannot see placement offers | Own batches only |
| **Student** | Learn and progress | Student portal | View enrolled content; attempt assignments/tests/practice; submit projects; manage own profile and resumes; apply to eligible drives; give feedback; use AI assistant (if enabled) | Cannot see other students' personal data (leaderboard shows display name only); cannot access staff routes | Own data; batch-level aggregates only where designed (leaderboard) |
| **Placement Coordinator** | Placement operations | Placement portal, student readiness views | Manage companies, drives, kits; view eligible students' profiles, resumes, scores, attendance; move applications through pipeline; record offers; schedule interviews; export placement reports | Cannot edit academic content or grades; cannot manage users beyond profile verification | All students' placement-relevant data |
| **Content Manager** (bundle) | Content authoring | Content areas of Admin portal | Author courses, lessons, resources, question bank, company kits; submit for publishing | Cannot publish to batches (unless granted), cannot see student personal data | Content only |

### 7.3 Permission model

- **Permissions** are strings of the form `resource:action` (for example `attendance:mark`, `tests:grade`, `users:import`, `reports:export`). They are the only thing the API checks.
- **Roles** are named bundles of permissions stored in the database and seeded from code (`roles.seed.ts`), so the matrix is version-controlled and testable. Super Admin can adjust bundles in the UI (audited) but cannot invent permissions.
- **Scope** qualifies a permission: `all`, `batch` (batches the user is assigned to) or `own` (records belonging to the user). Trainers get most permissions at `batch` scope; students at `own`.
- A user may hold **multiple roles** (for example Admin + Placement Coordinator); effective permissions are the union.
- Enforcement happens in **three layers**: API guards (mandatory, authoritative), service-level scope filters (row-level: every query for a trainer is filtered by batch membership), and UI visibility (convenience only, never trusted).
- Every permission has an automated test (allow and deny cases), and every permission-bearing endpoint declares its permission in the OpenAPI description.

### 7.4 Role–permission matrix

Legend: C create, R read, U update, D delete (soft), A approve/publish, X export/report. Scope in brackets: (all), (batch), (own). "—" not permitted.

| Module / resource | Super Admin | Admin | Trainer | Student | Placement Coordinator | Content Manager |
|---|---|---|---|---|---|---|
| Roles & permissions | C R U D (all) | R | — | — | — | — |
| Users (staff) | C R U D (all) | C R U D (all, not Super Admin) | — | — | — | — |
| Students | C R U D X (all) | C R U D X (all) | R (batch) | R U (own profile) | R X (all, placement fields) | — |
| Profile verification | A | A | — | — | A | — |
| Trainers | C R U D (all) | C R U D (all) | R U (own) | — | R | — |
| Programmes & batches | C R U D X | C R U D X | R (batch) | R (own batch summary) | R | — |
| Courses, modules, lessons | C R U D A | C R U D A | C R U (batch, if content permission) | R (enrolled) | — | C R U (submit for approval) |
| Resources / files | C R U D | C R U D | C R U (own uploads) | R (enrolled), C (own uploads: resumes, documents, projects) | C R U (kits) | C R U |
| Live sessions & schedule | C R U D | C R U D | C R U (batch), mark live/complete | R (batch) | R | — |
| Attendance | R U X (all, with audit) | R U X (all) | C R U X (batch, 48 h window) | R (own) | R X (all) | — |
| Question bank | C R U D A | C R U D A | C R U (own/tagged, if content permission) | — | — | C R U |
| Assignments | C R U D A X | C R U D A X | C R U A (batch, per policy) | R (assigned), C submissions (own) | — | C R U |
| Tests | C R U D A X, grade | C R U D A X, grade | C R U A (batch, per policy), grade (batch) | R (scheduled), C attempts (own) | R results (all, for eligibility) | C R U |
| Code execution | R usage, U limits | R usage | — | execute (own, quota) | — | execute (authoring tests) |
| Projects | C R U D A X | C R U D A X | C R U A review (batch) | R (assigned), C U submissions (own) | R (all) | C R U |
| Certificates | C R U D (issue/revoke) X | C R U (issue/revoke) X | R (batch) | R (own) | R (all) | R templates |
| Feedback forms & responses | C R U D X | C R U D X | R aggregates (own) | C responses (own) | — | — |
| Companies, drives, kits | C R U D X | R | — | R (eligible/open), C applications (own) | C R U D A X | C R U (kits) |
| Applications & offers | R X | R X | — | R U (own: withdraw, accept/decline) | C R U X | — |
| Notifications | C (broadcast) R | C (broadcast) R | C (batch) R (own) | R U (own) | C (placement) R (own) | — |
| Announcements | C R U D | C R U D | C R U (batch) | R | C R U (placement) | — |
| Reports & exports | R X (all) | R X (all) | R X (batch) | — | R X (placement) | — |
| AI assistant | R usage, U quotas | R usage | R usage (batch) | use (own, quota) | — | — |
| Settings, integrations, flags | C R U | R | — | — | — | — |
| Audit log | R X | R (own actions) | — | — | — | — |
| Data-privacy requests | C R U | C R | — | C (own) | — | — |

### 7.5 Recommended RBAC design

1. Tables: `roles`, `permissions`, `role_permissions`, `user_roles` (with optional scope data such as batch assignments in `batch_trainers`).
2. On login the API loads the user's permissions into the session (JWT claims hold only role names; permissions are resolved server-side from cache so that changes apply within a minute).
3. A single `@RequirePermission('tests:grade', { scope: 'batch' })` decorator on NestJS handlers plus a `ScopeGuard` that injects the allowed batch/student filter into the request context; services must use it in every query.
4. Deny by default: an endpoint without a permission declaration fails CI (a lint rule and a test that walks the route table).
5. Impersonation is a Super Admin-only action that creates a time-boxed session with a visible banner and full audit trail.
6. Sensitive fields (guardian contacts, addresses, documents) are behind a separate `students:read_sensitive` permission held by Admin and Placement only.
7. All role and permission changes are audited (who, when, before/after).

---
