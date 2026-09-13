## 4. Client Requirements Analysis

### 4.1 Method

1. Every bullet in the four screenshots was transcribed verbatim and given a `CR-` identifier (A = admin dashboard list, S = student portal list).
2. Each bullet was interpreted in the context of a cohort-based training institute and of what the reference portal does for the same feature.
3. Requirements that are not stated but are necessary for the stated ones to function were added as implied requirements (`IR-`).
4. Every requirement was classified by user, priority (MoSCoW), technical complexity and delivery tier (MVP / Standard / Advanced / Future / Optional integration).
5. Duplicates, overlaps, conflicts and ambiguities were logged (§4.6) and assumptions were recorded separately (§4.7). No assumption is silently baked into scope.

Complexity scale used throughout: **L** low (days), **M** medium (1–2 weeks), **H** high (2–4 weeks), **VH** very high (4+ weeks or specialist infrastructure). Effort assumes one experienced full-stack engineer per item.

### 4.2 Inventory of client-stated requirements

#### 4.2.1 Admin dashboard metrics (screenshot 1)

| ID | Metric (verbatim) | Interpretation and definition to be agreed | Data source (feature) | Users | Priority | Complexity | Tier | Notes |
|---|---|---|---|---|---|---|---|---|
| CR-A01 | Total Students | Count of student accounts, optionally by status (enrolled, alumni, dropped) and date range. | Student management (F-03) | Admin, Super Admin | Must | L | MVP | Definition of "student" = account with Student role and at least one batch enrolment **[Q-05]** |
| CR-A02 | Active Students | Students with activity in the last N days (login, lesson watched, submission). N defaults to 7 and 30. | Activity log / progress (F-14) | Admin | Must | L | MVP | Needs an activity-event table from day one **[Q-05]** |
| CR-A03 | Batch-wise Students | Student counts per batch with status breakdown; drill-down to the batch roster. | Batch management (F-05) | Admin, Trainer (own batches) | Must | L | MVP | |
| CR-A04 | Course-wise Students | Enrolled/completed counts per course. | Enrolments (F-06) | Admin | Must | L | MVP | Course vs. programme distinction **[Q-08]** |
| CR-A05 | Attendance | Attendance % per batch/course/date range; low-attendance list. | Attendance (F-13) | Admin, Trainer | Must | M | MVP | Capture method decides complexity **[Q-12]** |
| CR-A06 | Course Completion % | Average completion per course/batch; distribution; completion = all mandatory lessons done. | Progress (F-14) | Admin, Trainer | Must | M | MVP | |
| CR-A07 | Assessment Scores | Average/median/spread of test scores per test, batch, subject; top/bottom performers. | Tests (F-11) | Admin, Trainer | Must | M | MVP | |
| CR-A08 | Assignment Status | Per batch: assigned / in progress / completed counts; overdue list. | Assignments (F-10) | Admin, Trainer | Must | M | MVP | |
| CR-A09 | Project Status | Per project: not started / submitted / under review / approved / rework. | Projects (F-15) | Admin, Trainer | Should | M | Standard | Requires project module (Standard) |
| CR-A10 | Trainer Performance | Composite of batch attendance %, batch test averages, student feedback rating, sessions delivered on time. Formula to be agreed. | Attendance, Tests, Feedback | Admin | Should | M | Standard | Sensitive HR metric; visibility restricted **[Q-16]** |
| CR-A11 | Placement Status | Funnel: eligible → applied → shortlisted → interviewed → offered → joined; per batch. | Placement (F-17) | Admin, Placement Coordinator | Should | M | Standard | Requires placement module |
| CR-A12 | Company-wise Placements | Offers and joinings grouped by company, with package ranges. | Placement (F-17) | Admin, Placement | Should | L | Standard | |
| CR-A13 | Certificates Issued | Count and list of certificates issued per course/batch; verification lookups. | Certificates (F-16) | Admin | Should | L | Standard | |
| CR-A14 | Student Feedback | Average ratings and comments per course/trainer/session; response rate. | Feedback (F-18) | Admin | Should | M | Standard | Anonymity rules **[Q-17]** |
| CR-A15 | Reports & Excel/PDF Export | Every dashboard table exportable as XLSX and PDF; scheduled/emailed reports later. | Reporting (F-19) | Admin, Placement, Trainer (scoped) | Must | M | MVP (XLSX/CSV), Standard (PDF, scheduled) | Export as background job for large sets |

#### 4.2.2 Student portal features (screenshots 2–4)

| ID | Feature (verbatim) | Interpretation | Users | Priority | Complexity | Tier | Notes |
|---|---|---|---|---|---|---|---|
| **1. Student Dashboard** | | | | | | | |
| CR-S01 | Overall learning progress | Single progress indicator combining courses, assignments and tests, plus a "continue where you left off" list. | Student | Must | M | MVP | Weighting formula to define |
| CR-S02 | Course progress | Per-course completion % from lesson completion events. | Student | Must | M | MVP | |
| CR-S03 | Webinar and workshop progress | Attendance/completion of scheduled events that are not regular classes (guest webinars, workshops). | Student | Could | M | Standard | Meaning unclear **[Q-10]** |
| CR-S04 | Interview and project progress | Status of project submissions and of interview-preparation activities (mock interviews attended/completed). | Student | Should | M | Standard | Depends on Projects (F-15) and Placement prep (F-17) |
| CR-S05 | Upcoming sessions and calendar | Today/this-week list plus month calendar of live classes, tests, deadlines and events; join links. | Student | Must | M | MVP | Reference has a monthly schedule calendar |
| **2. Courses & Learning** | | | | | | | |
| CR-S06 | Self-paced video courses | Courses made of modules and lessons; video lessons with resume position, speed, captions where available. | Student | Must | H | MVP | Video hosting decision **[Q-13]** |
| CR-S07 | Live classes | Scheduled sessions per batch with join link (Zoom/Meet/other), reminders, recordings attached afterwards. | Student, Trainer | Must | M | MVP (links) / Standard (API integration) | Tool decision **[Q-11]** |
| CR-S08 | Course materials and learning resources | Downloadable/viewable PDFs, slides, notes, links, code files per lesson or module. | Student | Must | M | MVP | Secure file delivery |
| CR-S09 | Course completion tracking | Lesson-level completion, module progress, course completion rules, completion date. | Student | Must | M | MVP | |
| CR-S10 | Certifications | Auto-issued PDF certificate on completion criteria, with public verification code; shareable. | Student, Admin | Should | M | Standard | Template/signature **[Q-18]** |
| **3. Coding Practice** | | | | | | | |
| CR-S11 | CodeKata — coding problems | Problem bank with statement, constraints, examples, starter code, multi-language editor, run with custom input, submit against hidden test cases, verdicts, points. | Student | Must | VH | MVP (core) | Requires execution service (F-12) |
| CR-S12 | WebKata — web-development practice | HTML/CSS/JS exercises with live preview in a sandboxed iframe and automated checks. | Student | Should | H | Standard | No server execution needed |
| CR-S13 | SQLKata — SQL practice | SQL problems with a seeded schema, query runner and result-set comparison. | Student | Should | H | Standard | Dialect decision (MySQL vs. SQLite/PostgreSQL) **[Q-15]** |
| CR-S14 | FixTheCode — debugging / problem-solving | Coding problems pre-filled with buggy code; same evaluation pipeline. | Student | Should | M | Standard | Reuses F-12 |
| CR-S15 | IDE — online coding environment | Free-form multi-language playground with run/stdin, save snippets. | Student | Could | M | Standard | Rate-limited; reuses F-12 |
| **4. Projects & Assessments** | | | | | | | |
| CR-S16 | Real-world projects | Guided capstone/mini projects with brief, resources, milestones, submission (repo link/zip/demo link), trainer review and grading. | Student, Trainer | Should | M | Standard | |
| CR-S17 | Assignments | Practice sets grouped in modules (MCQ, coding, SQL, web, descriptive), with marks, attempts, progress and optional sequential unlocking. | Student, Trainer, Admin | Must | H | MVP | Central practice feature in reference |
| CR-S18 | Skill assessments | Timed tests (weekly, on-demand, company-style), scheduled per batch, auto-graded objective questions, results and leaderboard. | Student, Trainer, Admin | Must | H | MVP | Integrity controls **[Q-19]** |
| CR-S19 | Project/portfolio development | Projects surfaced on the student profile/portfolio; public portfolio page optional. | Student | Could | M | Standard/Advanced | Overlaps CR-S22, CR-S31 |
| **5. Career & Placement** | | | | | | | |
| CR-S20 | AI mock interviews | AI-driven interview conversation (text first, voice later) with rubric-based feedback. | Student | Could | VH | Advanced | Duplicate of CR-S28; budget **[Q-20]** |
| CR-S21 | Resume building | Structured profile data rendered into resume templates (PDF); upload of own resumes. | Student | Should | M | Standard | Reference has upload (up to 4) and "Generate resume" |
| CR-S22 | Portfolio building | Public or shareable page listing skills, projects, certificates, links. | Student | Could | M | Advanced | |
| CR-S23 | Interview preparation | Company question kits, curated resources, practice tests, mock interview scheduling with trainers. | Student, Placement | Should | M | Standard | |
| CR-S24 | Placement/career guidance | Placement drives board with eligibility and applications; guidance content; counselling session booking. | Student, Placement | Should | H | Standard | Core of placement module |
| **6. AI Support** | | | | | | | |
| CR-S25 | AI learning assistant | Chat assistant grounded in the current lesson/problem with modes (explain, quiz me, hint). | Student | Could | H | Advanced | Feature-flagged; quotas **[Q-20]** |
| CR-S26 | Doubt clarification | Same assistant answering doubts; escalation to trainer Q&A when AI cannot help. | Student, Trainer | Could | M | Advanced (AI) / Standard (human Q&A) | Human doubt queue is Standard |
| CR-S27 | Coding assistance | Hints and explanations for failed submissions without revealing the full solution (configurable). | Student | Could | M | Advanced | |
| CR-S28 | AI-powered interview practice | Duplicate of CR-S20. | Student | Could | VH | Advanced | Merged into CR-S20 |
| **7. Student Profile** | | | | | | | |
| CR-S29 | Personal profile | Personal, contact, education, experience, documents, links; verification by staff. | Student, Admin, Placement | Must | M | MVP | Field list **[Q-21]**; DPDP consent |
| CR-S30 | Skills | Self-declared skills plus system-derived skill ratings from assessments. | Student | Should | M | MVP (declared) / Standard (derived) | |
| CR-S31 | Projects | Projects list on profile (from F-15 plus self-added). | Student | Should | L | Standard | Overlaps CR-S16/S19 |
| CR-S32 | Learning progress | Progress summary on profile (courses, assignments, tests). | Student, Placement | Must | L | MVP | Same data as CR-S01 |
| CR-S33 | Resume/profile information | Resume uploads, default resume, profile completeness. | Student, Placement | Should | M | MVP (upload) / Standard (generate) | |

### 4.3 Implied requirements (not stated, but necessary)

| ID | Requirement | Why it is necessary | Users | Priority | Complexity | Tier |
|---|---|---|---|---|---|---|
| IR-01 | Authentication and account lifecycle (sign-in, password reset, email/mobile verification, session management, logout everywhere) | Every portal is private. | All | Must | M | MVP |
| IR-02 | Role-based access control with permissions | Admin, trainer, student and placement views differ and see different data. | All | Must | M | MVP |
| IR-03 | User and student management (create, invite, bulk import via CSV/XLSX, deactivate, reset) | CR-A01–A04 need clean student records; institutes onboard batches of 30–200 at a time. | Admin | Must | M | MVP |
| IR-04 | Trainer management (profiles, subject tags, batch assignment) | CR-A10 and live classes need trainers as first-class users. | Admin | Must | L | MVP |
| IR-05 | Batch / cohort management (programme, dates, mode, trainers, students, timetable) | CR-A03, CR-S05, CR-S07, attendance and placement eligibility are all batch-scoped. | Admin | Must | M | MVP |
| IR-06 | Course authoring (courses, modules, lessons, ordering, publishing, versioning) | CR-S06–S09 need content to be created by staff. | Admin, Content Manager, Trainer | Must | H | MVP |
| IR-07 | Video upload/link and secure playback (signed URLs, no public listing) | CR-S06 content is the institute's main asset. | Admin/Content | Must | M | MVP |
| IR-08 | Live session scheduling (recurring sessions, links, reschedule, cancel, reminders) | CR-S05, CR-S07. | Admin, Trainer | Must | M | MVP |
| IR-09 | Attendance capture (manual by trainer, QR code, or online-join based) | CR-A05. | Trainer, Student | Must | M | MVP |
| IR-10 | Question bank authoring (MCQ, coding with test cases, SQL, web, debug, descriptive; tags, difficulty, marks; bulk import) | CR-S11–S18 all draw from a question bank. | Admin, Content, Trainer | Must | H | MVP |
| IR-11 | Assignment authoring and publishing to batches with due dates and unlock rules | CR-S17, CR-A08. | Admin, Trainer | Must | M | MVP |
| IR-12 | Test authoring, scheduling, attempt control, auto-grading, manual grading, results release | CR-S18, CR-A07. | Admin, Trainer | Must | H | MVP |
| IR-13 | Secure code execution service (sandbox, queue, limits) | CR-S11, S13–S15, S17, S18 and CR-S27. | System | Must | VH | MVP (core) |
| IR-14 | Project authoring, submission and review workflow | CR-S16, CR-A09. | Trainer, Student | Should | M | Standard |
| IR-15 | Certificate templates, issuance rules, PDF generation and public verification | CR-S10, CR-A13. | Admin | Should | M | Standard |
| IR-16 | Feedback forms (per session/course/trainer) with scheduling and anonymity options | CR-A14. | Admin, Student | Should | M | Standard |
| IR-17 | Company and placement-drive management (companies, contacts, drives, eligibility, applications, rounds, offers) | CR-A11, A12, CR-S24. | Placement Coordinator | Should | H | Standard |
| IR-18 | Notifications and announcements (in-app, email; SMS/WhatsApp/push optional) | Reminders for classes, tests, deadlines, drives; admin announcements/banners. | All | Must | M | MVP |
| IR-19 | Search, filtering and sorting on every list | Usability at scale (hundreds of students, thousands of questions). | All | Must | M | MVP |
| IR-20 | File uploads (resumes, documents, materials, project files) with size/type limits and private storage | Profile, materials, projects. | All | Must | M | MVP |
| IR-21 | Audit logging of sensitive actions (grades, attendance edits, role changes, exports, deletions) | Trust, disputes, compliance. | System, Super Admin | Must | L | MVP |
| IR-22 | System administration (settings, feature flags, integrations, branding, templates) | Operate without code changes. | Super Admin | Must | M | MVP |
| IR-23 | Reporting engine (parameterised queries, aggregation tables, exports as background jobs) | CR-A15 and every metric. | Admin | Must | M | MVP |
| IR-24 | Privacy and consent (consent capture, data export/erasure on request, retention) | Student personal data including guardian contacts; Indian DPDP Act. | All | Must | M | MVP (basic) |
| IR-25 | Gamification: points, streaks, leaderboards, badges | Present in reference and drives daily practice; optional. | Student | Could | M | Standard |

### 4.4 Requirement detail cards

Cards are grouped by feature area. Each card covers the fields requested in the brief. Acceptance criteria are written so they can become automated tests later.

#### Card R-01 — Admin Dashboard and Reports (CR-A01…CR-A15, IR-23)

- **Description.** A management home page showing the fifteen listed metrics as KPI tiles, trend charts and drill-down tables, with filters for date range, programme, batch, course and trainer, and export to XLSX/CSV (MVP) and PDF (Standard).
- **Business purpose.** Gives the founders and operations team a single view of learning health, delivery quality and placement outcomes; replaces manual spreadsheets; supports decisions about batches, trainers and placement effort.
- **Intended users.** Admin, Super Admin (all data); Trainer (own batches only); Placement Coordinator (placement metrics only).
- **User workflow.** Sign in → dashboard opens with default filter "current active batches, last 30 days" → adjust filters → click any tile to open the underlying table → export → optionally schedule a weekly email of the same report (Standard).
- **Functional requirements.** FR-01.1 each metric has a written definition stored in the system help; FR-01.2 metrics are computed from operational data, never entered by hand; FR-01.3 heavy aggregates are pre-computed nightly and on demand, with a "last updated" timestamp; FR-01.4 every table is exportable; FR-01.5 exports over 5,000 rows run as background jobs and are delivered by notification; FR-01.6 all views respect role scope.
- **Inputs.** Filters (date range, programme, batch, course, trainer, company); export format.
- **Outputs.** Tiles, charts, tables, XLSX/CSV/PDF files, scheduled emails.
- **Validation rules.** Date ranges bounded (max 24 months); exports capped (configurable, default 100k rows); filter values must belong to the caller's scope.
- **Dependencies.** All operational modules; activity event log; aggregation jobs; file storage.
- **Priority / complexity.** Must / M (MVP subset), Should / M (placement, projects, feedback, trainer metrics).
- **Open questions.** Q-05 definitions of "active", Q-16 trainer performance formula and visibility, Q-17 feedback anonymity, Q-22 required chart types/branding of PDF reports.
- **Acceptance criteria.** AC-01.1 Given 3 batches with known rosters, the "Batch-wise Students" tile totals match the database within the filter. AC-01.2 An export of any table produces a file whose row count equals the on-screen filtered total. AC-01.3 A trainer sees only their batches' data on every tile and table. AC-01.4 Dashboard loads in under 2 s (p95) with pre-aggregated data for 5,000 students.

#### Card R-02 — Student Dashboard (CR-S01…CR-S05, CR-S32)

- **Description.** Student home page: greeting, today's and upcoming sessions with join buttons, "continue learning" cards, overall/course/assignment/test progress, pending tasks (due assignments, scheduled tests), announcements, streak and (optional) leaderboard, attendance summary.
- **Business purpose.** Drives daily engagement and reduces "where do I go next" support load; mirrors the reference's most valued screen.
- **Users.** Student.
- **Workflow.** Sign in → dashboard → click a session (join), a "continue" card (resume lesson/assignment), a task (open test), an announcement (read).
- **Functional requirements.** FR-02.1 progress values identical to those in the respective modules; FR-02.2 sessions in IST with join button enabled 15 min before start; FR-02.3 announcements are targetable by batch/course; FR-02.4 empty states for new students explain first steps; FR-02.5 renders in under 1.5 s on 3G-class connections (skeleton loading).
- **Inputs.** None beyond identity; optional filters (programme).
- **Outputs.** Aggregated widgets.
- **Validation.** Only the student's own data.
- **Dependencies.** Progress (F-14), Schedule (F-08), Assignments (F-10), Tests (F-11), Notifications (F-20), Gamification (F-22).
- **Priority / complexity.** Must / M.
- **Open questions.** Q-10 meaning of webinars/workshops; Q-23 whether leaderboards/streaks are wanted (they can demotivate weaker students if public).
- **Acceptance criteria.** AC-02.1 A student enrolled in one batch with one session today sees that session with a join button that activates 15 minutes before start. AC-02.2 Course progress on the dashboard equals the course page value. AC-02.3 A brand-new student sees onboarding guidance, not empty widgets.

#### Card R-03 — Courses, Lessons and Resources (CR-S06, CR-S08, CR-S09, IR-06, IR-07)

- **Description.** Courses consist of ordered modules; modules of lessons; lessons are video, reading (rich text/PDF), resource bundle, or embedded practice (question). Students see enrolled courses with progress, a course player with the curriculum sidebar, resume position, mark-complete rules, discussions (Standard) and ratings (Standard). Staff author and publish courses.
- **Business purpose.** Core learning delivery; institute's content asset; enables self-paced learning and recordings of live classes.
- **Users.** Student (consume), Admin/Content Manager/Trainer (author), Admin (publish).
- **Workflow (student).** Courses list → open course → curriculum → play lesson → auto-complete at 90% watched or manual complete for readings → next lesson → module complete → course complete → certificate (if configured).
- **Workflow (author).** Create course → add modules/lessons → upload video (or paste hosted video ID/link) → attach resources → set completion rules → preview → publish to programmes/batches → later versions edited as draft and republished.
- **Functional requirements.** FR-03.1 drag-and-drop ordering; FR-03.2 lesson types: video, article, file bundle, link, practice question, live-recording; FR-03.3 signed, expiring playback URLs; FR-03.4 resume position saved every 10 s while playing; FR-03.5 prerequisite/sequential unlock optional per module; FR-03.6 publishing scopes: all students, programme, batch; FR-03.7 draft/published/archived states; FR-03.8 lesson search inside a course.
- **Inputs.** Course metadata (title, description, thumbnail, tags, level, estimated hours), module/lesson content, files, completion rules.
- **Outputs.** Course catalogue, player, progress events, completion records.
- **Validation.** Title length limits; video file type/size limits (configurable, e.g. ≤ 4 GB via direct-to-storage upload); resource file types whitelist; publishing requires at least one lesson.
- **Dependencies.** Object storage, video provider, progress, enrolment.
- **Priority / complexity.** Must / H.
- **Open questions.** Q-13 video hosting choice and existing video location; Q-08 course vs programme model; Q-24 whether students can rate/discuss.
- **Acceptance criteria.** AC-03.1 An author can build a course with 2 modules and 4 lessons and publish it to one batch; students in that batch see it and others do not. AC-03.2 Playback URLs expire (e.g. 6 hours) and cannot be reused after expiry. AC-03.3 Leaving a video at 05:10 and reopening resumes at 05:10 ± 10 s. AC-03.4 Completing all mandatory lessons marks the course complete with a timestamp.

#### Card R-04 — Live Classes and Schedule (CR-S05, CR-S07, IR-08)

- **Description.** Batch timetables with recurring live sessions, each with trainer, subject, start/end, join link (Zoom/Google Meet/other), status (scheduled, live, completed, cancelled), and attached recording after the class. Students see a calendar and "today" list; trainers see their teaching schedule; admins manage the timetable.
- **Business purpose.** Live classes are the primary delivery mode of such institutes; a reliable schedule with reminders reduces no-shows.
- **Users.** Student, Trainer, Admin.
- **Workflow.** Admin creates a recurring session series for a batch → system generates occurrences → reminders sent (24 h and 30 min) → trainer starts the class from the platform (opens link, marks "live") → after class, attendance is finalised and the recording is attached → students see the recording under the course "Live Class Recordings" section.
- **Functional requirements.** FR-04.1 recurrence rules (weekdays, custom); FR-04.2 exceptions (holiday, reschedule); FR-04.3 timezone stored in UTC, displayed in IST; FR-04.4 join button visibility window; FR-04.5 conflict warnings for trainer double-booking; FR-04.6 iCal export (Standard).
- **Inputs.** Batch, subject, trainer, dates/times, recurrence, link, notes.
- **Outputs.** Calendar views, reminders, recordings list.
- **Validation.** End after start; trainer must be assigned to the batch; link must be a valid URL.
- **Dependencies.** Batches, Notifications, Attendance, Courses (recordings).
- **Priority / complexity.** Must / M (link-based); Should / H (native Zoom API integration, auto-recordings).
- **Open questions.** Q-11 live-class tool and whether API integration is wanted; Q-12 attendance method.
- **Acceptance criteria.** AC-04.1 Creating a Mon–Fri 10:00–11:30 series for 4 weeks produces 20 occurrences, skipping declared holidays. AC-04.2 Rescheduling one occurrence does not change the others and notifies enrolled students. AC-04.3 The calendar shows sessions in IST regardless of the browser timezone (with a note if the browser timezone differs).

#### Card R-05 — Attendance (CR-A05, IR-09)

- **Description.** Attendance per session per student with statuses present, absent, late, excused, week-off/holiday. Capture by trainer roll-call (MVP), student QR scan of a rotating code shown in class (Standard), or automatic from live-tool join logs (Advanced). Students see their percentage and calendar; trainers mark and correct; admins report and set thresholds.
- **Business purpose.** Attendance is a leading indicator of dropout and a placement-eligibility criterion; the client lists it explicitly.
- **Users.** Trainer (mark), Student (view/scan), Admin (report, thresholds).
- **Workflow.** Session ends → trainer opens roll-call (all present by default, toggles absentees) → submit → corrections allowed for 48 h with reason → student notified if below threshold (weekly).
- **Functional requirements.** FR-05.1 bulk marking; FR-05.2 correction audit trail; FR-05.3 percentage = present + late + excused ÷ conducted sessions (configurable); FR-05.4 per-subject filter as in reference; FR-05.5 low-attendance alerts.
- **Inputs.** Session, student statuses, reasons.
- **Outputs.** Attendance records, percentages, reports.
- **Validation.** Only assigned trainer/admin can mark; cannot mark future sessions; one record per student per session.
- **Dependencies.** Sessions, Batches, Notifications.
- **Priority / complexity.** Must / M.
- **Open questions.** Q-12 capture method; Q-25 whether offline classroom attendance is needed (QR).
- **Acceptance criteria.** AC-05.1 A trainer can mark 40 students in under 1 minute using defaults. AC-05.2 Editing a record after submission stores who/when/why. AC-05.3 Student percentage matches the formula for a known dataset.

#### Card R-06 — Question Bank and Assignments (CR-S17, CR-S11, CR-S14, IR-10, IR-11, CR-A08)

- **Description.** A reusable question bank (MCQ single/multi, true/false, fill-in, descriptive, coding with test cases, SQL, web, debug) with tags (subject, topic, difficulty, company), marks, explanations and versioning. Assignments are ordered modules of questions published to batches with optional due dates, attempt limits, sequential unlocking and marks; students solve, see verdicts/explanations, review, bookmark; trainers see progress and grade descriptive answers.
- **Business purpose.** Daily practice is the engine of the reference product (thousands of questions per subject) and directly feeds skill ratings and employability.
- **Users.** Admin/Content Manager/Trainer (author, publish), Student (solve), Trainer/Admin (monitor).
- **Workflow (student).** Assignments → open assignment → module list (locked/unlocked) → question → answer/run/submit → verdict + marks + explanation (per settings) → next → module complete → share achievement (optional).
- **Workflow (author).** Question bank → create/import questions (XLSX/CSV for MCQ; JSON for coding) → review → publish; Assignment → select questions/modules → settings → publish to batches.
- **Functional requirements.** FR-06.1 bulk import with validation report; FR-06.2 question versioning (edits after publication create a new version; existing submissions keep their version); FR-06.3 attempt tracking (count, time spent, best score); FR-06.4 unlock rules (previous module ≥ X%); FR-06.5 randomised option order; FR-06.6 rich text with code blocks and images; FR-06.7 bookmarks; FR-06.8 review mode with explanations after solve; FR-06.9 marks/negative marks configurable.
- **Inputs.** Question content, options, answers, test cases, settings.
- **Outputs.** Assignment progress, submissions, marks, skill data.
- **Validation.** MCQ must have exactly one correct option (single) or ≥ 1 (multi); coding questions need ≥ 1 sample and ≥ 1 hidden test; due date ≥ publish date; marks ≥ 0.
- **Dependencies.** Code execution (F-12), Batches, Progress, Notifications.
- **Priority / complexity.** Must / H.
- **Open questions.** Q-14 languages for coding questions; Q-26 existing question banks to migrate (format).
- **Acceptance criteria.** AC-06.1 Importing a 500-row MCQ sheet with 3 invalid rows imports 497 and reports the 3 with row numbers and reasons. AC-06.2 A module with rule "unlock after previous ≥ 60%" stays locked until that score is reached. AC-06.3 Submitting an MCQ records attempt number, time spent, correctness and marks; re-attempt behaviour follows settings. AC-06.4 Assignment progress on the list equals solved ÷ total questions.

#### Card R-07 — Tests / Skill Assessments (CR-S18, CR-A07, IR-12)

- **Description.** Timed tests (weekly test, on-demand practice test, company-style test, contest) built from the question bank, scheduled per batch with a window, duration, attempt rules, question shuffling, section timing, auto-grading for objective and coding questions, manual grading for descriptive, results with analytics, leaderboard per test (optional), and history for students.
- **Business purpose.** Measures learning, drives the "Assessment Scores" metric, prepares students for company tests.
- **Users.** Admin/Trainer (author, schedule, grade, release), Student (attempt), Placement (view scores for eligibility).
- **Workflow (student).** Tests → Upcoming → start within window → instructions → attempt with timer and question palette → autosave → submit (or auto-submit at time-out) → results when released → review (if allowed).
- **Functional requirements.** FR-07.1 server-authoritative timer; FR-07.2 autosave every answer; FR-07.3 resume after disconnect within the window; FR-07.4 one active attempt per student; FR-07.5 sections and per-question marks/negative marks; FR-07.6 result release control; FR-07.7 integrity basics: full-screen prompt, tab-switch count logged, copy/paste disabled in coding editor (configurable); FR-07.8 analytics per question (difficulty index, discrimination) in Standard.
- **Inputs.** Test definition, schedule, answers.
- **Outputs.** Attempts, scores, ranks, reports.
- **Validation.** Window and duration positive; cannot start after window end; cannot submit twice.
- **Dependencies.** Question bank, Code execution, Batches, Notifications, Reports.
- **Priority / complexity.** Must / H.
- **Open questions.** Q-19 level of integrity/proctoring needed; Q-23 leaderboards.
- **Acceptance criteria.** AC-07.1 A test with a 60-minute duration auto-submits at 60:00 server time even if the client clock is altered. AC-07.2 Losing connectivity for 2 minutes and returning restores all saved answers. AC-07.3 Objective scores are available immediately after submission to staff and to students only after release. AC-07.4 Two browser tabs cannot run two attempts.

#### Card R-08 — Coding Practice, Labs and Playground (CR-S11…CR-S15, IR-13)

- **Description.** See §10 for the full analysis. Coding problems (multi-language, hidden tests, limits), Debug Challenges (buggy starter code), SQL Lab (schema + query evaluation), Web Lab (sandboxed HTML/CSS/JS with automated checks), Playground (free-form runner). Progress, points and streaks feed skills and leaderboards.
- **Business purpose.** Differentiator of the reference market; daily practice habit; interview readiness.
- **Users.** Student; authors for problem creation.
- **Priority / complexity.** Coding problems Must / VH; Debug Should / M; SQL Should / H; Web Should / H; Playground Could / M.
- **Open questions.** Q-14 languages; Q-15 SQL dialect; Q-27 expected concurrent submissions (sizing).
- **Acceptance criteria.** AC-08.1 A Java "sum of array" problem with 5 hidden tests returns per-test verdicts within 10 s (p95) under 50 concurrent submissions. AC-08.2 Infinite-loop code is killed at the time limit and returns "Time Limit Exceeded" without affecting other submissions. AC-08.3 Code cannot access the network or the host filesystem (verified by a security test suite). AC-08.4 A Web Lab exercise's checks run entirely in the browser sandbox.

#### Card R-09 — Projects (CR-S16, CR-S19, CR-A09, IR-14)

- **Description.** Project briefs (title, description, skills, rubric, resources, milestones, deadline) published to batches; students submit repository link, hosted demo link and/or zip; trainers review with rubric scores and comments; statuses drive the admin "Project Status" metric and appear on the profile/portfolio.
- **Users.** Trainer/Admin (author/review), Student (submit).
- **Priority / complexity.** Should / M. **Tier.** Standard.
- **Acceptance criteria.** AC-09.1 A submission moves through submitted → under review → approved/rework with notifications at each step. AC-09.2 Rubric scores total correctly and appear in the student's project record.

#### Card R-10 — Certificates (CR-S10, CR-A13, IR-15)

- **Description.** Certificate templates (course completion, programme completion, achievement) with merge fields, issuance rules (completion %, minimum test score, attendance threshold), PDF generation, unique verification ID and public verification page; manual issue/revoke by admin.
- **Priority / complexity.** Should / M. **Tier.** Standard.
- **Open questions.** Q-18 design, signatory, whether QR verification is wanted.
- **Acceptance criteria.** AC-10.1 Meeting the rule issues a certificate within 5 minutes and notifies the student. AC-10.2 The verification page shows name, course, date and status for a valid ID and "not found" otherwise. AC-10.3 Revoked certificates verify as revoked.

#### Card R-11 — Placement Management (CR-A11, CR-A12, CR-S23, CR-S24, IR-17)

- **Description.** Companies (profile, contacts, tags), drives (job title, description, location, package, eligibility rules such as passing year, degree, minimum score/attendance, deadline, rounds), student applications with status pipeline, interview scheduling, offers and joining, company question kits (documents, videos, question sets), placement guidance content, and placement analytics.
- **Users.** Placement Coordinator (manage), Student (browse/apply/track), Admin (reports).
- **Workflow (student).** Jobs → eligible drives highlighted → detail → apply (profile completeness check, default resume attached) → track status → interview invites → offer accept/decline.
- **Priority / complexity.** Should / H. **Tier.** Standard.
- **Open questions.** Q-06 whether a placement team will use the platform; Q-28 eligibility rule set; Q-29 whether companies get any portal access (proposed: no, Future).
- **Acceptance criteria.** AC-11.1 A drive with eligibility "passing year 2026, min test average 60%" is shown as eligible only to matching students. AC-11.2 Applying attaches the student's default resume snapshot and creates a pipeline record. AC-11.3 Placement funnel report totals match pipeline records.

#### Card R-12 — Student Profile, Resume and Portfolio (CR-S29…CR-S33, CR-S21, CR-S22)

- **Description.** Profile with tabs (overview, personal, education, experience, projects, certificates, documents), staff verification of documents, skills (declared and derived), multiple resume uploads with a default, resume generation from profile data into templates (Standard), optional public portfolio page (Advanced), profile completeness score.
- **Priority / complexity.** Must / M (profile, uploads); Should / M (generation); Could / M (portfolio).
- **Open questions.** Q-21 exact field list and mandatory fields; Q-30 whether guardian contact and address are needed (privacy minimisation).
- **Acceptance criteria.** AC-12.1 Only PDF resumes up to a configured size can be uploaded; a maximum of N resumes; one is default. AC-12.2 Verification status changes are audited and visible to placement staff. AC-12.3 Completeness score reflects mandatory fields.

#### Card R-13 — Feedback (CR-A14, IR-16)

- **Description.** Feedback forms (rating scales, text) attached to sessions, courses or trainers, scheduled automatically (e.g. weekly per batch) or manually, optional anonymity, response tracking, aggregates on the admin dashboard.
- **Priority / complexity.** Should / M. **Tier.** Standard.
- **Acceptance criteria.** AC-13.1 A weekly form is sent to a batch every Friday and closes on Sunday. AC-13.2 Anonymous responses cannot be traced to a student in any UI or export.

#### Card R-14 — AI Support (CR-S20, CR-S25…CR-S28)

- **Description.** A study assistant with modes (explain this lesson, clarify a doubt, hint on my failed submission, quiz me, SQL/coding practice generator, mock interview). Grounded in the platform's own content, rate-limited per student, logged, with a "not sure — ask a trainer" escalation into the human doubt queue.
- **Priority / complexity.** Could / H–VH. **Tier.** Advanced; human doubt queue in Standard.
- **Open questions.** Q-20 approval, budget, model choice, content guardrails, whether interview practice needs voice.
- **Acceptance criteria.** AC-14.1 With the feature flag off, no AI UI is visible and no AI calls are made. AC-14.2 A student exceeding the daily quota gets a clear message. AC-14.3 Every AI interaction is logged with token usage for cost reporting. AC-14.4 Hints never include the full reference solution when the "hint-only" policy is set.

#### Card R-15 — Notifications and Announcements (IR-18)

- **Description.** In-app notification centre (unread badge), email notifications, optional SMS/WhatsApp/push (Optional integrations), per-user preferences, admin announcements/banners targeted by batch/programme with schedule.
- **Priority / complexity.** Must / M. **Tier.** MVP (in-app + email).
- **Acceptance criteria.** AC-15.1 Publishing an assignment to a batch creates one in-app notification per student and one email digest according to preferences. AC-15.2 Announcements expire automatically at end date.

#### Card R-16 — Authentication, Users, Roles, Batches, Admin (IR-01…IR-05, IR-19…IR-22, IR-24)

- **Description.** Sign-in (email + password in MVP; mobile OTP optional in Standard), verification, password reset, sessions, RBAC, user management with bulk import, trainer management, batch management, settings, audit logs, privacy tooling.
- **Priority / complexity.** Must / M. **Tier.** MVP.
- **Open questions.** Q-09 login method; Q-31 self-registration vs invite-only (proposed: invite-only by the institute).
- **Acceptance criteria.** AC-16.1 An admin can import 200 students from a sheet, each receiving an invitation email; 100% of valid rows become accounts. AC-16.2 A deactivated user cannot sign in and existing sessions end within 60 s. AC-16.3 Every permission in the role matrix has an automated test.

### 4.5 Tier classification summary

| Tier | Content | Requirements |
|---|---|---|
| **1. Mandatory MVP** | Everything needed to run a batch end to end and see the core admin metrics | IR-01–IR-13, IR-18–IR-24; CR-A01–A08, A15 (XLSX); CR-S01, S02, S05–S09, S11 (core), S17, S18, S29, S30 (declared), S32, S33 (upload) |
| **2. Standard version** | Practice labs, projects, certificates, placement, feedback, gamification, PDF/scheduled reports, OTP login, resume generation, human doubt queue | IR-14–IR-17, IR-25; CR-A09–A14, A15 (PDF); CR-S03, S04, S10, S12–S16, S19, S21, S23, S24, S26 (human), S30 (derived), S31, S33 (generate) |
| **3. Advanced** | AI assistant, AI coding hints, AI mock interviews, portfolio pages, advanced analytics, test integrity extras, native live-class integration | CR-S20/S28, S22, S25, S27; parts of S07, S18 |
| **4. Future phase** | Native mobile apps, company portal, payments/fee management, multi-institute tenancy, voice interviews, proctoring, marketplace of courses | not in client list; recorded for roadmap only |
| **5. Optional integrations** | Zoom/Google Meet API, SMS/WhatsApp OTP and alerts (MSG91/Twilio/Meta), push notifications, payment gateway (Razorpay), analytics (PostHog/GA4), Slack/Discord community, GitHub OAuth for project submissions | dependent on client decisions |

### 4.6 Duplicates, conflicts, incomplete and ambiguous requirements

| # | Items | Issue | Proposed resolution |
|---|---|---|---|
| D-01 | CR-S20 AI mock interviews / CR-S28 AI-powered interview practice | Exact duplicate. | Merge into one feature (F-24) in Advanced tier. |
| D-02 | CR-S19 project/portfolio development / CR-S22 portfolio building / CR-S31 projects (profile) | Three overlapping bullets. | One Projects feature (F-15) plus profile/portfolio display (F-21); public portfolio page as Advanced. |
| D-03 | CR-S01 overall progress / CR-S02 course progress / CR-S09 completion tracking / CR-S32 learning progress / CR-A06 completion % | Same underlying data seen from different places. | One Progress service (F-14) exposing the same numbers everywhere. |
| D-04 | CR-S21 resume building / CR-S33 resume information | Overlap. | Upload (MVP) and generation (Standard) inside Profile (F-21). |
| D-05 | CR-S18 skill assessments / CR-A07 assessment scores | Same feature, two views. | Tests (F-11) with reporting. |
| D-06 | CR-S23 interview preparation / CR-S24 placement guidance / CR-S20 AI interviews | Overlapping career features. | Placement module (F-17) hosts kits/guidance/scheduling; AI interview separate (F-24). |
| C-01 | CR-S11–S15 use GUVI product names | Trademark/brand conflict. | Rename (working names in §1) **[CONFIRM]**. |
| C-02 | "Live classes" versus "self-paced video courses" | Two delivery modes; the reference stores live recordings as a pseudo-course. | Model recordings as lessons of type *live-recording* attached to the session and the course, not as a separate course. |
| I-01 | Trainer functionality | Not mentioned except as a metric. | Trainer portal proposed (§7, §8) **[CONFIRM Q-06]**. |
| I-02 | Placement team functionality | Not mentioned except as metrics. | Placement Coordinator role and module proposed **[CONFIRM Q-06]**. |
| I-03 | Authentication method | Not mentioned. | Email + password MVP; OTP Standard **[Q-09]**. |
| I-04 | Payments / fees | Not mentioned. | Out of scope unless confirmed **[Q-07]**. |
| I-05 | Volumes, performance, availability | Not mentioned. | Assumed ≤ 5,000 students, ≤ 500 concurrent, 99.5% availability target **[Q-03]**. |
| I-06 | Branding, product name, languages | Not mentioned. | English UI; name/brand to be provided **[Q-01, Q-02]**. |
| A-01 | "Webinar and workshop progress" | Unclear entity. | Treat as *events* (non-batch sessions) with attendance **[Q-10]**. |
| A-02 | "Interview and project progress" | Unclear. | Mock-interview attendance + project status **[Q-10]**. |
| A-03 | "Certifications" | Course-completion certificates or external certifications? | Course/programme certificates; external certifications only as profile entries **[Q-18]**. |
| A-04 | "Trainer Performance" | No formula. | Composite proposed in R-01 **[Q-16]**. |
| A-05 | "Active Students" | No definition. | Activity in last 7/30 days **[Q-05]**. |
| A-06 | "IDE" | Full IDE vs simple runner. | Simple multi-language runner (Playground); not a full IDE. |
| A-07 | "Real-world projects" | Guided vs free projects. | Guided briefs with rubric; free projects as profile entries. |

### 4.7 Assumptions register

| ID | Assumption | Impact if wrong | Confirm? |
|---|---|---|---|
| A-01 | Client is an India-based cohort training institute; students are adults (18+) | Consent flows, guardian data, payment/tax integrations | Yes |
| A-02 | Single institute, single brand (no multi-tenant SaaS) | Data model would need tenant scoping from day one | Yes |
| A-03 | English-only UI at launch | i18n framework still added, but no translations | Yes |
| A-04 | Students are enrolled by the institute (invite-only), not self-registered | Public sign-up, payments and marketing pages would be added | Yes |
| A-05 | Live classes are delivered with an external tool (Zoom/Meet) and joined by link | Native integration would add API work and cost | Yes |
| A-06 | Videos are institute-owned recordings hosted on a paid video service with signed playback | If YouTube-unlisted is acceptable, cost drops but control drops | Yes |
| A-07 | Code execution languages at launch: Java, Python, JavaScript, C, C++, SQL; HTML/CSS/JS in browser | Adds/removes runtime images | Yes |
| A-08 | No payments, invoicing or fee tracking in scope | Adds a Payments module and gateway integration | Yes |
| A-09 | No native mobile apps; responsive web app (installable PWA) | Adds a separate mobile project | Yes |
| A-10 | Scale target: ≤ 5,000 students, ≤ 500 concurrent users, ≤ 50 concurrent code submissions | Sizing of workers and database | Yes |
| A-11 | Placement team and trainers will use the platform | Otherwise those portals shrink to admin-only screens | Yes |
| A-12 | AI features are desired but budget-gated and can ship after MVP | Otherwise AI moves earlier with higher cost | Yes |
| A-13 | Hosting in an India or Singapore region on a VPS/cloud with a managed PostgreSQL | Region affects vendor choice and latency | Yes |
| A-14 | Data protection follows India's DPDP Act principles (consent, purpose limitation, erasure on request) | Extra compliance work if other jurisdictions apply | Yes |

---
