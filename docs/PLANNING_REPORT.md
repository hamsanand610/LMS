# Learning & Placement Platform — Requirements, Architecture and Implementation Planning Report

> **Status note, 2 October 2026 — historical document.** The client approved this report on 13 September 2026 (recorded in `docs/PROGRESS_LOG.md`). On 2 October 2026 the client reset the product direction: SI Academy is an enterprise learning management and AI learning platform, and the controlling plan is now `docs/ROADMAP.md`, with the direction set out in `docs/product/PRODUCT_DIRECTION.md`. This report's requirements and feature catalogue (F-01…F-28, including the AI features F-23 and F-24) remain the requirements reference; its phase plan and release tiers (§19) are superseded. Nothing below this note has been changed.

| Field | Value |
|---|---|
| Project | Custom educational Learning Management & Placement Platform (working codename: **LMS**) |
| Document version | 0.1 — Draft for client review |
| Date | 13 September 2026 |
| Prepared by | Solution architecture team (AI-assisted, Claude Fable 5.1) for the freelance engagement |
| Status | **DRAFT — awaiting review and feedback (Workflow Step 6)** |
| Next step | Client review → revisions (Step 7) → approval → project structure and backlog (Step 8) → development (Step 9) |

> **Reading guide.** Identifiers are used throughout so that requirements can be traced to features, pages, data, APIs and phases: `CR-` client-stated requirement, `IR-` implied requirement, `F-` feature, `P-` page, `E-` entity, `PH-` phase, `Q-` open question, `A-` assumption, `R-` risk. Items marked **[CONFIRM]** need a client decision. Items marked **[ASSUMPTION]** are working assumptions recorded in §4.7 and §21. Nothing in this document should be treated as approved scope until the Approval Checklist in §24 is signed off.

## Table of contents

1. Executive Summary
2. Project Context
3. Source Materials Reviewed
4. Client Requirements Analysis
5. Reference Portal Analysis
6. Product Vision and Scope
7. User Roles and Permissions
8. Complete Page and Navigation Inventory
9. Functional Feature Specifications
10. Coding Lab and Assessment Analysis
11. UI/UX Design Strategy
12. Recommended Technology Stack
13. System Architecture
14. Database Architecture
15. API Architecture
16. Security Plan
17. Testing Strategy
18. Deployment and Operations
19. Development Roadmap
20. Complexity, Cost and Risk Analysis
21. Open Questions and Decisions Required
22. Claude Development Operating Rules
23. Final Recommendations
24. Approval Checklist
- Appendix A. Glossary
- Appendix B. Requirement traceability matrix
- Appendix C. Sources

---

## 1. Executive Summary

**What is being built.** A custom, institute-grade training and placement platform for a coding-education startup. It must let an institute run cohort-based programmes end to end: enrol students into batches, deliver recorded and live lessons, give students structured practice (multiple-choice, coding, SQL, web and debugging exercises), run assignments, tests and projects, track attendance and progress, issue certificates, manage placement drives with hiring companies, and give management an analytics dashboard with Excel/PDF exports. The Tap Academy "TAI" portal is the functional and UX reference; the product must be an improved, modern and maintainable platform rather than a copy.

**What the source material actually contains.** The client ZIP holds four WhatsApp screenshots and nothing else: one hand-typed list titled "Admin Dashboard" (15 metrics) and a three-part list titled "GUVI Student Portal Features" (7 groups, 33 bullet points). The second list carries AI-assistant citation chips, which means it is a summary of GUVI's public product structure rather than a bespoke specification. Together these are a **feature wish-list**, not a requirements document: there are no workflows, data definitions, non-functional requirements, trainer or placement-team workflows, branding, volumes, or budgets. This report expands the 48 client bullets into 48 client-stated requirements (`CR-A01…A15`, `CR-S01…S33`) plus 25 implied requirements (`IR-01…IR-25`) that must exist for the stated ones to work (for example: you cannot show "Company-wise Placements" without a module to record companies, drives and offers).

**What the reference portal confirmed.** The in-app browser session was already signed in to the reference portal as a student account, so the student area could be inspected read-only (no credentials were entered or seen, no data was changed, and no personal data from that account appears in this report). The portal validates the module set the client wants and adds useful patterns the client list omits: a live-class schedule calendar, sequentially unlocked practice modules with per-question attempts/time/marks, company-specific interview kits, a placement-drive board with eligibility rules, a document-verified student profile with multiple resumes and a resume generator, an "employability score", practice streaks, a batch leaderboard, and a multi-mode AI study assistant. Trainer and admin portals are not visible to a student account, so those workflows are proposed here from first principles and marked for confirmation.

**Key conclusions.**

1. The product naturally splits into four portals over one platform: **Student**, **Trainer**, **Admin/Operations**, and **Placement**. The client list covers only the first and a dashboard for the third; the other two are implied and are proposed in §7–§9.
2. The four practice product names in the client list (CodeKata, WebKata, SQLKata, FixTheCode) are **HCL GUVI brand names**. The platform must use its own names (this report uses *Code Practice*, *Web Lab*, *SQL Lab*, *Debug Challenges* and *Playground* as working names) **[CONFIRM]**.
3. The two features with the highest cost and risk are **secure code execution** and **AI features**. Both are justified by the requirements, but both must be isolated from the core application, metered, and delivered in later phases behind feature flags. Running student code inside the main application server is explicitly ruled out (§10).
4. The recommended stack is a **single-language TypeScript platform**: Next.js 16 (web), NestJS 12 (API and workers), PostgreSQL with Prisma, Redis (cache, queues, rate limits), S3-compatible object storage (Cloudflare R2), a hosted video service (Bunny Stream or Cloudflare Stream), self-hosted **Judge0** for code execution on an isolated worker host, and the **Claude API** for AI features. Everything runs in Docker locally and in production (§12–§13, §18).
5. Delivery is phased with approval gates (§19). MVP (authentication, roles, admin and student management, batches, courses and lessons, live schedule, attendance, assignments with MCQ and coding questions, tests, progress, notifications, basic reports and exports) is estimated at **14–18 weeks** for a 2–3 person team; Standard scope (SQL/web/debug labs, projects, certificates, placement module, feedback, streaks and leaderboards, richer reports) adds **8–12 weeks**; Advanced scope (AI assistant, AI mock interviews, resume builder, advanced analytics) adds **6–10 weeks**. These are planning estimates, not a quotation.
6. **Thirty-one open questions need client answers** (§21). Nine of them, plus confirmation of the practice-module names, block Phase 1: product name; brand assets; expected volumes and service levels; hosting region and vendor; whether trainers and placement coordinators will use the platform; whether payments are in scope (not mentioned, so treated as out of scope); login method (email/password versus mobile OTP); video hosting choice and library volume; and invite-only versus self-registration. The remaining questions (live-class tool, attendance method, programming languages, SQL dialect, AI budget and model, certificate design, integrity level, and others) are needed before the phase that uses them.

---

## 2. Project Context

### 2.1 The client and the business problem

The client is a startup training institute **[ASSUMPTION A-01: India-based, cohort/batch-driven, placement-oriented coding programmes such as Java/Python full-stack]**. Such institutes typically run multi-month batches with daily live classes, weekly tests, large question banks for practice, and a placement team that sources company drives for graduating students. Today this is usually spread across a video platform, a spreadsheet of students, WhatsApp groups, a form tool for tests and a manual placement tracker. The platform must consolidate this into one product with a single student identity, so that learning activity, assessment results, attendance and placement outcomes are connected and reportable.

### 2.2 Why a custom platform instead of an off-the-shelf LMS

- Off-the-shelf LMSs (Moodle, Canvas, Teachable-style tools) do not model **batches, attendance, company question kits, placement drives, or coding labs** without heavy customisation.
- Per-seat SaaS pricing scales badly for institutes with thousands of students at low fees.
- The institute wants its own data, branding and placement pipeline as a competitive asset.
- The reference portal demonstrates that a purpose-built product for this market is viable and what students expect.

### 2.3 Reference product

- Reference portal: `https://tai.thetapacademy.com/` (student portal of Tap Academy, Bengaluru). Used **only** as a functional and UX reference; no code, branding, content or data is copied.
- Public site: `https://thetapacademy.com/` describes the portal as providing recorded sessions, weekly tests, daily practice questions, company question banks, streaks, leaderboard, an "employability score", an AI doubt bot and placement drives.

### 2.4 Constraints and guiding principles

| Constraint | Consequence for the plan |
|---|---|
| Small development team (2–3 engineers) and startup budget | One primary language (TypeScript), boring and well-documented technologies, managed services where they remove operational burden, no microservice sprawl. |
| Must run locally in Docker and be easy to maintain | Docker Compose for local development; the same images deployed to staging and production; infrastructure kept to a handful of containers plus a managed database. |
| Indian student audience **[A-01]** | Mobile-first responsive design (most students will use phones), low-bandwidth video playback options, `+91` defaults, IST timezone display, SMS/WhatsApp OTP only after telecom (DLT) registration, Digital Personal Data Protection Act (DPDP, 2023) considerations. |
| Untrusted code execution is required | Separate, sandboxed execution service on an isolated host; never inside the API process. |
| AI features requested | Delivered behind feature flags with per-student quotas and budget alerts; never a hard dependency of core learning flows. |
| Future AI-assisted development | This report doubles as the persistent project context; §22 defines the operating rules for AI-assisted development. |

### 2.5 Engagement workflow

The workflow agreed in the brief is followed strictly: this report (Steps 1–5) → client review (Step 6) → revision (Step 7) → approved report → project structure, conventions and backlog (Step 8) → phased development only after explicit approval (Step 9). No application code has been written.

---

## 3. Source Materials Reviewed

### 3.1 Client ZIP contents

The attached archive `WhatsApp Unknown 2026-09-13 at 4.07.14 PM.zip` (307,728 bytes) contained exactly four files. Copies are stored in the project at `docs/source-materials/` with descriptive names.

| # | Original file | Stored as | Size (px) | Content |
|---|---|---|---|---|
| 1 | `WhatsApp Image 2026-08-19 at 4.15.52 PM.jpeg` | `client-req-01-admin-dashboard.jpeg` | 1069×1230 | Heading "Admin Dashboard" with 15 bullet metrics: Total Students; Active Students; Batch-wise Students; Course-wise Students; Attendance; Course Completion %; Assessment Scores; Assignment Status; Project Status; Trainer Performance; Placement Status; Company-wise Placements; Certificates Issued; Student Feedback; Reports & Excel/PDF Export. |
| 2 | `WhatsApp Image 2026-08-19 at 4.15.52 PM (1).jpeg` | `client-req-02-student-portal-p1.jpeg` | 1080×1048 | Heading "GUVI Student Portal Features". Section 1 *Student Dashboard*: overall learning progress; course progress; webinar and workshop progress; interview and project progress; upcoming sessions and calendar. Section 2 *Courses & Learning*: self-paced video courses; live classes; course materials and learning resources; course completion tracking; certifications. Contains "Guvi" citation chips. |
| 3 | `WhatsApp Image 2026-08-19 at 4.15.53 PM.jpeg` | `client-req-03-student-portal-p2.jpeg` | 1080×1377 | Section 3 *Coding Practice*: CodeKata (coding problems); WebKata (web-development practice); SQLKata (SQL practice); FixTheCode (debugging/problem-solving); IDE (online coding environment). Section 4 *Projects & Assessments*: real-world projects; assignments; skill assessments; project/portfolio development. Section 5 *Career & Placement*: AI mock interviews; resume building; portfolio building; interview preparation; placement/career guidance. Contains "Guvi +1" citation chips. |
| 4 | `WhatsApp Image 2026-08-19 at 4.15.53 PM (1).jpeg` | `client-req-04-student-portal-p3.jpeg` | 1080×825 | Section 6 *AI Support*: AI learning assistant; doubt clarification; coding assistance; AI-powered interview practice. Section 7 *Student Profile*: personal profile; skills; projects; learning progress; resume/profile information. Contains "Guvi" citation chips. |

Observations about the materials:

- There are **no documents, spreadsheets, diagrams, wireframes, brand assets or written workflows**. Every requirement below is derived from these 48 bullet points plus the reference portal.
- Screenshots 2–4 are a screenshot of an AI-assistant answer about GUVI's product (the citation chips are the give-away). The names CodeKata, WebKata, SQLKata, FixTheCode and "IDE" are GUVI product names. The client's intent is read as "we want features like these", not "we want these names".
- The admin list (screenshot 1) appears to be the client's own words and is the strongest signal of what management actually wants to see.

### 3.2 Reference portal inspection

The reference portal was opened in the desktop app's built-in browser. The public entry page is a combined *Login / Signup* screen (mobile number with `+91` country selector and "Continue with OTP", plus "Login with email" for existing accounts). The browser session turned out to be **already authenticated as a student account**; no credentials were requested, entered or seen by the assistant. The inspection was limited to student-facing pages, was read-only (no submissions, applications, profile edits, notification reads, cookie-consent clicks or theme changes were made), and no personal data from that account is reproduced here. The session redirected back to the login page at the end of the walkthrough; nothing was logged out deliberately.

| Route inspected | Page | Inspected how |
|---|---|---|
| `/login` | Login / Signup (OTP + email) | Desktop 1024 px and mobile 390 px screenshots, accessibility tree |
| `/` | Student dashboard | Screenshot, accessibility tree, network request list |
| `/courses` | Course catalogue (enrolled) | Screenshot, accessibility tree |
| `/courses/{id}` | Course player with curriculum | Screenshot, accessibility tree |
| `/schedule` | Live-class monthly calendar | Screenshot, accessibility tree |
| `/tests` | Tests: Upcoming / Contests / History tabs, self-paced practice | Screenshot, accessibility tree (History tab opened) |
| `/assignments` | Assignments overview | Screenshot, accessibility tree |
| `/assignments/{id}?viewMode=tree-view` | Assignment module tree and question list | Screenshot, accessibility tree |
| `/companyQuestions` | Company question kits list | Screenshot, accessibility tree |
| `/companyQuestions/{id}` | Company kit viewer (PDF sample paper) | Screenshot, accessibility tree |
| `/jobs` | Placement drives board | Screenshot, accessibility tree |
| `/profile` | Student profile (tabs, resumes, verification) | Screenshot, accessibility tree (field structure only recorded) |
| `/askTai` | AI study assistant entry screen | Screenshot, accessibility tree |

**Not inspected** (and therefore not claimed): notification panel, QR-code scan flow, Bookmarks page, the test-taking screen, test result and test leaderboard pages, the coding-question editor screen, job detail ("Know more"), course Discussions/Reviews tabs, the report-issue page, the trainer or admin portals (not reachable from a student account). Where this report describes those areas it is a proposal, not an observation. If the client wants a deeper authenticated inspection (for example of the test-taking or coding screens) during the revision round, the client can sign in privately in the app browser and the inspection can be extended.

Technical observations that are visible from any browser and are recorded only at a high level: the portal is a single-page application talking to a versioned REST API, served behind Cloudflare, with a light/dark theme, a third-party live-chat widget (Zoho SalesIQ) and a cookie-consent banner. No source code was copied or reused.

### 3.3 Public web sources consulted

Used for feature context and to verify technology facts and prices; full list in Appendix C.

- Tap Academy public site and placements page (feature descriptions: recorded sessions, weekly tests, daily practice, company question banks, TAI bot, streaks, leaderboard, employability score, mock interviews, hiring partners).
- HCL GUVI product pages (CodeKata, WebKata, SQLKata, FixTheCode, IDE) — marketing-level descriptions only.
- Judge0 (GitHub README and judge0.com), Piston (GitHub README) — code-execution engines, licences, sandboxing, cloud pricing.
- Cloudflare Stream and R2 pricing pages, Bunny Stream pricing (via search), Resend pricing, Razorpay pricing, Neon pricing, Hetzner Cloud pricing (via search).
- Release information for Next.js 16, NestJS 12, Prisma 7/8 and Drizzle ORM 1.0 (release candidate).

### 3.4 Limitations

- No client interview has taken place; every interpretation of a bullet point is recorded as an assumption or open question.
- Trainer, admin and placement-team workflows are not visible in the reference portal and are proposed here.
- Third-party prices are quoted as published on the dates checked (September 2026) and must be re-verified at procurement.
- Effort estimates are planning ranges for scoping and sequencing, not a commercial quotation.

---
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
## 5. Reference Portal Analysis

### 5.1 Method and boundaries

The reference portal was analysed as a **product**, not as code. Observations come from the pages listed in §3.2, viewed read-only in an already-authenticated student session. The purpose was to learn workflows, information architecture, navigation patterns and feature depth, and to decide what to adopt, adapt or avoid. No proprietary content, branding, code or personal data is reproduced. Trainer and admin sides of the reference product were not visible and are not described.

### 5.2 Information architecture observed

The student portal is an application shell with a left navigation rail and a content area. Navigation items, in order: **Dashboard, Courses, Tests, Assignments, Company Questions, Jobs, Bookmarks**, then a secondary group **Ask TAI** (AI assistant) and **Profile**. The rail also holds a notifications bell with an unread count, a **Scan QR code** action (most likely attendance or event check-in), a global search box, an **Employability Score** ring (out of 100), a light/dark theme toggle, the signed-in user card and log-out. A third-party live-chat widget floats bottom-right and a cookie banner overlays the bottom of every page until dismissed. On narrow screens the rail collapses to icons and a "Menu" button appears.

### 5.3 Page-by-page observations

| Page | What it does | Who uses it | How the workflow operates | Useful for our project | What should be improved | Required by client? | Tier for us |
|---|---|---|---|---|---|---|---|
| **Login / Signup** | Mobile number + OTP for login *and* signup; "Login with email" for existing accounts; marketing hero with tagline listing modules. | Student | Enter mobile → OTP → account created or opened; email path for existing users. | Combined flow reduces friction; single field first; clear helper texts. | OTP-only signup creates unverified accounts with no institute control; SMS costs and DLT compliance; no visible password/2FA option for staff. We propose invite-based accounts with email/password first, OTP optional. | Implied (IR-01) | MVP (email), Standard (OTP) |
| **Dashboard** | Announcement banner carousel; "My Learning" progress bars (courses, assignments, tests) with resume cards; practice streak with calendar heat-map, current/longest streak and total correct submissions; placement drive stats (eligible vs applied); skills acquired with level and rating; batch leaderboard with own rank; attendance widget with date range and subject tabs. | Student | Landing page after login; resume cards deep-link into the last lesson/assignment. | Almost every widget maps to a client requirement (CR-S01, S02, S05, S30, S32, CR-A05 view). Streak heat-map and "pick up where you left off" are strong engagement patterns. | The banner carousel (marketing) takes the most valuable space; no "today's sessions" block; employability score shows 0/100 without explanation; leaderboard shown by default may demotivate; too many widgets for a phone screen. We propose "Today" first (sessions, deadlines), progress second, engagement widgets third, and an explained score. | Yes (CR-S01–S05) | MVP |
| **Courses** | Enrolled courses as cards (thumbnail, modules count, total duration, progress or "Ready to start"); tabs All / In progress / Completed with counts; search; "No live classes right now" strip with "View schedule". | Student | Browse → open course. | Card metadata and status tabs are exactly right; live-class strip ties recorded and live learning together. | Course list mixes real courses with utility containers ("Notes", "Live Class Recordings [batch]"); no filters by subject/level; no indication of mandatory vs optional. We model recordings and notes as resources, not courses. | Yes (CR-S06, S08) | MVP |
| **Course player** | Video player on the left with lesson title, tags, tabs Overview / Discussions / Reviews and description; right sidebar with completion ring, "Course content" stats (modules, hours, question count), lesson search and an accordion of modules listing lessons with durations, done markers and embedded "Code · Solve" practice questions. | Student | Pick lesson → watch → next; practice questions inline within the module. | Curriculum sidebar with search and inline practice is the right pattern; module-level done counts help orientation. | Video loads slowly (spinner); sidebar very long for 14-module courses (no collapse-all); no keyboard shortcuts or speed presets visible; resources/attachments not visible per lesson. We add per-lesson resources, "up next", speed/quality controls, and mobile curriculum drawer. | Yes (CR-S06, S08, S09) | MVP |
| **Schedule** | Month calendar of live classes (program/batch labels per day), previous/next month, "Programs" filter. | Student | View upcoming classes. | Directly satisfies CR-S05/S07; program filter is useful for multi-subject batches. | No join links or times visible at the calendar level; no week/agenda view for phones; no reminders visible. We add agenda view, times, join button and reminders. | Yes (CR-S05, S07) | MVP |
| **Tests** | Tabs Upcoming / Contests / History with counts; search; "Self-paced practice" by subject; history cards show test name, status, duration, type (Weekly Test, On Demand Test, Company Test), date/time, Result and Leaderboard buttons. | Student | Take scheduled tests; practise on demand; review results and rank. | Test types map to institute practice (weekly, on-demand, company drives); self-paced practice by subject is a good bridge to CR-S18. | Some durations look like data errors (a "weekly test" of 25 h); no visible instructions/eligibility before start; no filters by subject in history. We add validation, instructions page, subject filters and result analytics. | Yes (CR-S18) | MVP |
| **Assignments** | Overview stats (overall progress, questions solved of total, assignments done, questions attempted, marks earned); tabs; search; cards with level badge (Beginner/Intermediate/Advanced), modules, questions, marks earned/total, progress, solved/remaining. | Student | Choose an assignment → module tree. | The stats header and card metrics are exactly what CR-S17/CR-A08 need; level badges are simple and clear. | Naming inconsistencies and typos in content; "Assignments done 0/9" while progress is 35% confuses (done = 100% only). We define "completed" thresholds explicitly and show both. | Yes (CR-S17) | MVP |
| **Assignment module view** | Header with description and stats (modules completed %, solved, attempted, marks obtained); module rail with **sequential unlocking** ("Unlocks after X"); question list with title, type (MCQ), attempts, time spent, difficulty, marks, Review and bookmark; "Share achievement"; total time spent. | Student | Work through modules in order; review answered questions. | Sequential unlocking, per-question attempt/time/difficulty metadata and review are valuable and cheap to implement; sharing achievements supports marketing. | Only MCQ visible in the sample; the module rail requires horizontal swiping on desktop; no explanation of unlock rules. We show unlock rules and support all question types in one list. | Yes (CR-S17) | MVP |
| **Company Questions** | 178 companies as cards with technology tags and favourite toggle; tabs All / In progress / Completed / Favourites; technology filter chips; company kit page with document list (e.g. sample paper PDF with page count), in-page PDF viewer with pagination and bookmark, "Videos, notes and questions curated for this company". | Student | Pick a company → study its kit → (elsewhere) attempt company tests. | Strong differentiator for placement preparation; maps to CR-S23/S24. | Kits are mostly PDFs; no linkage from a kit to the related company test or drive; progress semantics of "In progress/Completed" unclear. We link kits ↔ drives ↔ tests and track kit completion explicitly. | Yes (CR-S23, S24) | Standard |
| **Jobs** | Tabs Technical / Non-technical / Internal / Applied drives; search; employability score chip; job cards with job ID, title, status, location, salary range, qualification, passing years, expiry ("Expired N days ago"), Know more. | Student | Browse drives → know more → apply (not inspected). | Card fields define our Drive entity; "Applied drives" tab is the student's tracker; eligibility by passing year/qualification is visible. | Default list is dominated by closed/expired drives; no eligibility indicator on cards; no sort; salary shown as "up to X LPA" only. We default to open drives, show eligibility badges and application status pipeline. | Yes (CR-S24) | Standard |
| **Profile** | Header with photo upload and verification badge; tabs Overview / Personal info / Education / Projects / Experiences / Certificates; side panel with documents-verified status, course progress, assignments, resumes (up to 4 PDFs ≤ 1 MB, default resume), quick links (help/report issue, leaderboard); "Generate resume"; personal-info form with many fields (identity, contacts including guardian, social links, current and native location, address, academic gap, enrolment mode, relocation readiness, GitHub/portfolio links, summary, skills, hobbies, languages, service-agreement readiness, placed flag, document upload). | Student, staff (verification) | Fill profile → upload documents → staff verify → resumes maintained for drives. | Field set and tab structure are a ready template for CR-S29–S33 and for placement eligibility; multi-resume with default is a good pattern. | Very long single form with many mandatory fields; personal fields (guardian, address, Instagram) raise privacy questions; no completeness indicator; no explanation of what "verified" means. We split into steps with progress, minimise fields, add completeness score and consent text. | Yes (CR-S29–S33) | MVP |
| **Ask TAI** | AI assistant entry with six modes: Resolve a query (code doubts), Learn concepts, Take a quiz, Aptitude mentor, Coding problem, SQL practice. | Student | Pick a mode → chat. | Mode-based entry is better than a blank chat box; maps exactly to CR-S25–S27. | No visible grounding to the current lesson, no quota/usage indication, no trainer escalation. We add context-aware entry points, quotas and escalation. | Yes (CR-S25–S27) | Advanced |
| **Notifications / QR / Bookmarks / Search** | Bell with unread count; QR scan action; bookmarks page; global search. | Student | Not opened. | Confirms need for a notification centre (IR-18), bookmarks (R-06) and search (IR-19). | Unknown. | Implied | MVP (notifications, search), Standard (QR) |

### 5.4 Cross-cutting patterns observed

| Area | Observation | Adopt / adapt / avoid |
|---|---|---|
| Authentication | OTP-first combined login/signup; email login for legacy accounts. | Adapt: invite-first, email/password + optional OTP; separate staff login with stronger policies. |
| Layout | Persistent left rail, icon-only at medium widths, content cards on a light grey ground; light/dark theme. | Adopt shell and theme; add labels at ≥ 1024 px, bottom tab bar on phones. |
| Responsiveness | Login is fully responsive; app pages collapse the rail and rely on a "Menu" button; some widgets (attendance calendar, module rail) need horizontal scrolling. | Adapt: design every widget for 360 px first. |
| Forms | Long forms with asterisks for mandatory, selects with search, tag inputs (press Enter to add), file inputs with type/size hints. | Adopt tag inputs and hints; avoid single giant forms. |
| Tables and lists | Card grids rather than tables; tabs with counts; search boxes on each list; filter chips for technologies. | Adopt tabs-with-counts and chips; add real tables with sorting for staff. |
| Search and sorting | Per-page search; no global sort controls seen. | Add sort and saved filters for staff lists. |
| Notifications | Bell with count; banner carousel for announcements. | Adopt notification centre; replace carousel with a compact announcements list. |
| Gamification | Streaks with heat-map, points leaderboard by batch, share to LinkedIn, "share achievement". | Adopt as optional (configurable per institute) in Standard; make leaderboards opt-in/anonymisable. |
| Attendance | Student-facing calendar with present/absent/week-off, date filter and subject tabs; QR scan action suggests in-class check-in. | Adopt; add trainer roll-call and correction workflow. |
| Placement | Drives with eligibility fields; company kits; applied tracker; employability score. | Adopt pipeline and kits; define the score transparently or drop it. |
| Support | Third-party chat widget; "Need help?" → report issue page. | Adapt: in-app "report an issue" form + email; chat widget optional integration. |
| Consent/cookies | Cookie banner from the chat vendor blocks part of every page. | Avoid: no third-party cookies by default; a single unobtrusive consent only if analytics are enabled. |
| Content quality | Some inconsistent naming and durations in content. | Add validation and content review states (draft → review → published). |

### 5.5 Summary of what to adopt, adapt and avoid

**Adopt.** Module set and navigation order; curriculum sidebar with inline practice; sequential module unlocking; per-question attempt/time/difficulty/marks; test types (weekly, on-demand, company, contest); company kits; drive cards with eligibility fields; multi-resume profile with verification; monthly schedule; streak and progress widgets; light/dark theme; mode-based AI entry.

**Adapt.** Login (invite-first, email/password, optional OTP); dashboard priority (today's sessions and deadlines first); recordings as lesson type, not courses; forms split into steps with completeness; leaderboards optional; announcements compact; mobile-first widgets; explicit definitions of progress and scores.

**Avoid.** Marketing carousel on the dashboard; unexplained scores; third-party cookie banners; closed drives as the default view; giant single-page forms; unlabeled icon rails; vendor product names.

---
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
## 8. Complete Page and Navigation Inventory

### 8.1 Conventions that apply to every page

- **Routes.** One web application with route groups: public (`/`), auth (`/login`, …), student portal (short routes: `/dashboard`, `/courses`, …), trainer portal (`/trainer/*`), admin portal (`/admin/*`), placement portal (`/placement/*`). Route parameters use opaque IDs (`{courseId}`); public pages may use slugs.
- **Permission requirement.** Every non-public page requires an authenticated session and the permission listed; the API enforces it, the UI hides what the user cannot do.
- **Standard states** (implemented once in the design system and reused): *loading* — skeleton placeholders matching the final layout, never a blank screen or spinner-only for lists; *empty* — illustration-free, one sentence explaining what will appear here and a primary action if the user can create the item; *error* — inline message with retry for recoverable errors, a full-page state with error reference ID for unrecoverable ones; *offline* — banner and disabled submit actions; *forbidden* — "You do not have access" with a link back; *not found* — 404 page with search.
- **Mobile behaviour** (≤ 768 px): navigation moves to a bottom tab bar (5 primary items) plus a "More" sheet; tables become card lists; side panels become bottom sheets or full-screen steps; editors and test screens run full-screen. Only exceptions are noted per page.
- **Acceptance criteria** are listed per page in short form; the feature-level criteria in §4.4 and §9 also apply.

### 8.2 Sitemap

```
/ (public)
├── /verify/{certificateCode}          certificate verification
├── /privacy  /terms  /help            legal and help
└── /p/{slug}                          public portfolio (Advanced)

/login  /login/otp  /invite/{token}  /forgot-password  /reset-password/{token}  /verify-email/{token}  /logout

STUDENT PORTAL
/dashboard
/schedule
/courses ─ /courses/{courseId} ─ /courses/{courseId}/lessons/{lessonId}
/assignments ─ /assignments/{id} ─ /assignments/{id}/q/{questionId}
/tests ─ /tests/{id} (instructions) ─ /tests/{id}/attempt ─ /tests/{id}/result
/practice ─ /practice/problems ─ /practice/problems/{slug} ─ /practice/debug ─ /practice/sql ─ /practice/web ─ /playground
/projects ─ /projects/{id}
/placements ─ /placements/{driveId} ─ /placements/applications ─ /placements/companies/{companyId}
/certificates
/profile ─ /profile/edit/{section} ─ /profile/resumes ─ /profile/documents
/notifications  /bookmarks  /search
/assistant ─ /assistant/{conversationId} ─ /assistant/interview   (Advanced)
/doubts (Standard)  /feedback/{formId}  /events (Standard)

TRAINER PORTAL /trainer
/trainer (dashboard) ─ /trainer/schedule ─ /trainer/batches ─ /trainer/batches/{batchId}
/trainer/sessions/{sessionId}/attendance
/trainer/assignments ─ /trainer/assignments/{id} (progress)
/trainer/tests ─ /trainer/tests/{id} (monitor) ─ /trainer/tests/{id}/grading
/trainer/projects/{projectId}/reviews
/trainer/doubts (Standard) ─ /trainer/students/{studentId} ─ /trainer/feedback ─ /trainer/question-bank (if permitted)

ADMIN PORTAL /admin
/admin (dashboard)
/admin/users ─ /admin/users/{id}
/admin/students ─ /admin/students/import ─ /admin/students/{id}
/admin/trainers ─ /admin/trainers/{id}
/admin/programs ─ /admin/batches ─ /admin/batches/{id} (tabs: overview, students, trainers, timetable, attendance, content, reports)
/admin/courses ─ /admin/courses/{id}/edit ─ /admin/courses/{id}/publish
/admin/question-bank ─ /admin/question-bank/new ─ /admin/question-bank/{id} ─ /admin/question-bank/import
/admin/assignments ─ /admin/assignments/{id}
/admin/tests ─ /admin/tests/{id} ─ /admin/tests/{id}/schedule ─ /admin/tests/{id}/results
/admin/projects ─ /admin/certificates ─ /admin/certificates/templates ─ /admin/feedback ─ /admin/announcements ─ /admin/events
/admin/reports/* ─ /admin/exports
/admin/settings/{general|branding|roles|integrations|feature-flags|email-templates|audit-log|privacy|system-health}

PLACEMENT PORTAL /placement
/placement (dashboard) ─ /placement/companies ─ /placement/companies/{id}
/placement/drives ─ /placement/drives/new ─ /placement/drives/{id} (pipeline board)
/placement/applications ─ /placement/kits ─ /placement/kits/{id} ─ /placement/students ─ /placement/reports
```

### 8.3 Navigation structure

| Portal | Primary navigation (desktop sidebar order) | Mobile bottom tabs | Utility bar |
|---|---|---|---|
| Student | Dashboard · Schedule · Courses · Assignments · Tests · Practice · Projects · Placements · Certificates · Assistant (if enabled) | Home · Courses · Practice · Tests · More | Search, notifications, profile menu (profile, resumes, settings, theme, sign out) |
| Trainer | Dashboard · Schedule · Batches · Assignments · Tests · Projects · Doubts · Question bank (if permitted) | Home · Schedule · Batches · More | Same |
| Admin | Dashboard · Students · Trainers · Batches · Courses · Question bank · Assignments · Tests · Projects · Certificates · Feedback · Announcements · Reports · Settings | Not optimised (desktop-first), but usable | Same plus environment badge (staging/production) |
| Placement | Dashboard · Companies · Drives · Applications · Kits · Students · Reports | Not optimised | Same |

### 8.4 A. Public website

The client did not request a marketing website. Only functional public pages are in scope.

| ID | Page / route | Purpose | Role | Main components | Main actions | Data / API | Mobile | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| P-A01 | Landing `/` | Redirect signed-in users to their portal; show sign-in call to action for others | Public | Logo, product name, sign-in button, short description | Sign in | none | Single column | Signed-in user never sees it; unauthenticated user reaches login in one click |
| P-A02 | Certificate verification `/verify/{code}` | Let anyone verify a certificate | Public | Code input, result card (name, course, date, status), QR landing | Verify | `GET /public/certificates/{code}` | Single column | Valid code shows details; invalid shows "not found"; revoked shows revoked; rate-limited |
| P-A03 | Legal `/privacy`, `/terms` | Compliance text | Public | Rich text | — | CMS-less static content from settings | Single column | Editable by Super Admin |
| P-A04 | Public portfolio `/p/{slug}` (Advanced) | Shareable student portfolio | Public | Header, skills, projects, certificates, links | Share | `GET /public/portfolios/{slug}` | Single column | Only fields the student marked public are shown |

### 8.5 B. Authentication

| ID | Page / route | Purpose | Role | Main components | Main actions | Data / API | Mobile | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| P-B01 | Sign in `/login` | Email + password sign-in; link to OTP (Standard) | All | Form (email, password), remember me, forgot link, OTP link, error banner | Sign in | `POST /auth/login` | Full-screen form | Wrong credentials give a generic message; 5 failures trigger throttling; success redirects by role |
| P-B02 | OTP sign-in `/login/otp` (Standard) | Mobile OTP sign-in for existing accounts | Student | Mobile field with +91, OTP field, resend timer | Send OTP, verify | `POST /auth/otp/send`, `POST /auth/otp/verify` | Full-screen | OTP expires in 5 min; max 3 sends per 15 min; unknown mobile is not revealed |
| P-B03 | Accept invitation `/invite/{token}` | New user sets password and accepts terms | All | Name display, password + confirm, consent checkboxes | Activate | `POST /auth/invitations/{token}/accept` | Full-screen | Expired token shows a resend option; password policy enforced |
| P-B04 | Forgot password `/forgot-password` | Request reset email | All | Email field | Send | `POST /auth/password/forgot` | Full-screen | Always shows success text (no account enumeration) |
| P-B05 | Reset password `/reset-password/{token}` | Set new password | All | Password + confirm | Reset | `POST /auth/password/reset` | Full-screen | Token single-use, 30-minute validity; all sessions revoked after reset |
| P-B06 | Verify email `/verify-email/{token}` | Confirm email ownership | All | Status message | — | `POST /auth/email/verify` | Full-screen | Verified flag set; expired token offers resend |
| P-B07 | Sign out `/logout` | End session | All | — | — | `POST /auth/logout` | — | Refresh token revoked; redirected to login |

### 8.6 C. Student portal

| ID | Page / route | Purpose | Main components | Main actions | Data / API | Permission | Mobile | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| P-C01 | Dashboard `/dashboard` | Daily starting point | Today strip (sessions, deadlines), continue-learning cards, progress summary (overall, courses, assignments, tests), tasks due, announcements, streak (Standard), leaderboard (Standard, optional), attendance summary | Join session, resume, open task | `GET /me/dashboard` (aggregated) | student:self | Stacked widgets; today strip pinned first | AC-02.1–02.3; loads with skeletons; no widget shows data from another student |
| P-C02 | Schedule `/schedule` | Live classes, tests, deadlines, events calendar | Month/week/agenda toggle, programme filter, event chips with time, join button, recording link after class | Join, add to calendar (Standard) | `GET /me/schedule?from&to` | student:self | Agenda view default | Times in IST; join button active 15 min before start; cancelled sessions struck through |
| P-C03 | Courses `/courses` | Enrolled course catalogue | Tabs All/In progress/Completed with counts, search, sort, course cards (thumbnail, modules, duration, progress, next lesson) | Open course | `GET /me/courses` | courses:read (enrolled) | 1-column cards | Progress equals course page; empty state explains enrolment |
| P-C04 | Course overview `/courses/{courseId}` | Course description and curriculum | Header (title, progress, trainer), tabs Overview/Curriculum/Resources/Discussions (Standard), module accordion with lesson list, resume button | Start/resume, open lesson | `GET /courses/{id}`, `GET /courses/{id}/progress` | courses:read (enrolled) | Accordion collapsed by default | Locked modules show unlock rule; completed lessons ticked |
| P-C05 | Lesson player `/courses/{courseId}/lessons/{lessonId}` | Consume a lesson | Video player (signed URL, speed, quality, captions, resume), reading pane, resources list, notes, inline practice question, up next, curriculum sidebar (desktop) / drawer (mobile), mark complete, report issue | Play, complete, next, download resource, ask assistant (Advanced) | `GET /lessons/{id}`, `POST /lessons/{id}/progress`, `GET /files/{id}/url` | courses:read (enrolled) | Video full-width; sidebar as drawer | Resume within ±10 s; auto-complete at configured %; keyboard shortcuts work |
| P-C06 | Assignments `/assignments` | Practice sets overview | Stats header (overall progress, solved/total, marks), tabs, search, level filter, cards (level, modules, questions, marks, progress, due date) | Open | `GET /me/assignments` | assignments:read | Cards | Stats match detail pages; overdue badge |
| P-C07 | Assignment detail `/assignments/{id}` | Module tree and questions | Header stats, module list with lock state and unlock rule, question list (title, type, difficulty, marks, attempts, time, status, bookmark), share achievement (Standard) | Open question, review | `GET /assignments/{id}/me` | assignments:read | Modules as segmented list; questions as list | Locked module explains rule; review shows explanation when allowed |
| P-C08 | Question workspace `/assignments/{id}/q/{questionId}` | Answer a question | Type-specific pane: MCQ options; descriptive editor; coding editor with language selector, run with custom input, submit, verdict panel; SQL/Web panes (Standard); explanation after solve; navigation prev/next | Submit, run, bookmark, report issue | `POST /questions/{id}/submissions`, `GET /submissions/{id}` (poll or stream) | assignments:submit (own) | Full-screen editor with tabs (problem / code / output) | Attempt count, time and marks recorded; verdict within limits; cannot submit when locked or over attempt limit |
| P-C09 | Tests `/tests` | Scheduled and past tests | Tabs Upcoming/Live/History (counts), search, subject filter, cards (name, type, window, duration, status, result, leaderboard) plus self-paced practice subjects | Start, view result | `GET /me/tests` | tests:read | Cards | Only in-window tests startable; history shows scores when released |
| P-C10 | Test instructions `/tests/{id}` | Pre-test checklist | Instructions, sections, marks scheme, rules, system check (connectivity), start button | Start attempt | `POST /tests/{id}/attempts` | tests:attempt | Full-screen | Start creates exactly one active attempt |
| P-C11 | Test attempt `/tests/{id}/attempt` | Timed attempt | Server-synced timer, section tabs, question palette (answered/flagged/unanswered), question pane (all types), autosave indicator, submit dialog, full-screen prompt, tab-switch warnings | Answer, flag, navigate, submit | `PATCH /attempts/{id}/answers`, `POST /attempts/{id}/submit`, `GET /attempts/{id}/state` | tests:attempt (own) | Full-screen; palette as sheet | AC-07.1–07.4; resume after reload restores answers and timer |
| P-C12 | Test result `/tests/{id}/result` | Score and review | Score card, section scores, rank (if enabled), per-question review (if allowed), analytics (time per question) | Review, share (optional) | `GET /attempts/{id}/result` | tests:read (own, released) | Stacked | Hidden until release; review respects settings |
| P-C13 | Practice hub `/practice` | Entry to labs | Cards: Code Practice, Debug Challenges, SQL Lab, Web Lab, Playground; streak and solved stats | Open lab | `GET /me/practice/summary` | practice:use | Cards | Labs hidden if disabled by flag |
| P-C14 | Problem list `/practice/problems` (and `/debug`, `/sql`, `/web`) | Browse problems | Filters (topic, difficulty, company, status), search, sort, table/list (title, difficulty, acceptance, points, status) | Open | `GET /practice/problems?type=` | practice:use | List | Filters persist in URL; solved status accurate |
| P-C15 | Problem workspace `/practice/problems/{slug}` | Solve a problem | Statement (markdown, examples, constraints), editor, language selector, run/submit, results (per test case verdict, time, memory), submissions history, hints (Advanced), discussion (Standard) | Run, submit, reset, bookmark | `POST /practice/problems/{id}/submissions` | practice:use | Tabbed full-screen | AC-08.1–08.3 |
| P-C16 | Playground `/playground` | Free-form runner | Editor, language, stdin, output, save snippet | Run, save | `POST /execute` (quota) | practice:use | Tabbed | Rate limit message when exceeded |
| P-C17 | Projects `/projects`, `/projects/{id}` (Standard) | Project briefs and submissions | Brief, rubric, resources, milestones, submission form (repo URL, demo URL, zip), status timeline, review comments | Submit, resubmit | `GET /me/projects`, `POST /projects/{id}/submissions` | projects:submit | Stacked | AC-09.1–09.2 |
| P-C18 | Placements `/placements` (Standard) | Drives board | Tabs Open (default)/Applied/Closed, filters (role type, location, eligibility), cards with eligibility badge and deadline, employability/readiness indicator (if enabled) | Open drive | `GET /me/drives` | placements:read | Cards | Ineligible drives explain why; closed drives not default |
| P-C19 | Drive detail `/placements/{driveId}` | Drive description and application | Company card, description, package, location, rounds, eligibility checklist (met/unmet), apply button (profile completeness check), status timeline after applying | Apply, withdraw | `POST /drives/{id}/applications` | placements:apply | Stacked | AC-11.1–11.2 |
| P-C20 | My applications `/placements/applications` | Track pipeline | List with status chips, interview schedule, offer actions | Accept/decline offer | `GET /me/applications` | placements:read (own) | List | Status changes reflected within seconds of coordinator update |
| P-C21 | Company kit `/placements/companies/{companyId}` | Prepare for a company | Kit items (PDF viewer, video, question sets, notes), progress tracker, favourite, linked drives/tests | Mark item done, favourite | `GET /companies/{id}/kit` | placements:read | PDF viewer full-screen | Progress persists; bookmark works |
| P-C22 | Certificates `/certificates` (Standard) | Earned certificates | Cards with preview, download, share link, verification code | Download, share | `GET /me/certificates` | certificates:read (own) | Cards | AC-10.1–10.3 |
| P-C23 | Profile `/profile` | View own profile | Header (photo, completeness), tabs Overview/Personal/Education/Experience/Projects/Skills/Certificates/Documents, verification status | Edit section | `GET /me/profile` | profile:read (own) | Tabs as accordion | Completeness score correct |
| P-C24 | Profile edit `/profile/edit/{section}` | Edit one section | Section form with validation, save/cancel, consent text for sensitive fields | Save | `PATCH /me/profile/{section}` | profile:update (own) | Full-screen form | Validation inline; sensitive fields explained |
| P-C25 | Resumes `/profile/resumes` | Manage resumes | Upload (PDF, size limit), list, set default, remove, generate resume (Standard) | Upload, default, generate | `POST /me/resumes`, `POST /me/resumes/generate` | profile:update (own) | List | AC-12.1 |
| P-C26 | Documents `/profile/documents` | Upload verification documents | Upload per document type, status (pending/verified/rejected with reason) | Upload | `POST /me/documents` | profile:update (own) | List | Rejection reason visible |
| P-C27 | Notifications `/notifications` | Notification centre | List (unread first), filters, mark read/all read, preferences link | Open target, mark read | `GET /me/notifications`, `PATCH …/read` | notifications:read (own) | List | Badge count equals unread |
| P-C28 | Bookmarks `/bookmarks` | Saved questions/lessons/kits | Grouped list | Open, remove | `GET /me/bookmarks` | student:self | List | — |
| P-C29 | Search `/search?q=` | Find content | Results grouped (courses, lessons, questions, drives) | Open | `GET /search` | search:use | List | Only accessible content returned |
| P-C30 | Assistant `/assistant`, `/assistant/{conversationId}` (Advanced) | AI study assistant | Mode cards, chat thread with streaming, context chip (lesson/problem), quota indicator, escalate to trainer | Chat, escalate | `POST /ai/conversations`, `POST /ai/conversations/{id}/messages` (stream) | ai:use (flag) | Chat full-screen | AC-14.1–14.4 |
| P-C31 | Mock interview `/assistant/interview` (Advanced) | AI interview session | Setup (role, topics, duration), turn-based chat, timer, final feedback report | Start, end | `POST /ai/interviews` | ai:use (flag) | Full-screen | Report includes rubric scores and improvement points |
| P-C32 | Doubts `/doubts` (Standard) | Ask trainers | New doubt form (context auto-attached), list with status and answers | Ask, mark resolved | `POST /doubts` | doubts:create (own) | List | Trainer answer notifies student |
| P-C33 | Feedback form `/feedback/{formId}` (Standard) | Submit feedback | Rating scales, text, anonymity notice | Submit | `POST /feedback/{formId}/responses` | feedback:respond | Full-screen | AC-13.2 |
| P-C34 | Events `/events` (Standard) | Webinars/workshops | Upcoming/past, register, join, recording | Register, join | `GET /me/events` | events:read | Cards | Registration reflected in schedule |

### 8.7 D. Trainer portal

| ID | Page / route | Purpose | Main components | Main actions | Data / API | Permission | Mobile | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| P-D01 | Trainer dashboard `/trainer` | Day view for teaching | Today's sessions (start/join, attendance shortcut), pending grading count, unanswered doubts, batch health tiles (attendance %, assignment completion, last test average), at-risk students list | Start session, grade, answer | `GET /trainer/dashboard` | trainer:self | Stacked; sessions first | Only own batches; counts match detail pages |
| P-D02 | Schedule `/trainer/schedule` | Teaching calendar | Week view default, session cards, conflict warnings, request reschedule (Admin approves) | Mark live/complete, attach recording, request change | `GET /trainer/sessions` | sessions:read (batch) | Agenda | Attaching a recording creates the lesson entry |
| P-D03 | Batches `/trainer/batches`, `/trainer/batches/{batchId}` | Batch roster and health | Roster table (name, attendance %, progress, last active, scores), filters, tabs Overview/Students/Attendance/Assignments/Tests/Projects | Open student, export (batch) | `GET /trainer/batches/{id}/*` | batches:read (batch) | Cards | Sorting by any metric; export matches |
| P-D04 | Attendance marking `/trainer/sessions/{sessionId}/attendance` | Roll-call | Student list defaulting to present, toggle chips (present/absent/late/excused), search, bulk actions, notes, submit, correction mode (within window, reason required), QR display mode (Standard) | Mark, submit, correct | `PUT /sessions/{id}/attendance` | attendance:mark (batch) | Large touch targets, one column | AC-05.1–05.3 |
| P-D05 | Assignments `/trainer/assignments`, `/trainer/assignments/{id}` | Publish and monitor | Create from question bank (wizard: questions → modules → settings → batches), progress table per student, question-level stats, descriptive grading queue | Create, publish, grade | `POST /assignments`, `GET /assignments/{id}/progress` | assignments:create/publish (batch) | Table → cards | Publishing notifies students; grading updates marks |
| P-D06 | Tests `/trainer/tests`, `/trainer/tests/{id}` | Schedule and monitor | Create (wizard), schedule per batch, live monitor (started/submitted counts, flags), results table, release results | Create, schedule, release | `POST /tests`, `GET /tests/{id}/monitor` | tests:create/schedule (batch) | Table → cards | Monitor refreshes every 10 s |
| P-D07 | Grading `/trainer/tests/{id}/grading` | Manual grading | Queue of descriptive answers, rubric, marks entry, comments, next/prev, progress | Grade, finish | `PATCH /attempts/{id}/answers/{answerId}/grade` | tests:grade (batch) | Stacked | Marks saved per answer; totals recalculated |
| P-D08 | Project reviews `/trainer/projects/{projectId}/reviews` (Standard) | Review submissions | Submission list, rubric scoring, comments, status change | Approve, request rework | `PATCH /project-submissions/{id}/review` | projects:review (batch) | Stacked | AC-09.1–09.2 |
| P-D09 | Doubts `/trainer/doubts` (Standard) | Answer questions | Queue with context links, reply editor with code blocks, mark resolved, convert to FAQ | Answer, resolve | `POST /doubts/{id}/answers` | doubts:answer (batch) | List | Response time metric recorded |
| P-D10 | Student detail `/trainer/students/{studentId}` | 360° view (batch scope) | Profile summary (non-sensitive), attendance calendar, progress, submissions, test history, notes (private to staff) | Add note, message (notification) | `GET /trainer/students/{id}` | students:read (batch) | Stacked | Sensitive fields hidden |
| P-D11 | Question bank `/trainer/question-bank` (if permitted) | Author questions | Same as P-E09 with ownership filter | Create, edit own | see P-E09 | questions:create (own) | Desktop-first | Trainer-created questions flagged for review if policy requires |
| P-D12 | Feedback `/trainer/feedback` (Standard) | Own feedback aggregates | Ratings over time, comments (anonymised) | — | `GET /trainer/feedback` | feedback:read (own) | Stacked | No identifying data for anonymous forms |

### 8.8 E. Admin portal

| ID | Page / route | Purpose | Main components | Main actions | Data / API | Permission | Mobile | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| P-E01 | Admin dashboard `/admin` | The 15 metrics | Filter bar (date, programme, batch, course, trainer), KPI tiles with definitions on hover, trend charts (active students, attendance, completion, scores), alert list (low attendance batches, overdue assignments, pending verifications), quick actions, "data as of" stamp, export all | Filter, drill down, export | `GET /reports/dashboard` | reports:read (all) | Tiles stack | AC-01.1–01.4 |
| P-E02 | Users `/admin/users`, `/admin/users/{id}` | Staff accounts | Table (name, email, roles, status, last login), create/invite, edit roles, deactivate, reset password, sessions | Invite, edit, deactivate | `GET/POST /users` | users:manage | Table → cards | AC-16.2 |
| P-E03 | Students `/admin/students`, `/admin/students/{id}` | Student records | Table with filters (batch, status, programme, verification), bulk actions (assign batch, message, export), detail with tabs (profile, batches, attendance, progress, tests, placements, documents, audit) | Create, edit, verify documents, assign, deactivate, export | `GET /students`, `PATCH /students/{id}` | students:manage, students:read_sensitive | Table → cards | Sensitive fields gated; every change audited |
| P-E04 | Student import `/admin/students/import` | Bulk onboarding | Template download, upload XLSX/CSV, column mapping, validation preview (errors by row), import, invitation sending | Import | `POST /students/import` (job) | users:import | Desktop-first | AC-16.1, AC-06.1-style error report |
| P-E05 | Trainers `/admin/trainers`, `/admin/trainers/{id}` | Trainer records | Table, profile (subjects, bio, photo), batch assignments, performance summary (Standard) | Create, assign | `GET/POST /trainers` | trainers:manage | Table → cards | Performance visible to Admin only |
| P-E06 | Programmes `/admin/programs` | Programme catalogue | Table (name, duration, courses included, certificate template) | Create, edit | `GET/POST /programs` | programs:manage | Table | Programme links courses to batches |
| P-E07 | Batches `/admin/batches`, `/admin/batches/{id}` | Batch lifecycle | Table (name, programme, dates, mode, trainers, students, status); detail tabs Overview / Students (add, remove, transfer) / Trainers / Timetable (series editor) / Attendance / Content (published courses, assignments, tests) / Reports | Create, edit, add students, assign trainers, build timetable, publish content, close batch | `GET/POST /batches`, `POST /batches/{id}/members` | batches:manage | Table → cards | AC-04.1–04.2; transferring a student keeps history |
| P-E08 | Course builder `/admin/courses`, `/admin/courses/{id}/edit`, `/admin/courses/{id}/publish` | Author and publish courses | List with status; builder: outline tree (modules/lessons, drag-drop), lesson editor (type, video upload with progress, rich text, resources, practice question link, completion rule), settings, preview as student; publish dialog (scope, versions) | Create, edit, upload, publish, archive | `POST /courses`, `PUT /courses/{id}/outline`, `POST /courses/{id}/publish`, `POST /files/uploads` (presigned) | courses:manage, courses:publish | Desktop-first | AC-03.1–03.4 |
| P-E09 | Question bank `/admin/question-bank`, `/new`, `/{id}`, `/import` | Author questions | Table with filters (type, subject, topic, difficulty, company, status, author), editor per type (MCQ options/correct/explanation; coding: statement, starter code per language, test cases with visibility, limits; SQL: schema seed, expected query/result; Web: starter files, checks; descriptive: rubric), preview, versions, import wizard | Create, edit, review, publish, import | `GET/POST /questions`, `POST /questions/import` | questions:manage | Desktop-first | AC-06.1; coding question must pass its own reference solution before publish |
| P-E10 | Assignments `/admin/assignments`, `/admin/assignments/{id}` | Manage assignments | Same as P-D05 with all batches | Create, publish, monitor | see P-D05 | assignments:manage | Desktop-first | — |
| P-E11 | Tests `/admin/tests`, `/admin/tests/{id}`, `/schedule`, `/results` | Manage tests | Builder (sections, questions, marks, shuffle, settings), schedule (batches, window, duration, attempts), results (table, analytics, release, export) | Create, schedule, release, export | `POST /tests`, `POST /tests/{id}/schedules`, `POST /tests/{id}/release` | tests:manage | Desktop-first | AC-07.1–07.4 |
| P-E12 | Projects `/admin/projects` (Standard) | Manage briefs | List, editor (brief, rubric, resources, milestones), publish, status overview | Create, publish | `POST /projects` | projects:manage | Desktop-first | — |
| P-E13 | Certificates `/admin/certificates`, `/templates` (Standard) | Issue and manage | Issued list with search/filter/export, manual issue, revoke; template designer (fields, layout, signature image, preview) | Issue, revoke, edit template | `POST /certificates`, `PATCH /certificates/{id}/revoke` | certificates:manage | Desktop-first | AC-10.1–10.3 |
| P-E14 | Feedback `/admin/feedback` (Standard) | Forms and results | Form builder, schedule rules, response rates, aggregates by course/trainer/session, comment browser, export | Create, schedule, export | `POST /feedback-forms` | feedback:manage | Desktop-first | AC-13.1–13.2 |
| P-E15 | Announcements `/admin/announcements` | Broadcasts | List, editor (title, body, audience, schedule, expiry, channels), preview | Create, schedule | `POST /announcements` | announcements:manage | Desktop-first | AC-15.2 |
| P-E16 | Events `/admin/events` (Standard) | Webinars/workshops | List, editor (audience, link, registration, recording) | Create | `POST /events` | events:manage | Desktop-first | Attendance recorded like sessions |
| P-E17 | Reports `/admin/reports/{students|attendance|progress|assessments|assignments|projects|trainers|placements|certificates|feedback}` | Detailed reports | Filter bar, chart, table with server-side pagination/sort, column chooser, export (XLSX/CSV; PDF Standard), schedule report (Standard) | Filter, export, schedule | `GET /reports/{name}`, `POST /exports` | reports:read (scope) | Table → cards | Export equals filtered view; scheduled report emails on time |
| P-E18 | Exports `/admin/exports` | Export job history | Table (report, requested by, status, size, download, expiry) | Download | `GET /exports` | reports:export | List | Files expire after 7 days |

### 8.9 F. Placement management

| ID | Page / route | Purpose | Main components | Main actions | Data / API | Permission | Mobile | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| P-F01 | Placement dashboard `/placement` | Funnel and activity | Funnel tiles (eligible, applied, shortlisted, interviewed, offered, joined), open drives, upcoming interviews, company-wise placements chart, readiness distribution | Open drive | `GET /placement/dashboard` | placements:manage | Stacked | Funnel totals match pipeline |
| P-F02 | Companies `/placement/companies`, `/{id}` | Company records | Table (name, sector, location, tags, drives count, offers count), detail (profile, contacts, drives history, kit link, notes) | Create, edit, archive | `GET/POST /companies` | companies:manage | Table → cards | Archived companies hidden from students |
| P-F03 | Drives `/placement/drives`, `/new`, `/{id}` | Drive lifecycle | List (status, deadline, applicants), editor (company, title, description, type technical/non-technical/internal, location, package, openings, eligibility rules builder, deadline, rounds, attachments, visibility batches), pipeline board (columns per stage, drag between stages, bulk actions, filters), applicant detail drawer (profile, resume, scores, attendance, notes) | Create, publish, close, move applicants, schedule interviews, record offers | `POST /drives`, `PATCH /applications/{id}/stage`, `POST /applications/{id}/offer` | drives:manage | Desktop-first; board scrolls horizontally | AC-11.1–11.3; stage changes audited and notify students |
| P-F04 | Applications `/placement/applications` | Cross-drive tracker | Table with filters (drive, stage, batch), bulk stage update, export | Update, export | `GET /applications` | drives:manage | Table → cards | — |
| P-F05 | Kits `/placement/kits`, `/{id}` | Company preparation kits | Kit editor (items: PDF, video, link, question set, note; ordering), link to company and drives, publish | Create, publish | `POST /kits` | kits:manage | Desktop-first | Students see only published kits |
| P-F06 | Students (readiness) `/placement/students` | Find candidates | Table with filters (batch, passing year, degree, skills, min score, attendance, verification, placed status), saved filters, shortlist to drive, export | Shortlist, export | `GET /placement/students` | students:read (placement) | Table | Filters combine correctly; export respects filters |
| P-F07 | Placement reports `/placement/reports` | Analytics | Funnel by batch, company-wise placements, package distribution, time-to-placement, export | Export | `GET /reports/placements` | reports:read (placement) | Stacked | Matches P-E01 placement tiles |

### 8.10 G. Coding and assessment (authoring surfaces)

Student-facing coding and assessment pages are P-C08, P-C10–C16. Authoring surfaces:

| ID | Page / route | Purpose | Main components | Main actions | Data / API | Permission | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| P-G01 | Coding question editor (within P-E09) | Author executable problems | Statement editor (markdown), constraints, examples, per-language starter code and reference solution, test case table (input, expected output, visibility, weight), limits (time, memory), tags, "validate" (runs reference solution against tests) | Validate, publish | `POST /questions/{id}/validate` | questions:manage | Publish blocked until validation passes |
| P-G02 | SQL problem editor (Standard) | Author SQL problems | Schema/seed SQL, sample data preview, expected query, ordering rules, dialect | Validate | same | questions:manage | Expected result generated by running the reference query |
| P-G03 | Web exercise editor (Standard) | Author HTML/CSS/JS exercises | Starter files, instructions, automated checks (DOM/CSS assertions), preview | Validate | same | questions:manage | Checks run in sandbox during validation |
| P-G04 | Execution monitor `/admin/settings/system-health` (section) | Operate the runner | Queue depth, worker health, p95 latency, failures, per-language usage, quotas | Pause queue, adjust limits | `GET /admin/execution/stats` | settings:manage | Alerts when queue depth exceeds threshold |

### 8.11 H. Reports and analytics

Covered by P-E01, P-E17, P-E18, P-F01, P-F07 and trainer batch reports (P-D03). Every report page has: filter bar, summary tiles, one chart, a paginated table, export, and a definitions drawer explaining each metric.

### 8.12 I. System administration

| ID | Page / route | Purpose | Main components | Main actions | Data / API | Permission | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| P-I01 | General settings `/admin/settings/general` | Institute details, timezone, academic defaults (attendance threshold, completion %, attempt limits) | Forms | Save | `PATCH /settings` | settings:manage | Changes audited and applied without restart |
| P-I02 | Branding `/admin/settings/branding` | Name, logo, colours, email footer, certificate signatory | Form with preview | Save | `PATCH /settings/branding` | settings:manage | Preview shows login page and email |
| P-I03 | Roles `/admin/settings/roles` | Role bundles | Matrix editor (permissions × roles) | Save | `PUT /roles/{id}/permissions` | roles:manage | Cannot remove Super Admin's own access; audited |
| P-I04 | Integrations `/admin/settings/integrations` | Email, SMS, video, live-class, AI, storage keys (write-only fields) | Provider cards with test buttons | Save, test | `PATCH /integrations/{provider}` | settings:manage | Secrets never displayed after save; test sends a real probe |
| P-I05 | Feature flags `/admin/settings/feature-flags` | Enable modules (AI, gamification, OTP, labs) per environment/batch | Toggle list with audience | Toggle | `PATCH /flags/{key}` | settings:manage | Flag off hides UI and blocks API |
| P-I06 | Email templates `/admin/settings/email-templates` | Editable templates with variables | Editor, preview, test send | Save | `PATCH /templates/{key}` | settings:manage | Variables validated |
| P-I07 | Audit log `/admin/settings/audit-log` | Who did what | Table (actor, action, resource, before/after, IP, time), filters, export | Export | `GET /audit-logs` | audit:read | Append-only; export matches |
| P-I08 | Privacy requests `/admin/settings/privacy` | Data export/erasure requests | Queue, generate export, anonymise | Process | `POST /privacy-requests/{id}/process` | privacy:manage | Erasure anonymises personal fields but keeps aggregates |
| P-I09 | System health `/admin/settings/system-health` | Operational view | Queue stats, job failures, storage usage, execution stats, integration status, version | Retry job | `GET /admin/health` | settings:manage | Failed jobs retryable |

---
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
## 10. Coding Lab and Assessment Analysis

### 10.1 What the requirements actually need

| Capability | Needed? | Evidence | Tier |
|---|---|---|---|
| Coding questions with automatic evaluation | **Yes** | CR-S11 (coding problems), CR-S17/S18 include coding questions, reference embeds "Code · Solve" items in courses | MVP |
| Multiple programming languages | **Yes** | Institute teaches Java and Python full-stack, JavaScript, SQL; C/C++ common for placement tests **[A-07, Q-14]** | MVP |
| Code editor in the browser | Yes | All coding features | MVP |
| Code submission with hidden test cases and verdicts | Yes | Standard practice-platform behaviour; needed for points and skills | MVP |
| Compilation and runtime execution | Yes | Java/C/C++ compile; Python/JS interpret | MVP |
| Run with custom input (stdin) | Yes | Debugging own code before submit | MVP |
| Debugging exercises (buggy starter code) | Yes | CR-S14 | Standard |
| SQL practice with evaluation | Yes | CR-S13; MySQL course in reference | Standard |
| Web-development exercises (HTML/CSS/JS) | Yes | CR-S12 | Standard |
| Free-form playground ("IDE") | Yes, minimal | CR-S15 — a runner, not an IDE | Standard |
| Leaderboards, points, streaks | Yes, optional | Reference; CR-S11 implies "points" | Standard |
| Progress tracking per problem/topic | Yes | CR-S11, S30 (derived skills) | MVP |
| Interactive programs (stdin during execution), GUI, networking | No | Not required | Not planned |
| Project/repo grading (build and run a whole project) | No (manual review) | CR-S16 is reviewed by trainers | Not planned |

### 10.2 Three levels of "coding practice" and where this project sits

1. **Basic coding-practice interface.** Problems and an editor; evaluation is manual or by MCQ; no execution. Cheap and safe but does not satisfy CR-S11 (automatic verdicts) or the reference behaviour. *Not sufficient.*
2. **Code-submission system.** Editor plus server-side execution of submissions against test cases with verdicts, but execution runs on the application server or a shared container without strong isolation. Functionally satisfies the requirements but is a **security and stability liability**: student code can exhaust CPU/memory, read secrets, or attack the network. *Ruled out.*
3. **Secure online code-execution platform.** Editor plus a dedicated execution service that runs each submission in a sandbox (separate process namespaces, cgroups limits, no network, read-only filesystem, time and memory limits) on hosts isolated from the main application, fed through a queue with quotas and monitoring. *This is what the project needs.*

### 10.3 Engine options

| Option | Licence | Isolation | Languages | Operations | Cost | Verdict |
|---|---|---|---|---|---|---|
| **Judge0 CE (self-hosted)** | GPL-3.0 (server software; used as a separate service over HTTP, which does not impose GPL on our application; a commercial licence is offered by the vendor if the client prefers) | `isolate` sandbox (Linux namespaces, cgroups), per-submission limits | 90+ (Java, Python, C, C++, JavaScript, SQL via SQLite and more) | Docker Compose deployment; documented requirements (Ubuntu host; check current cgroup notes in the project changelog at install time) | Server cost only | **Recommended.** Mature, purpose-built, batch submission API, per-test-case limits, widely used by education platforms. |
| Judge0 Cloud | Managed | Same engine | Same | None | Pro €27/month for 2,000 submissions/day, Ultra €54 for 5,000/day, Mega €107 for 10,000/day, €0.001 per extra submission (judge0.com, Sept 2026) | Good fallback or starting option if the team prefers no ops; costs grow with practice volume (a "submission" is one test-case run in batch mode, so 10 hidden tests = 10 submissions). |
| Piston (self-hosted) | MIT | `isolate` inside Docker, cgroups, unprivileged users; defaults 3 s CPU/wall, process and file limits, output caps | 70+ | Docker; simple API | Server cost only | Solid alternative; less feature-rich for judging (no built-in expected-output comparison or per-test batching); public API is non-commercial only, so self-hosting is mandatory. |
| Custom runner (Docker container per run, gVisor/Firecracker) | — | Depends on implementation | Any | High: build, harden and maintain ourselves | Engineering time | Not recommended for a small team; revisit only if requirements outgrow Judge0. |
| Third-party judge APIs (Sphere Engine, HackerEarth) | Commercial | Managed | Many | None | Per-submission pricing, typically higher | Not recommended for cost. |

### 10.4 Recommended architecture

```
Browser (editor)                      API (NestJS)                        Execution tier (isolated host/VM)
──────────────────                    ────────────────────────────        ───────────────────────────────────
Code + language + input   ──HTTPS──►  POST /submissions                    
                                      • validate, quota (Redis)            
                                      • persist submission (pending)       
                                      • enqueue job (BullMQ/Redis)  ──►   Worker (NestJS standalone)
                                                                           • loads problem, test cases (hidden)
                                                                           • calls Judge0 /submissions/batch
                                                                           • polls or receives callback
                                                                           • normalises verdicts, stores results
                                                                           • emits "submission.graded" event
◄──SSE/WebSocket── status updates ◄── API subscribes to events ◄────────  Judge0 (server + workers + isolate)
                                                                           • no inbound access except from worker
                                                                           • outbound network disabled for sandboxes
```

Key design decisions:

- **Queue-based, asynchronous evaluation.** The API never blocks on execution. Submissions are jobs; workers scale independently; users see queued → running → verdict states.
- **Execution tier on a separate host or VM** from the API/database, reachable only from the worker over a private network, with no credentials to the main database or storage.
- **Batch test cases** per submission (Judge0 batch API) with per-case verdict, time and memory; hidden test inputs/outputs never leave the server.
- **Limits per problem**: CPU time (default 2 s, language multipliers for Java/Python), wall time (5 s), memory (256 MB), output size (64 KB), source size (64 KB), stdin size (64 KB), processes (Judge0 defaults).
- **Quotas per student** (Redis token buckets): e.g. 60 runs/hour, 300/day; playground lower; tests exempt within the attempt.
- **Language catalogue** managed in settings mapping our language IDs to Judge0 language IDs, so upgrades do not break problems.
- **Verdict model**: Accepted, Wrong Answer, Time Limit Exceeded, Memory Limit Exceeded, Runtime Error, Compilation Error, Output Limit, Internal Error (retryable).
- **Points and skills** computed from first accepted submission per problem.
- **Idempotency**: client-generated submission key prevents double submissions.
- **Observability**: queue depth, p95 grading latency, verdict distribution, worker health, and Judge0 health on the system-health page; alerts on backlog.

### 10.5 Lab-specific designs

**Debug Challenges (F-12b).** Same pipeline; the question stores buggy starter code per language and the expected behaviour via tests; optional "diff budget" (max lines changed) enforced client-side and reported.

**SQL Lab (F-12d).** Phase 1: SQLite through Judge0 (fast, safe): the worker composes `schema.sql + seed.sql + student query`, executes, and compares the result set with the expected result generated from the reference query (order-insensitive unless `ORDER BY` required; type-normalised). Phase 2 (if MySQL-specific syntax matters **[Q-15]**): a dedicated SQL runner container with a MySQL (or PostgreSQL) instance holding pre-built template databases per problem; each run clones a template into a temp schema, executes the student query as a read-only user with `max_execution_time`/statement timeout and row limits, then drops the schema. DDL/DML problems run in a fully disposable schema. The runner is on the execution host, never the production database.

**Web Lab (F-12e).** Entirely client-side: starter HTML/CSS/JS files in a multi-pane editor; preview rendered in an `<iframe sandbox="allow-scripts">` with `srcdoc`, a strict CSP, no same-origin access and no network; automated checks are a small test harness injected into the iframe (DOM/CSS assertions authored per exercise, e.g. "an element with id `nav` exists and has `display:flex`") that posts results via `postMessage`; the server records the results as a submission (checks are also re-verifiable server-side later using a headless browser if cheating becomes a concern). Optional visual comparison against a reference screenshot is Advanced.

**Playground (F-12c).** Free-form runner using the same service with lower quotas and no test cases; snippets saved per user.

**Coding questions inside tests.** Same pipeline; during an attempt, submissions are tagged with the attempt, "run" uses sample tests only, "submit" stores the best result; final grading job re-evaluates if needed after the attempt closes.

### 10.6 Security controls for code execution

- Sandbox isolation via `isolate` (namespaces, cgroups, seccomp as configured by Judge0), one sandbox per run, cleaned after each run.
- Network disabled inside sandboxes; execution host firewalled (only worker → Judge0 API on a private interface; no inbound from the internet).
- Resource ceilings enforced at three levels: per-problem limits, Judge0 global maxima, and host cgroup limits so a saturated worker cannot starve the host.
- No secrets on the execution host beyond the Judge0 API token; no access to the application database or object storage.
- Hidden tests and reference solutions stored in the main database, sent to the worker per job, never to clients; API responses to students contain only verdict, time, memory, sanitised stderr (truncated, secrets scrubbed) and the sample test outputs.
- Abuse prevention: quotas, source-size limits, banned-syscall defaults, forbidden patterns not relied upon (sandbox is the control, not regex), submission audit, anomaly alerts (a student with hundreds of runs/hour).
- Regular patching of runtime images; Judge0 version pinned and upgraded deliberately; a security test suite runs against staging on every upgrade (fork bomb, infinite loop, huge output, file-system writes, network calls, environment reads).
- Operational cost: one dedicated 4 vCPU / 8 GB VM handles roughly 4 parallel sandboxes at ~1–3 s each, i.e. thousands of test-case runs per hour; scale by adding Judge0 workers. Costs are server costs only (§20).

### 10.7 Assessment engine notes

- Server-authoritative timing and state; client is a view.
- Question delivery per section on demand; answers validated per type; coding answers evaluated by the execution service with the attempt linked.
- Result release control; analytics jobs after release; leaderboard snapshots.
- Integrity basics (MVP): full-screen prompt, tab-switch and focus-loss counters, disabled paste in the coding editor during tests (configurable), randomised question and option order, per-student question pools (Standard). Webcam proctoring is out of scope.

---

## 11. UI/UX Design Strategy

### 11.1 Design principles

1. **Today first.** Every home screen answers "what should I do now?" before showing statistics.
2. **One shell, four portals.** Same navigation model, header, tables, forms and feedback patterns everywhere; portals differ in content, not in conventions.
3. **Phone-first for students, desktop-first for staff.** Student pages are designed at 360 px and scaled up; staff data pages are designed at 1280 px and remain usable on tablets.
4. **Explain every number.** Progress, scores, eligibility and any "score" show a definition on hover/tap.
5. **Low-bandwidth respect.** Skeletons, lazy loading, adaptive video, small bundles; no auto-playing media; offline banner.
6. **Accessible by default.** WCAG 2.2 AA: contrast, keyboard paths, focus states, labels, reduced motion, screen-reader semantics for timers and verdicts.
7. **Calm and professional.** One accent colour, neutral surfaces, semantic colours reserved for status; no marketing carousels inside the app.
8. **Consistent state feedback.** Loading, empty, error, success are designed once (§8.1) and reused.

### 11.2 Visual hierarchy and layout system

- **App shell.** Left sidebar (240 px expanded, 72 px collapsed with tooltips) on ≥ 1024 px; top bar with page title, breadcrumbs (staff), search, notifications, user menu. Content max-width 1280 px for staff tables, 960 px for reading pages, full width for editors and test screens.
- **Grid.** 12-column grid with 24 px gutters on desktop, 16 px on mobile; spacing scale 4/8/12/16/24/32/48/64 px.
- **Cards versus tables.** Students see cards and lists; staff see tables with sticky headers, column visibility, server-side sort/filter/pagination, bulk selection and row actions.
- **Dashboards.** Two-tier: a "today/attention" band at top, then KPI tiles (max 6 per row on desktop, 2 per row on mobile), then charts, then lists.
- **Density.** Comfortable density for students; compact toggle for staff tables.

### 11.3 Typography and colour

- **Typeface.** UI: a highly legible sans with good Devanagari/Latin coverage for future localisation, e.g. *IBM Plex Sans* or *Manrope* (self-hosted, `font-display: swap`); code: *JetBrains Mono*. Type scale: 12, 14, 16 (body), 18, 20, 24, 30, 36 px; line height 1.5 for body, 1.25 for headings; tabular numerals in tables.
- **Colour strategy.** Client brand to be supplied **[Q-02]**. Until then: one primary accent (used for primary actions, active navigation, links, progress), neutral greys tinted toward the accent, and semantic colours: success (green), warning (amber), danger (red), info (blue) used only for status. Verdict colours follow semantic colours. Both light and dark themes ship from day one with tokens (`--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, …) and contrast-checked pairs.
- **Iconography.** Single icon set (Lucide) at 20/24 px with text labels in navigation.

### 11.4 Component standards

| Component | Standard |
|---|---|
| Buttons | Primary (one per view), secondary, ghost, destructive; loading state with spinner and disabled; icon+label on desktop, icon-only allowed on mobile with `aria-label`. |
| Forms | Labels above fields; helper text; inline validation on blur and on submit; error summary at top for long forms; multi-step for > 8 fields with progress; autosave drafts for long forms; consistent required marker; masked inputs for phone/date; tag inputs for skills. |
| Tables | Server-side pagination (25/50/100), sort indicators, column filters, saved views, sticky header, row selection with bulk bar, empty state with filters reset, export button, responsive collapse to cards. |
| Modals and sheets | Modals for short confirmations and small forms; side sheets for details/edit on desktop; bottom sheets on mobile; destructive actions require typed confirmation for irreversible operations. |
| Notifications | Toasts (success/error/info, 5 s, dismissible, not stacked beyond 3); inline alerts for persistent states; notification centre for asynchronous results (exports, grading). |
| Tabs and chips | Tabs with counts for status segmentation; filter chips for taxonomies; URL-synced. |
| Editors | Code editor (CodeMirror 6) with language mode, theme sync, font size, wrap, minimap off on mobile; rich-text editor (TipTap) for lesson/question content with code blocks, images, tables, math optional. |
| Video player | Provider player or hls.js with speed (0.75–2×), quality, captions, keyboard shortcuts, resume, picture-in-picture, "mark complete". |
| Charts | Consistent palette from tokens; axis labels; tooltips; accessible table alternative behind a toggle. |
| Timers | Large, high-contrast, announces remaining time to assistive tech at 5 min and 1 min. |

### 11.5 Accessibility standards

WCAG 2.2 AA; semantic HTML; skip links; focus visible; keyboard operability for all controls including drag-and-drop alternatives (move up/down buttons); colour never the only signal (icons/text for verdicts and statuses); `prefers-reduced-motion`; minimum 44×44 px touch targets; form errors associated with fields; live regions for autosave/timer; language attribute; automated axe checks in CI plus manual screen-reader passes on the test screen and course player.

### 11.6 Responsive breakpoints and mobile navigation

Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 px. Below `lg`: bottom tab bar (Home, Courses, Practice, Tests, More) for students; hamburger drawer for staff. Full-screen modes: lesson player (landscape), coding workspace (tabs: Problem / Code / Output), test attempt (palette as sheet). Installable PWA with app icon and offline shell (read-only cached pages; no offline submissions).

### 11.7 Loading, empty, error and success states

Defined in §8.1. Additional rules: optimistic UI only for reversible actions (bookmark, mark read); never for submissions or attendance; success confirmations name the object ("Assignment 'SQL Basics' published to 2 batches"); errors say what happened and what to do next, with a reference ID for support.

### 11.8 Ideal layouts per major screen

| Screen | Layout |
|---|---|
| **Student dashboard** | Top band: greeting + today's sessions (join buttons) + deadlines. Row 2: "Continue learning" cards (last lesson, last assignment). Row 3: progress tiles (overall, courses, assignments, tests) each with "explain". Row 4 (Standard): streak heat-map and optional leaderboard (collapsible). Row 5: announcements list. Mobile: same order, single column. |
| **Admin dashboard** | Filter bar pinned; attention list (low attendance batches, overdue grading, pending verifications, failed jobs); KPI tiles for the 15 metrics grouped (Students · Learning · Assessment · Placement · Quality); trend charts; "data as of" and export. |
| **Trainer dashboard** | Today's sessions with start/attendance buttons; grading queue count; unanswered doubts; batch health cards; at-risk students list with reasons. |
| **Course detail** | Header (title, progress ring, trainer, resume button); tabs Overview / Curriculum / Resources / Discussions; curriculum as accordion with lesson rows (type icon, duration, status). |
| **Learning (lesson) page** | Desktop: player/reading pane 2/3 width, curriculum sidebar 1/3 with search and module accordion; below the player: title, resources, notes, inline practice, up next. Mobile: player full width, sticky "Curriculum" button opening a drawer. |
| **Coding practice page** | Desktop: problem statement left (resizable), editor right, results/console bottom-right; toolbar: language, run, submit, reset, settings; verdict table with per-test rows (sample tests expanded, hidden tests as pass/fail counts). Mobile: three tabs Problem / Code / Output; run/submit fixed at bottom. |
| **Assessment page** | Header: test name, section tabs, timer; left: question pane; right: palette grid (answered/flagged/unanswered) and submit; bottom: prev/next, flag, clear. Full-screen, no navigation, exit requires confirmation. Mobile: palette as bottom sheet. |
| **Placement page** | Student: drives as cards with eligibility badge (Eligible / Not eligible: reason), deadline countdown, apply button; tabs Open / Applied / Closed. Coordinator: pipeline board (columns = stages), applicant drawer with profile, resume, scores, attendance, notes and stage actions. |
| **Reports page** | Filter bar (date, programme, batch, course, trainer); summary tiles; one chart; table with export; definitions drawer. |

### 11.9 Improvements over the reference portal

Labelled navigation instead of icon-only rails; "Today" band replacing the banner carousel; explained scores; eligibility reasons on drives; open drives by default; multi-step profile with completeness; per-lesson resources; agenda view for the schedule; consistent empty states; no third-party cookie banner; dark theme designed, not inverted; accessibility built in; consistent naming and content validation.

Detailed visual design (mock-ups, final palette, component library styling) starts only after this structure is approved (Step 8).

---
## 12. Recommended Technology Stack

### 12.1 Summary

| Layer | Recommendation | Version guidance (September 2026) |
|---|---|---|
| Language | TypeScript end to end | TypeScript 5.x (current stable at setup) |
| Runtime | Node.js LTS | Node 22 LTS (or 24 LTS) — pin in `.nvmrc` and Docker images |
| Frontend | Next.js (App Router) + React | Next.js 16 (active LTS line 16.3.x; 15.5.x is maintenance LTS) |
| Styling / components | Tailwind CSS v4 + shadcn/ui (Radix primitives) + Lucide icons | current |
| Data fetching / state | TanStack Query (server state) + small client stores (Zustand) only where needed | current |
| Forms / validation | React Hook Form + Zod (schemas shared with the API) | current |
| Editors | CodeMirror 6 (code), TipTap (rich text) | current |
| Video playback | Provider player or hls.js | current |
| Backend | NestJS (modular monolith) + separate worker process | NestJS 12 (ESM, Standard Schema validation — Zod works natively) |
| ORM / migrations | Prisma ORM | Prisma 7 line (TypeScript runtime); evaluate Prisma 8 once GA; never use dev builds |
| Database | PostgreSQL | 17 or 18 (managed service version) |
| Cache / queues / rate limits | Redis (or Valkey) + BullMQ | Redis 7/8 |
| Object storage | S3-compatible: Cloudflare R2 (production), MinIO (local) | — |
| Video hosting | Bunny Stream (primary candidate) or Cloudflare Stream | — |
| Email | Resend (or Amazon SES) | — |
| SMS / WhatsApp (optional) | MSG91 or Twilio (SMS, DLT-registered), Meta WhatsApp Cloud API via a BSP | — |
| Code execution | Judge0 CE self-hosted on an isolated VM (Judge0 Cloud as fallback) | pinned release |
| AI | Anthropic Claude API via official TypeScript SDK | `claude-opus-5` default; `claude-sonnet-5` as cost option |
| Auth | Own implementation in NestJS (Argon2id, JWT + rotating refresh) — no third-party identity SaaS required | — |
| Real-time | WebSocket (Socket.IO) or SSE for notifications and submission status | — |
| Infrastructure | Docker + Docker Compose; Caddy or Traefik for TLS; Cloudflare DNS/proxy | — |
| CI/CD | GitHub Actions; images to GHCR; SSH deploy with health checks | — |
| Monitoring | Sentry (errors), Uptime Kuma or Better Stack (uptime), OpenTelemetry + Grafana stack or Axiom (optional) | — |
| Testing | Vitest (unit), Supertest (API), Playwright (E2E), k6 (load), axe (a11y) | — |

### 12.2 Frontend

| Decision | Recommendation | Alternatives considered | Why | Trade-offs |
|---|---|---|---|---|
| Framework | **Next.js 16** (App Router, React Server Components, React Compiler stable) | Vite + React Router SPA (as the reference uses); Remix/React Router v7; Nuxt/Vue; SvelteKit | Largest ecosystem, server rendering for fast first paint on phones, built-in routing/layouts, image optimisation, streaming, easy PWA; team hiring pool; Vercel-independent (self-hosted in Docker). | Heavier mental model than a plain SPA; must be disciplined about client/server boundaries. A plain Vite SPA is acceptable if the team strongly prefers it, but loses SSR benefits. |
| Language | TypeScript strict | JavaScript | Shared types with API, fewer runtime bugs. | Slightly slower initial development. |
| UI library | **shadcn/ui** (copied Radix-based components, Tailwind styled) | MUI, Ant Design, Chakra, Mantine | Owns the code (no vendor lock), accessible primitives, themeable with tokens, light bundle. | Components are maintained in-repo (an advantage for customisation, a cost for upgrades). Ant Design would give richer tables faster but heavier bundles and harder theming. |
| Styling | **Tailwind CSS v4** with design tokens as CSS variables | CSS Modules, styled-components, vanilla-extract | Fast, consistent, works with shadcn, no runtime CSS-in-JS cost. | Verbose class lists; mitigated by component extraction. |
| State | **TanStack Query** for server state; URL for filters; Zustand for a few client stores (editor, test attempt buffer) | Redux Toolkit, MobX, Jotai | Most state is server data; avoids boilerplate. | Must design query keys and invalidation carefully. |
| Forms/validation | **React Hook Form + Zod**; Zod schemas in `packages/shared` reused by NestJS | Formik + Yup | Single validation source of truth; type inference. | — |
| Data fetching | Generated typed client from the OpenAPI spec (openapi-typescript + fetch wrapper) | Manual fetches; tRPC | Contract-first, works with a separate API; tRPC would couple web and API deployments. | Regeneration step in CI. |
| Tables | TanStack Table | AG Grid (commercial features), MUI DataGrid | Headless, server-side pagination, free. | More assembly. |
| Charts | Recharts or Apache ECharts | Chart.js, Nivo | Declarative, responsive, themeable. | — |
| Code editor | **CodeMirror 6** | Monaco (VS Code editor) | Much lighter (important for phones and low bandwidth), good touch support, extensible, themeable. Monaco offers richer IntelliSense but is ~10× heavier and poor on mobile. | Less "VS Code feel"; acceptable for practice problems. Monaco can be offered later as a desktop-only option. |
| Accessibility | Radix primitives, axe in CI, ESLint jsx-a11y | — | Baseline AA without bespoke work. | — |
| Video | Provider embed/player (Bunny/Cloudflare) with hls.js fallback | Video.js, Plyr | Providers include adaptive bitrate, token auth, analytics. | Provider lock-in mitigated by an adapter. |

### 12.3 Backend

| Decision | Recommendation | Alternatives considered | Why | Trade-offs |
|---|---|---|---|---|
| Framework | **NestJS 12** as a *modular monolith* (one codebase, feature modules) plus a separate **worker process** for queues | Express/Fastify hand-rolled; Fastify + plugins; Django/DRF (Python); Laravel; Spring Boot; Next.js route handlers only | Opinionated module/DI structure keeps a growing codebase organised for a small team; first-class guards/interceptors for RBAC, validation, logging; OpenAPI generation; WebSocket gateway; queues; ESM and Standard Schema in v12 let Zod be the single validation layer. A Python/Django stack is viable but splits the team across two languages. Next.js-only would put long-running jobs, WebSockets and the execution pipeline in the wrong place. | More abstraction than a minimal Fastify app; learning curve for decorators. |
| API architecture | REST + JSON under `/api/v1`, OpenAPI 3.1 generated from code, SSE/WebSocket for real-time | GraphQL, tRPC, gRPC | Simple to cache, test, document and consume from future mobile apps; GraphQL adds complexity without a clear need. | Some over-fetching; mitigated by purpose-built aggregate endpoints (dashboard). |
| Business logic organisation | Feature modules (`auth`, `users`, `batches`, `courses`, `assignments`, `tests`, `execution`, `placement`, …) each with controller → service → repository (Prisma) and domain events via an in-process event bus; cross-module calls only through service interfaces | Clean architecture with strict layers; CQRS | Right-sized for 2–3 developers; clear seams for later extraction of `execution` or `ai` into services. | Requires discipline to avoid cross-module imports of repositories (lint rule). |
| Authentication | Own implementation: Argon2id, JWT access (15 min) + rotating refresh tokens (httpOnly cookie), server-side session records, OTP adapter | Auth0/Clerk/Keycloak, NextAuth/Auth.js, Supabase Auth | No per-user SaaS cost; full control of invite-based onboarding, OTP and audit; Keycloak is heavy for this size. | Must implement carefully (covered by tests and §16). |
| Authorization | Permission-based RBAC with scopes (§7) implemented as NestJS guards + service scope filters | CASL library, OPA | Simple, testable, explicit. CASL can be adopted inside the same design if rules grow. | — |
| Validation | Zod schemas (shared package) via NestJS 12 Standard Schema pipes | class-validator DTOs | One schema for client and server; better inference. | — |
| Error handling | RFC 9457 `application/problem+json` responses; global exception filter; typed domain errors | Ad-hoc JSON | Consistent client handling. | — |
| Logging | Structured JSON logs (pino) with request IDs, user ID, route; log levels per environment; no PII in logs | Winston | Fast, JSON-native. | — |
| Background jobs | **BullMQ** on Redis: queues for execution, emails, exports, aggregation, reminders, certificates; cron via BullMQ repeatable jobs | Agenda, Temporal, cron containers | Mature, Nest integration, retries, dead-letter, dashboard (Bull Board). | Redis becomes a critical dependency (it already is for sessions/rate limits). |
| Real-time | Socket.IO gateway (notifications, submission status, test monitor) with Redis adapter | SSE only, Pusher/Ably | Bi-directional, scales with Redis; SSE is a simpler fallback for submission status. | Sticky sessions or Redis adapter needed when scaling API replicas. |
| PDF generation | Headless Chromium (Playwright) in the worker for certificates and PDF reports; exceljs for XLSX | pdf-lib, wkhtmltopdf | HTML templates reuse the design system. | Chromium image size; run only in worker. |

### 12.4 Database

| Decision | Recommendation | Alternatives | Why | Trade-offs |
|---|---|---|---|---|
| Engine | **PostgreSQL** | MySQL/MariaDB, MongoDB | Relational integrity for enrolments, attempts and pipelines; JSONB for flexible content; full-text search; window functions for reports; ubiquitous managed offerings. MongoDB (which the reference appears to use judging by its IDs) trades integrity for flexibility, which this domain does not need. | — |
| ORM | **Prisma ORM 7** | Drizzle ORM (1.0 still release-candidate as of mid-2026), TypeORM, MikroORM, Kysely | Type-safe client, first-class migrations, mature ecosystem and docs; Prisma 7 removed the Rust engine (smaller, faster). Drizzle is excellent and closer to SQL; revisit once 1.0 is stable if the team prefers it. TypeORM has decorator-heavy pitfalls. | Complex reporting queries use raw SQL (`$queryRaw`) or SQL views — acceptable and planned. |
| Schema design | Normalised core with JSONB for polymorphic content (question payloads, profile sections, lesson blocks) validated by Zod at the boundary | Fully normalised or fully document | Balance between integrity and flexibility. | JSONB fields need explicit versioning. |
| Relationships | Foreign keys everywhere with `ON DELETE RESTRICT` by default; soft-delete flags for user-facing entities | Cascades | Prevents accidental data loss. | Cleanup jobs needed. |
| Indexing | Composite indexes for scope queries (batch_id, student_id), partial indexes for active rows, GIN for JSONB/tsvector, covering indexes for leaderboards/aggregates | — | Query plans reviewed for the 20 heaviest queries before launch. | — |
| Migrations | Prisma Migrate, reviewed in PRs, applied by CI/CD before rollout, backward-compatible (expand/contract) | Manual SQL | Version-controlled, repeatable. | Discipline required for zero-downtime changes. |
| Transactions | Prisma interactive transactions for multi-row writes (enrolment, attempt submit, stage change); idempotency keys for client retries | — | Consistency. | — |
| Audit history | Append-only `audit_logs` written by a service interceptor for mutations plus explicit calls for domain events; before/after JSON diffs for sensitive tables; optional temporal tables later | DB triggers | Application-level gives context (actor, request ID). | Must be enforced by tests. |

### 12.5 Infrastructure

| Area | Recommendation | Alternatives | Why | Cost note (verify at procurement) |
|---|---|---|---|---|
| Local development | Docker Compose: `postgres`, `redis`, `minio`, `mailpit`, `judge0` (server, workers, db, redis); apps run with hot reload; one `make dev`/`pnpm dev` command; seed data | Local installs | Same services as production; new developer ready in hours. | Free |
| Environment management | `.env` files per environment from `.env.example`, validated at boot with Zod (fail fast); secrets injected by the host (Docker secrets / CI secrets), never committed | dotenv-vault, SOPS | Simple and safe. | Free |
| Production hosting | **Two VMs** (app: 4 vCPU/8 GB; execution: 4 vCPU/8 GB) running Docker Compose behind Caddy/Traefik with automatic TLS; Cloudflare in front (DNS, proxy, WAF basics, Turnstile) | Single VM (cheapest, execution not isolated — not recommended); PaaS (Railway/Render/Fly: simpler, 2–4× cost, execution host still needed); Kubernetes (over-engineering for this size) | Cheapest robust option; execution isolation by host; scales vertically first, then horizontally by adding API replicas. | Hetzner shared CX plans were €5.49–€15.99/month (June 2026 list) but were marked unavailable for new orders in September 2026; DigitalOcean (Bangalore region), AWS Lightsail (Mumbai) or Hetzner dedicated-vCPU plans are the alternatives — roughly USD 24–60 per VM per month at this size **[Q-04]**. |
| Database hosting | **Managed PostgreSQL** (Neon, DigitalOcean Managed DB, Supabase DB, or AWS RDS) with automated backups and point-in-time recovery; self-managed in Docker with pgBackRest/wal-g backups to R2 as the budget option | — | Backups and failover are the riskiest thing to self-manage with a small team. | Neon Launch plan: USD 0.106 per CU-hour and USD 0.35 per GB-month (Sept 2026); DO managed from ~USD 15/month; self-managed = VM cost only. |
| Object storage | **Cloudflare R2** | AWS S3, Backblaze B2, DigitalOcean Spaces, MinIO self-hosted | S3-compatible with free egress (videos and resources are download-heavy). | USD 0.015/GB-month storage, Class A USD 4.50/million, Class B USD 0.36/million, egress free; 10 GB free (Sept 2026). |
| Video | **Bunny Stream** (primary candidate) or **Cloudflare Stream** | Mux, Vimeo OTT, YouTube unlisted (interim only), self-hosted HLS | Hosted transcoding, adaptive streaming, token-protected playback, India edge presence. | Bunny Stream (search-verified, confirm on vendor page): ~USD 0.005/GB delivered, ~USD 0.01/GB storage, USD 1 monthly minimum, standard encoding included. Cloudflare Stream: USD 5 per 1,000 minutes stored per month and USD 1 per 1,000 minutes delivered. Example: 500 hours of recordings ≈ 30,000 minutes → Cloudflare ≈ USD 150/month storage + delivery; Bunny would typically be far lower for the same library (storage by GB). |
| Background jobs | BullMQ workers in the `worker` container; separate execution worker on the execution VM | — | Isolation and independent scaling. | Included in VM cost |
| Caching | Redis for sessions, permissions, rate limits, dashboard aggregates; HTTP caching for public assets via Cloudflare | — | — | Included |
| Monitoring | Sentry (errors, performance) free/low tier; Uptime Kuma (self-hosted) or Better Stack for uptime and alerting; container metrics via cAdvisor + Prometheus + Grafana or a hosted alternative (Axiom/Grafana Cloud free tiers) | Datadog (expensive) | Enough visibility at low cost. | Free–USD 30/month |
| Backups | Managed DB PITR (or nightly base + WAL to R2), object storage versioning for critical buckets, weekly restore drill in staging, configuration in Git | — | Recovery objectives: RPO ≤ 15 min (managed) / ≤ 24 h (self-managed nightly), RTO ≤ 4 h. | Included/low |

### 12.6 Integrations

| Integration | Recommendation | Alternatives | Notes |
|---|---|---|---|
| Email | Resend (developer-friendly, free 3,000 emails/month with 100/day; Pro USD 20/month for 50,000) or Amazon SES (cheapest at volume) | Postmark, SendGrid, Brevo | Transactional only; domain authentication (SPF/DKIM/DMARC) required. |
| Notifications (push/SMS/WhatsApp) | Optional: Web Push (free, self-implemented); MSG91/Twilio SMS after DLT registration; WhatsApp via Meta Cloud API through a BSP | — | Costs per message; keep as Optional integration behind adapters. |
| Video hosting | See §12.5 | — | Adapter interface: upload/ingest, status, signed playback, delete. |
| Live classes | Links to Zoom/Google Meet (MVP); Zoom API/SDK for auto-create meetings, join logs and cloud recordings (Optional integration) | Jitsi self-hosted (free but ops), 100ms/Dyte (paid SDKs) | Zoom/Meet licences are the client's existing cost **[Q-11]**. |
| Payment gateway | Not in scope; if added: Razorpay (2% per domestic transaction, no setup or annual fee, 18% GST on fees; international up to 3%) | Cashfree, PayU, Stripe India | **[Q-07]** |
| AI services | Anthropic Claude API (official TypeScript SDK); models: `claude-opus-5` (USD 5 input / USD 25 output per million tokens), `claude-sonnet-5` (USD 2 / USD 10), `claude-haiku-4-5` (USD 1 / USD 5) as of the June 2026 price table; prompt caching for stable prefixes; streaming; refusal fallbacks | OpenAI, Google Gemini, open-weight models self-hosted | Server-side only; per-mode model selection; usage accounting; budget alerts **[Q-20]**. |
| Code execution | Judge0 self-hosted; Judge0 Cloud fallback (see §10.3) | Piston | — |
| Analytics | PostHog (self-hosted or cloud free tier) or GA4 for product analytics, consent-gated | Plausible | Optional. |
| Calendar | iCal feed per user (Standard); Google Calendar sync (Advanced) | — | — |
| Support | In-app "report an issue" + email; optional chat widget (Crisp/Zoho) behind consent | — | — |
| Source control / CI | GitHub + GitHub Actions; Dependabot/Renovate; CodeQL | GitLab | — |

### 12.7 Why not other popular choices

- **Firebase/Supabase as the whole backend.** Fast to start, but complex RBAC, background pipelines (execution, grading, exports) and reporting push logic into functions and policies that are harder to test and to reason about; vendor lock-in.
- **Microservices from day one.** Operational overhead for 2–3 people; the modular monolith gives the same seams without the cost; only `execution` (and later `ai`) are separate processes by necessity.
- **MongoDB.** Flexible, but attempts, enrolments, pipelines and reports are relational and benefit from constraints and joins.
- **Low-code/no-code LMS platforms.** Cannot model batches, coding labs and placement pipelines; per-seat costs.

---

## 13. System Architecture

### 13.1 High-level architecture

```
                         ┌──────────────────────────── Cloudflare (DNS, proxy, WAF, TLS edge) ────────────────────────────┐
                         │                                                                                                 │
   Students / Trainers   │   https://app.example.com            https://api.example.com                                    │
   Admins / Placement ───┼──────────────┐                              │                                                   │
   (browsers, PWA)       │              ▼                              ▼                                                   │
                         │   ┌────────────────────┐        ┌─────────────────────────┐        ┌─────────────────────────┐  │
                         │   │  web (Next.js)     │ ─────► │  api (NestJS)           │ ◄────► │  redis (cache, queues,  │  │
                         │   │  SSR + static      │  REST  │  REST /api/v1, OpenAPI  │        │  sessions, rate limits) │  │
                         │   └────────────────────┘        │  WebSocket gateway      │        └───────────┬─────────────┘  │
                         │                                 │  RBAC, validation, audit│                    │                │
                         │                                 └───────┬─────────┬───────┘                    │                │
                         │                                         │         │                            │                │
                         │                              ┌──────────▼──┐   ┌──▼──────────────────┐   ┌─────▼──────────────┐ │
                         │                              │ PostgreSQL  │   │ Object storage (R2) │   │ worker (NestJS)    │ │
                         │                              │ (managed)   │   │ private buckets,    │   │ email, exports,    │ │
                         │                              └─────────────┘   │ presigned URLs      │   │ aggregation,       │ │
                         │                                                └─────────────────────┘   │ reminders, PDFs,   │ │
                         │    External providers: video (Bunny/CF Stream), email (Resend), SMS/WA,  │ AI jobs, execution │ │
                         │    Zoom/Meet links, Claude API, Sentry                                     │ dispatch           │ │
                         │                                                                            └─────────┬──────────┘ │
                         └──────────────────────────────────────────────────────────────────────────────────────┼───────────┘
                                                                                                                │ private network only
                                                                                          ┌─────────────────────▼──────────────────┐
                                                                                          │ Execution VM (isolated)                │
                                                                                          │ Judge0 server + workers (isolate)      │
                                                                                          │ SQL runner (Standard)                  │
                                                                                          │ no DB/storage credentials, no inbound  │
                                                                                          └────────────────────────────────────────┘
```

### 13.2 Frontend architecture

- **Monorepo package `apps/web`** (Next.js App Router). Route groups: `(public)`, `(auth)`, `(student)`, `(trainer)`, `(admin)`, `(placement)`, each with its own layout (shell, navigation, guards).
- **Server components** for data-heavy read pages (dashboards, lists) fetching through the typed API client with the user's session cookie; **client components** for interactive surfaces (editors, test attempt, forms, charts).
- **Data layer**: generated OpenAPI client; TanStack Query for client-side caching/mutations; optimistic updates only for reversible actions; SSE/WebSocket hooks for submission status and notifications.
- **Design system package `packages/ui`**: tokens, Tailwind preset, shadcn components, app-specific composites (DataTable, PageHeader, StatTile, StatusChip, EmptyState, Timer, CodeEditor, VideoPlayer).
- **Shared package `packages/shared`**: Zod schemas, TypeScript types, enums (roles, permissions, statuses), constants, utilities (IST date formatting).
- **Performance**: route-level code splitting; editors lazy-loaded; images via Next image; bundle budget checks in CI (student routes < 250 KB gzipped JS initial).
- **PWA**: manifest, service worker for shell caching and push subscription (Optional).

### 13.3 Backend architecture

- **`apps/api`** (NestJS): modules — `auth`, `rbac`, `users`, `students`, `trainers`, `batches`, `courses`, `files`, `sessions` (live), `attendance`, `questions`, `assignments`, `tests`, `execution`, `practice`, `projects`, `certificates`, `feedback`, `placement`, `profile`, `notifications`, `announcements`, `reports`, `search`, `gamification`, `ai`, `settings`, `audit`, `health`. Each module: `*.controller.ts` (HTTP), `*.service.ts` (business rules), `*.repository.ts` (Prisma access), `*.events.ts` (domain events), `dto/` (Zod schemas from shared), `*.spec.ts`.
- **Cross-cutting**: global exception filter (problem+json), validation pipe (Zod), auth guard, permission/scope guard, audit interceptor, request-ID middleware, rate-limit guard (Redis), OpenAPI decorators.
- **Domain events** (in-process event emitter) decouple modules: e.g. `lesson.completed` → progress, gamification, certificates; `submission.graded` → progress, gamification, notifications; `application.stage_changed` → notifications, reports.
- **`apps/worker`** (NestJS standalone context) consumes BullMQ queues: `execution`, `email`, `notifications`, `exports`, `aggregation`, `reminders`, `pdf`, `ai`, `imports`, `privacy`. Repeatable jobs: nightly aggregates, reminder scans, streak calculation, cleanup.
- **Execution adapter** wraps Judge0's API; a second adapter for Judge0 Cloud allows switching by configuration.

### 13.4 Database architecture

Single PostgreSQL database with schemas: `app` (operational tables), `reporting` (aggregate tables and materialised views), `audit` (append-only). Read replicas are not needed initially; heavy reports use aggregates and off-peak jobs. Connection pooling via PgBouncer (or the managed provider's pooler). Retention: activity events partitioned by month after volume grows (Standard).

### 13.5 Authentication and authorization architecture

Described in F-01/F-02 and §7: stateless access JWT validated by the API, refresh rotation with server-side session table, Redis-cached permissions, guards and scope filters, audited changes, optional OTP and two-factor adapters.

### 13.6 File storage architecture

Presigned direct uploads from the browser to the private bucket (multipart for large files); registry table in PostgreSQL; downloads via short-lived presigned URLs issued after permission checks; video files go to the video provider (direct upload with provider tokens) and only metadata is stored; export files and certificates are written by the worker; lifecycle rules delete expired exports; optional antivirus scanning queue.

### 13.7 Background-job architecture

BullMQ queues with concurrency per queue, retries with exponential backoff, dead-letter handling and alerts, job idempotency keys, Bull Board UI restricted to Super Admin, metrics exported. Long jobs report progress (imports, exports) to the notification centre.

### 13.8 Notification architecture

Notification service creates records and fans out to channel adapters (in-app via WebSocket, email via provider, optional SMS/WhatsApp/push) based on preferences and template; digests batch non-urgent items; announcements are a separate targeted table rendered on dashboards.

### 13.9 Coding-execution architecture

See §10.4–10.6.

### 13.10 Logging and monitoring architecture

Structured logs from web, api, worker and Judge0 shipped by the Docker logging driver to a log store (Loki or hosted); Sentry for exceptions and traces; health endpoints (`/health/live`, `/health/ready`) checked by the reverse proxy and uptime monitor; metrics (request latency, queue depth, DB pool, execution latency) via OpenTelemetry to Prometheus/Grafana or a hosted service; alerts to email/Slack for error spikes, queue backlog, disk usage, failed backups.

### 13.11 Deployment architecture and environments

| Environment | Purpose | Infrastructure | Data |
|---|---|---|---|
| Local | Development | Docker Compose on the developer machine; hot reload; Mailpit; MinIO; local Judge0 | Seed data (fake students, courses, questions); no production data |
| Staging | Integration, UAT, load and security tests | Same images as production on a smaller VM (or the same VM with separate compose project); staging database and buckets; sandbox provider accounts | Anonymised subset or seed data; refreshed on demand |
| Production | Live | App VM + Execution VM + managed PostgreSQL + R2 + providers; Cloudflare | Real data; backups; audit |

Promotion: `main` → staging automatically on merge; production by tagged release with manual approval; migrations run before app rollout; health checks gate traffic; rollback = previous image tag plus backward-compatible migrations.

### 13.12 Component communication summary

| From → To | Protocol | Notes |
|---|---|---|
| Browser → web | HTTPS | SSR pages, static assets |
| Browser → api | HTTPS JSON (`/api/v1`), WebSocket/SSE | Cookie session; CSRF token on mutations |
| web (server) → api | HTTP (internal network) | Forwarded session cookie; short timeouts |
| api → PostgreSQL | TCP (pooled) | Prisma |
| api/worker → Redis | TCP | Cache, queues, pub/sub |
| api ↔ worker | BullMQ jobs and Redis pub/sub events | No direct HTTP |
| worker → Judge0 | HTTP on private network | API token; no public exposure |
| api/worker → providers | HTTPS | Adapters with timeouts, retries, circuit breakers |
| Browser → object storage / video provider | HTTPS presigned/tokenised | Never with long-lived credentials |

---
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
## 16. Security Plan

### 16.1 Sensitive data inventory

| Data | Sensitivity | Protection |
|---|---|---|
| Credentials (password hashes, refresh tokens, OTP hashes) | Critical | Argon2id; hashed tokens; never logged; rotation |
| Student personal data (contact, addresses, guardian contact, documents, DOB) | High (DPDP personal data) | Field gating (`students:read_sensitive`), encryption at rest (database and storage encryption), minimal collection **[Q-30]**, consent capture, erasure workflow |
| Assessment content (hidden tests, reference solutions, answer keys) | High (business) | Never sent to clients; access audited; exports restricted |
| Scores, attendance, placement outcomes | Medium–High | Scope-based access; audit |
| Company contacts and packages | Medium | Placement role only |
| Integration secrets (API keys) | Critical | Environment/host secrets; encrypted settings; write-only UI; rotation runbook |
| Audit logs | High | Append-only; restricted read |
| AI conversations | Medium | Retention limits; no sensitive data in prompts |

### 16.2 Controls

| Area | Controls |
|---|---|
| Password security | Argon2id (memory 64 MB, iterations tuned), minimum 10 characters, deny common/breached passwords (optional k-anonymity check), reset tokens single-use and expiring, no password hints, forced reset on compromise |
| Session and token security | Access JWT 15 min signed with rotated keys (kid in header), refresh tokens 30 days, rotation on every use with reuse detection (revokes family), httpOnly Secure SameSite cookies, server-side session records with device list and revocation, logout-all on password change/role change/deactivation, staff two-factor (Standard) |
| RBAC | Deny by default; permission + scope guards; route-table lint; matrix tests; sensitive-field gating; impersonation audited and time-boxed |
| Input validation | Zod at every boundary (HTTP, jobs, imports, webhooks); size limits; strict enums; file MIME sniffing; HTML sanitisation for rich text (allowlist) on input and safe rendering on output |
| SQL injection | Prisma parameterised queries; raw SQL only with tagged templates and reviewed; no string-built SQL; least-privilege DB user for the app (no DDL at runtime) |
| XSS | React escaping; sanitised rich text (DOMPurify-equivalent server-side); strict Content Security Policy (no inline scripts except nonces, restricted `frame-src` for video providers), `X-Content-Type-Options`, `Referrer-Policy`, Trusted Types where supported; Web Lab preview in sandboxed iframe with its own CSP |
| CSRF | SameSite cookies plus double-submit CSRF token on cookie-authenticated mutations; Origin checks on WebSocket handshake |
| Rate limiting and abuse | Redis token buckets per user/IP/route class; login/OTP throttles; execution quotas; Cloudflare WAF and Turnstile on public forms; bot detection on OTP send |
| File-upload security | Presigned uploads to private buckets; type/size limits by context; MIME sniffing; filename sanitisation; optional ClamAV; images re-encoded; PDFs served with `Content-Disposition` and no inline JS; no execution of uploaded content |
| API security | HTTPS only (HSTS); CORS allowlist; problem+json errors without stack traces; request IDs; security headers; OpenAPI docs not public in production; webhook signature verification (video/email providers) |
| Secrets management | Environment variables injected by host/CI; `.env` never committed; secrets encrypted at rest when stored in DB (integration configs) using a key from the environment; rotation procedure documented; separate keys per environment |
| Audit logging | All mutations of sensitive entities and all admin actions; append-only; includes actor, IP, request ID, before/after; retained 3 years; reviewed on incidents |
| Data privacy | Consent at invitation acceptance; privacy notice; purpose-limited fields; data export and erasure requests processed within SLA; anonymisation preserves aggregates; DPDP Act 2023 alignment reviewed with the client's legal advisor **[A-14]**; no third-party trackers without consent |
| Backup and recovery | Managed DB PITR or nightly base + WAL to R2; bucket versioning for certificates/documents; weekly automated restore test in staging; documented RPO/RTO; encrypted backups; access restricted |
| Secure coding practices | Code review on every PR; linting with security rules; dependency scanning (npm audit, Dependabot/Renovate, CodeQL); no dynamic `eval`; typed everywhere; threat model updated per phase; security checklist in Definition of Done |
| Code-execution isolation | §10.6 |
| Dependency management | Lockfiles committed; pinned major versions; automated update PRs; monthly review; SBOM generated in CI; base images pinned and rebuilt monthly |
| Infrastructure | Firewall: only 80/443 to app VM, SSH by key from allowlisted IPs, execution VM private-only; automatic OS security updates; Docker socket not exposed; non-root containers; read-only filesystems where possible; Cloudflare proxy hides origin IPs |
| Monitoring and response | Sentry alerts; anomaly alerts (login failures, export spikes, execution abuse); incident runbook; contact points; post-incident review |
| Test integrity | Server-side timing; question pools; integrity events; results release control; staff-only answer keys |

### 16.3 Threat model highlights

| Threat | Mitigation |
|---|---|
| Student runs malicious code to reach the database or network | Isolated execution VM without credentials or network; sandbox limits; security test suite |
| Credential stuffing on student accounts | Throttling, breached-password checks, optional OTP, alerting |
| Answer-key leakage via API | Separate DTOs for student views; tests assert absence of `isCorrect`/hidden tests in student responses |
| Trainer accesses other batches' data | Scope guard + query filters; matrix tests |
| Mass export of personal data | Export permission, caps, audit, alerts |
| Prompt injection through lesson/question content or student messages to the AI | Student content treated as data; system prompt policies; no tools with side effects; output filters |
| Compromised provider key | Least-privilege keys; rotation; monitoring of usage |

---

## 17. Testing Strategy

### 17.1 Test pyramid and tools

| Level | Scope | Tools | Where it runs |
|---|---|---|---|
| Unit | Services, formulas (progress, attendance %, scoring, eligibility, streaks), validators, utilities | Vitest | Every commit |
| Integration | Module + database (Testcontainers PostgreSQL/Redis), queues, repositories, migrations | Vitest + Testcontainers + Prisma | Every PR |
| API / contract | Every endpoint against a running API with seed data; OpenAPI schema conformance; permission matrix | Supertest, openapi-validator | Every PR |
| Component | UI components and forms with states (loading/empty/error), accessibility snapshots | Vitest + Testing Library + axe | Every PR |
| End-to-end | Critical journeys per role in a real browser (Chromium, WebKit, mobile emulation) | Playwright | Nightly and before release; smoke subset on PR |
| Role-permission | Matrix-driven allow/deny tests for all (role, endpoint, scope) combinations | Generated Supertest suites | Every PR |
| Responsive | Screenshot tests at 360/768/1024/1280 for key pages | Playwright | Nightly |
| Accessibility | axe on every page in E2E; manual screen-reader passes for player, test attempt, editors | axe-playwright, manual | Per phase |
| Security | Dependency scan, CodeQL, ZAP baseline scan on staging, execution sandbox suite (fork bomb, infinite loop, network, filesystem, huge output), auth abuse tests | GitHub Actions, OWASP ZAP, custom | Weekly and per release |
| Performance / load | Dashboard, lists, test attempt autosave, 50 concurrent submissions, 200 concurrent test takers | k6 | Per phase gate and before launch |
| Coding-execution | Language matrix (compile/run for every catalogued language), limits, verdict mapping, batch results, retries | Custom suite against staging Judge0 | Every execution change |
| Regression | All above on `main`; flaky-test quarantine with owner and deadline | CI | Continuous |
| User acceptance | Client walkthrough scripts per phase with pass/fail and sign-off | Staging | Phase gates |

### 17.2 Example acceptance criteria per module

| Module | Examples (in addition to §4.4 criteria) |
|---|---|
| Authentication | Invitation → password set → login works; 6th failed login within 15 min is throttled; refresh token reuse revokes the session family; password reset link expires after 30 min. |
| RBAC | Every endpoint in the route table has a permission or is public; trainer cannot read another batch's attendance (403); student cannot call staff endpoints. |
| Students & batches | Import 200 rows with 5 duplicates: 195 created, duplicates reported; transferring a student keeps attendance history in the old batch. |
| Courses | Publishing a course version does not change what students already completed; signed video URL rejected after expiry; resume position persists across devices. |
| Live sessions | Series generation respects holidays; reminders sent at T-24 h and T-30 min in IST; cancelling notifies students. |
| Attendance | Percentage formula verified with fixtures; correction after 48 h blocked for trainers, allowed for admin with reason. |
| Question bank | Coding question fails validation when the reference solution fails a test; import report lists row errors. |
| Assignments | Locked module cannot receive submissions (409); explanation hidden until policy allows; progress equals solved/total. |
| Tests | Deadline enforced server-side; reload restores state; result hidden until release; two tabs cannot create two attempts. |
| Execution | Infinite loop → TLE within limit; network call → fails; 50 concurrent submissions p95 < 10 s; hidden tests absent from responses. |
| Projects | Rework → resubmission creates version 2; rubric totals correct. |
| Certificates | Rule met → certificate within 5 min; verification page correct; revoke reflected. |
| Placement | Eligibility rules filter correctly; application snapshot resume; stage change notifies; funnel report matches. |
| Feedback | Anonymous responses unlinkable; aggregates hidden under 5 responses. |
| Reports | Each metric matches fixture expectations; export row counts equal filtered totals; trainer scope enforced. |
| Notifications | Preferences honoured; digest batching works; provider failure retried. |
| AI | Flag off → no calls; quota enforced; hint policy prevents solution leakage on the red-team set. |

### 17.3 Test data and environments

Deterministic seed data (institute with 3 programmes, 6 batches, 300 students, 8 trainers, 12 courses, 2,000 questions, 20 companies, 30 drives) generated by scripts; factories for tests; anonymised production snapshots never used in local development; staging refreshed from seed or anonymised data on demand.

### 17.4 Definition of Done (per feature)

Code reviewed; unit/integration/API tests added and green; permission tests updated; OpenAPI updated and client regenerated; migrations reviewed; accessibility checks pass; docs (feature page in `/docs`) updated; feature flag and settings documented; demoed on staging; acceptance criteria verified by the client or product owner.

---

## 18. Deployment and Operations

### 18.1 Repository and delivery pipeline

- Monorepo (pnpm workspaces + Turborepo): `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/ui`, `packages/config`, `infra/` (Docker, compose files, deploy scripts), `docs/`.
- Branching: trunk-based with short-lived feature branches; conventional commits; PR template with checklist; required CI checks; squash merges.
- CI (GitHub Actions): lint, type-check, unit/integration/API tests (Testcontainers), build images, contract tests, E2E smoke, security scans; artefacts: images tagged with commit SHA and semver on release.
- CD: merge to `main` → deploy to staging automatically; release tag → production deploy with manual approval; migrations executed before rollout with backup snapshot; health checks; rollback procedure.

### 18.2 Runtime topology (production)

| Component | Where | Notes |
|---|---|---|
| Reverse proxy (Caddy/Traefik) | App VM | Automatic TLS; routes `app.` → web, `api.` → api; rate limits at edge via Cloudflare |
| web (Next.js) | App VM (container, 1–2 replicas) | Stateless |
| api (NestJS) | App VM (container, 1–2 replicas) | Stateless; Socket.IO with Redis adapter |
| worker (NestJS) | App VM (container) | Queues; PDF rendering |
| execution worker | Execution VM (container) | Bridges queue → Judge0 |
| Judge0 (server, workers, its own PostgreSQL and Redis) | Execution VM | Private network only |
| PostgreSQL | Managed service | PITR backups |
| Redis | App VM (container) or managed | Persistence enabled for queues |
| Object storage | Cloudflare R2 | Private buckets |
| Video | Bunny/Cloudflare Stream | Token auth |
| Monitoring | Sentry, uptime monitor, metrics stack | Alerts to email/Slack |

### 18.3 Environment configuration

All configuration via environment variables validated at boot (`APP_ENV`, `DATABASE_URL`, `REDIS_URL`, `STORAGE_*`, `VIDEO_*`, `EMAIL_*`, `JWT_*`, `EXECUTION_URL`, `EXECUTION_TOKEN`, `AI_API_KEY`, `FEATURE_*` defaults); secrets from host secret store or CI secrets; `.env.example` documents every variable with description and example (no real values).

### 18.4 Operations runbooks (to be written in Phase 1 and extended per phase)

Deploy and rollback; database migration failure; restore from backup; rotate secrets; Judge0 upgrade and security test; queue backlog; provider outage (email/video/AI); incident response and communication; onboarding a new developer; monthly maintenance (dependency updates, image rebuilds, backup verification, log review).

### 18.5 Capacity and scaling path

Start: 1 app VM (4 vCPU/8 GB) + 1 execution VM (4 vCPU/8 GB) + managed PostgreSQL (2 vCPU/4 GB class) handles the assumed 5,000 students / 500 concurrent users **[A-10]**. Scale path: vertical first; then API replicas behind the proxy; then separate worker VM; add Judge0 workers; read replica for reports if needed. Nothing in the design prevents moving to Kubernetes later, but nothing requires it.

### 18.6 Service-level targets (proposed)

Availability 99.5% monthly for the app (excluding provider outages); p95 API latency < 300 ms for list endpoints and < 800 ms for dashboards; grading latency p95 < 10 s; support response for P1 incidents within 1 hour during business hours **[Q-03]**.

---
## 19. Development Roadmap

### 19.1 Principles

- Phases are sequential gates: a phase starts only when its dependencies are complete, tested and approved (Rule 25, §22).
- Each phase ends with a demo on staging, a written test report, updated documentation and a sign-off.
- Three releases are planned: **MVP** (after Phase 6a plus a hardening sprint), **Standard** (after Phase 8), **Advanced** (after Phase 9). Phase 10 (hardening and launch) is executed before each release.
- Durations assume a team of 2–3 engineers (one full-stack lead, one full-stack, optionally one front-end/QA) and prompt client decisions. They are planning ranges, not commitments.

### 19.2 Phase plan

| Phase | Objectives | Features / deliverables | Dependencies | Risks | Testing | Completion criteria | Duration |
|---|---|---|---|---|---|---|---|
| **PH-0 Requirements and architecture approval** | Agree scope, decisions, stack and rules | This report revised; answers to §21; approved feature tiers; product name and brand assets; provider accounts decided | Client review | Delayed decisions delay everything | — | Approval checklist (§24) signed | 1–2 weeks (client-driven) |
| **PH-1 Project setup and foundation** | Working skeleton with CI/CD, Docker, conventions | Monorepo; `apps/web`, `apps/api`, `apps/worker`, `packages/*`; Docker Compose (Postgres, Redis, MinIO, Mailpit, Judge0 placeholder); Prisma baseline; health endpoints; design tokens and base components (shell, table, form, states); OpenAPI generation and client; GitHub Actions (lint, test, build, deploy to staging); staging environment; seed framework; `docs/` structure with ADRs, progress log, runbooks skeleton; coding standards | PH-0 | Over-engineering the foundation; environment access delays | Pipeline runs green end to end; smoke E2E on staging | New developer can run the stack locally in < 1 hour; staging reachable; ADR-001…005 written (stack, auth, RBAC, storage, execution) | 2 weeks |
| **PH-2 Authentication and roles** | Secure identity and permissions | F-01 (email/password, invitations, reset, sessions), F-02 (roles, permissions, guards, scope), F-26 basics (settings table, feature flags, audit interceptor), user menu, theme | PH-1 | Subtle auth bugs | Auth flow tests; permission matrix tests; security tests (throttling, token reuse) | AC-16.2, AC-16.3 pass; every route declares permission | 2 weeks |
| **PH-3 Admin and student management** | Onboard people and batches | F-03 (users, students, import, verification), F-04, F-05 (programmes, batches, members, trainers), F-20 (in-app + email notifications, announcements), F-25 (basic search), admin shell and tables, trainer shell | PH-2 | Import edge cases; data model churn | Import fixtures; state machines; E2E admin flows | AC-16.1; a batch with trainers and 200 students can be created in under 30 minutes | 2–3 weeks |
| **PH-4 Course and learning management** | Deliver content and classes | F-06 (builder, catalogue, player, publications), F-07 (file registry, presigned uploads), video provider adapter, F-08 (series, occurrences, reminders, calendar), F-13 (roll-call attendance, corrections), F-14 (activity events, progress), student dashboard and schedule | PH-3; video provider account | Video integration; timezone bugs; progress consistency | Player E2E; recurrence tests; attendance formula tests; load test on lesson progress writes | AC-03.x, AC-04.x, AC-05.x, AC-02.x pass | 3–4 weeks |
| **PH-5 Assignments and assessments** | Practice and testing without code execution | F-09 (MCQ/true-false/fill/descriptive authoring, import, versions; coding/SQL/web authoring UI prepared), F-10 (assignments, modules, unlocking, submissions, grading queue), F-11 (tests, schedules, attempt engine, autosave, results, release, monitor), F-19 core metrics (students, active, batch-wise, course-wise, attendance, completion, scores, assignment status) with XLSX/CSV export | PH-4 | Attempt engine correctness under load; grading edge cases | Timer/concurrency tests; grading fixtures; load test 200 concurrent test takers; metric fixture tests | AC-06.x, AC-07.x, AC-01.1–01.3 pass | 3–4 weeks |
| **PH-6a Coding practice (MVP)** | Secure code execution and coding questions | Execution VM with Judge0; F-12 service (queue, worker, quotas, verdicts, SSE); F-12a Code Practice (problem list/workspace, points); coding questions inside assignments and tests; execution monitoring; security test suite; runbook | PH-5; execution VM | Sandbox setup on host; performance; abuse | Language matrix; limit/abuse suite; 50-concurrent load; E2E solve flows | AC-08.1–08.3 pass; security suite green; MVP release gate (PH-10 mini) | 3 weeks |
| **MVP hardening and release (PH-10 pass 1)** | Launch the MVP | Security scan, load tests, UAT with a pilot batch, docs, training for admins/trainers, production setup, backups verified, go-live, 2-week hypercare | PH-6a | Pilot feedback volume | Full regression; UAT scripts | Pilot batch runs one full week on production without P1 incidents | 2 weeks |
| **PH-6b Labs (Standard)** | Remaining practice modes | F-12b Debug Challenges, F-12c Playground, F-12d SQL Lab (SQLite via Judge0; MySQL runner if required), F-12e Web Lab (sandboxed iframe + checks), authoring editors P-G02/G03 | PH-6a | SQL dialect decision; iframe sandbox hardening | Lab-specific suites | AC-08.4; SQL comparison fixtures | 2–3 weeks |
| **PH-7 Progress, gamification and reports** | Complete the admin dashboard and engagement loop | F-19 full (all 15 metrics incl. projects/placement/certificates/feedback placeholders until their modules land; PDF exports; scheduled reports; definitions), F-22 (points, streaks, leaderboards, badges), F-14 derived skills, trainer performance report, report pages for trainers/placement scope | PH-6a | Aggregation performance; metric definition disputes | Metric fixtures; PDF snapshot tests; performance tests | AC-01.4; all metrics documented; leaderboard opt-out works | 2–3 weeks |
| **PH-8a Projects, certificates, feedback, doubts, events** | Standard learning extras | F-15, F-16, F-18, F-27, F-28; CR-S03/S04 dashboard widgets | PH-7 | Certificate design approval | Feature suites | AC-09.x, AC-10.x, AC-13.x pass | 2–3 weeks |
| **PH-8b Placement and career** | Placement module | F-17 (companies, drives, eligibility, pipeline, offers, kits, readiness, reports), F-21 resume generator, student drives board/tracker, placement dashboard | PH-8a; placement team decisions (Q-06, Q-28) | Eligibility rule complexity; process fit with the placement team | Rule engine fixtures; pipeline E2E; report reconciliation | AC-11.x, AC-12.x pass; Standard release gate (PH-10 pass 2) | 3 weeks |
| **PH-9 Additional integrations and AI (Advanced)** | Optional integrations and AI features | OTP login (after DLT), QR attendance, Zoom/Meet API (optional), SMS/WhatsApp adapters, calendar sync, F-23 AI assistant, F-24 mock interviews, public portfolio, advanced analytics, test-integrity extras | PH-8; AI budget and provider keys; DLT registration | AI quality and cost; provider approvals (DLT can take weeks) | Prompt regression suite; cost tests; integration sandboxes | AC-14.x pass; cost dashboard; client accepts quality on evaluation set; Advanced release gate (PH-10 pass 3) | 3–5 weeks |
| **PH-10 Testing, hardening and deployment** | Release readiness (run before each release) | Full regression, security scan (ZAP, dependency, sandbox suite), load test, accessibility audit, UAT, documentation freeze, release notes, production deployment, monitoring review, backup/restore drill, hypercare | Preceding phase | Late-found defects | All suites | Release checklist complete; sign-off | 1–2 weeks per release |

### 19.3 Timeline summary

| Release | Phases | Cumulative duration (2–3 engineers) |
|---|---|---|
| MVP | PH-1 → PH-6a + hardening | 14–18 weeks |
| Standard | + PH-6b, PH-7, PH-8a, PH-8b + hardening | + 8–12 weeks (22–30 total) |
| Advanced | + PH-9 + hardening | + 6–10 weeks (28–40 total) |

Client-side prerequisites that can start immediately during PH-0: provider accounts (domain, Cloudflare, video hosting, email), hosting account, brand assets, SMS DLT registration (if OTP is wanted), content inventory (videos, question banks, company kits), pilot batch selection, and answers to §21.

---

## 20. Complexity, Cost and Risk Analysis

### 20.1 Technical complexity by feature

| Complexity | Features | Notes |
|---|---|---|
| **Low** | F-04 trainer management, F-25 basic search, F-28 events, bookmarks, announcements, certificate verification page | Standard CRUD on the foundation |
| **Medium** | F-01 auth, F-02 RBAC, F-03 users/import, F-05 batches, F-07 files, F-08 schedule, F-13 attendance, F-14 progress, F-15 projects, F-16 certificates, F-18 feedback, F-20 notifications, F-21 profile/resumes, F-22 gamification, F-26 admin, F-27 doubts | Well-understood patterns; complexity is in rules and edge cases |
| **High** | F-06 courses (builder + video + progress), F-09 question bank (all types, versions, validation), F-10 assignments, F-11 tests (attempt engine), F-17 placement (rules, pipeline), F-19 reports (definitions, aggregates, exports), F-12d SQL Lab, F-12e Web Lab, F-23 AI assistant | Multi-module interactions, concurrency, or integration |
| **Very high** | F-12 execution service and F-12a coding practice (infrastructure, security, performance), F-24 AI mock interviews (quality evaluation) | Specialist infrastructure and evaluation work |

### 20.2 Development effort versus external service costs

**Development effort** is the engineering time in §19 (planning ranges). **External service costs** are recurring third-party fees, listed below with the figures verified in September 2026 (Appendix C). All are to be re-verified at procurement; taxes (GST) are excluded.

| Service | Assumed usage (5,000 students, 500 concurrent) | Indicative monthly cost | Source basis |
|---|---|---|---|
| App VM (4 vCPU / 8 GB) | 1 | USD 25–60 | Vendor list prices; Hetzner shared plans were €8.49–€15.99 before becoming unavailable in Sept 2026; DigitalOcean/AWS Lightsail comparable |
| Execution VM (4 vCPU / 8 GB) | 1 | USD 25–60 | Same |
| Managed PostgreSQL | Small instance, ~20 GB | USD 15–80 | Neon: USD 0.106/CU-hour + USD 0.35/GB-month (Launch); DigitalOcean managed from ~USD 15 |
| Object storage (R2) | 500 GB resources/docs/exports | ≈ USD 8 (+ operations) | USD 0.015/GB-month, egress free |
| Video hosting | 500 h library, 50,000 viewing hours/month (≈ 3 M minutes) | Bunny Stream: roughly USD 40–120 (storage by GB + delivery ≈ USD 0.005/GB); Cloudflare Stream: ≈ USD 150 storage (30,000 min × USD 5/1,000) + ≈ USD 3,000 delivery (3 M min × USD 1/1,000) | Cloudflare Stream delivery pricing makes it expensive at high viewing volumes; Bunny's per-GB model suits long recordings. **Volume assumptions must be confirmed [Q-13].** |
| Email | 50,000/month | USD 0–20 | Resend free 3,000/month; Pro USD 20 for 50,000 |
| SMS OTP (optional) | 20,000 OTPs/month | Provider-specific (Indian SMS typically fractions of a rupee per message; DLT registration required) — **verify** | Not verified |
| Code execution | Self-hosted Judge0 | USD 0 beyond the execution VM; Judge0 Cloud alternative €27–107/month for 2,000–10,000 submissions/day | judge0.com |
| Error monitoring / uptime | Sentry developer/team tier, Uptime Kuma self-hosted | USD 0–30 | Vendor tiers |
| Cloudflare (DNS, proxy, WAF basics, Turnstile) | Free plan | USD 0 | — |
| Domain and certificates | 1 domain; TLS via Let's Encrypt | ≈ USD 1–2 (annual fee amortised) | — |
| AI features (Advanced) | See sensitivity table | USD 0 with flag off; otherwise budget-driven | Anthropic price table |
| **Total without AI and SMS** | | **≈ USD 100–300/month** (Bunny Stream) or **≈ USD 250–3,300/month** (Cloudflare Stream at high viewing volume) | |

**AI cost sensitivity (illustrative).** Assumptions: 1,000 active students, 10 assistant messages per student per day, ~1,500 input tokens and ~400 output tokens per message, 30 days → 300,000 messages/month.

| Model | Price (input / output per million tokens) | Cost per message | Monthly cost | With ~50% cached input (prompt caching) |
|---|---|---|---|---|
| `claude-opus-5` (default, highest quality) | USD 5 / USD 25 | ≈ USD 0.0175 | ≈ USD 5,250 | ≈ USD 3,800 |
| `claude-sonnet-5` | USD 2 / USD 10 | ≈ USD 0.007 | ≈ USD 2,100 | ≈ USD 1,500 |
| `claude-haiku-4-5` (simple modes only) | USD 1 / USD 5 | ≈ USD 0.0035 | ≈ USD 1,050 | ≈ USD 750 |

Quotas (messages/day/student) and per-batch enablement are the budget controls; the client sets the monthly ceiling and the model per mode after an evaluation of answer quality **[Q-20]**. Mock interviews cost more per session (longer contexts) and should be quota-limited (e.g. 2 per student per week).

### 20.3 Risk register

| ID | Category | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | Scope | Requirements are a wish-list; scope creep during build | High | High | Approved tiers and change-control (Rule 24); backlog with IDs; phase gates | Client + lead |
| R-02 | Scope | Trainer/placement workflows assumed without client input | Medium | High | Q-06 and Q-28 before PH-3/PH-8; prototype reviews with the actual staff | Client |
| R-03 | Development | Test attempt engine correctness under concurrency | Medium | High | Server-authoritative design, fake-clock tests, load tests in PH-5 | Lead |
| R-04 | Infrastructure | Judge0 host setup (kernel/cgroup requirements) and performance | Medium | High | Provision execution VM early in PH-6a; follow vendor install notes; fallback to Judge0 Cloud | Lead/DevOps |
| R-05 | Security | Sandbox escape or resource abuse | Low | Critical | Isolated VM, no credentials, limits, quotas, security suite, patching | Lead |
| R-06 | Security | Personal data exposure (guardian contacts, documents) | Medium | High | Field gating, encryption, minimisation (Q-30), audit, DPDP review | Lead + client legal |
| R-07 | Integration | Video provider limits or cost surprises at high viewing volumes | Medium | Medium | Adapter abstraction; volume estimate (Q-13); monitor delivery minutes; choose per-GB pricing | Client + lead |
| R-08 | Integration | SMS OTP delayed by DLT registration | High | Low | Email/password first; OTP as Standard; start registration early | Client |
| R-09 | Cost | AI usage exceeds budget | Medium | Medium | Flags, quotas, budget alerts, model per mode, caching | Client + lead |
| R-10 | Maintenance | Small team bus factor | Medium | High | Documentation, ADRs, runbooks, conventional structure, tests | Lead |
| R-11 | Development | Content authoring effort underestimated (videos, questions, kits are the client's work) | High | High | Content inventory in PH-0; import tools early (PH-5); content freeze dates per batch | Client |
| R-12 | Infrastructure | Backup/restore never tested | Medium | Critical | Weekly automated restore drill in staging; runbook | DevOps |
| R-13 | Development | Framework major upgrades (Next.js, NestJS, Prisma) mid-project | Medium | Medium | Pin versions in PH-1; upgrade only at phase boundaries with ADR | Lead |
| R-14 | Scope | Reference-portal features assumed necessary (e.g. employability score) | Medium | Low | Explicit tiering; client confirms per feature | Client |
| R-15 | Cost | Hosting vendor availability/pricing changes (e.g. Hetzner shared plans unavailable in Sept 2026) | Medium | Low | Vendor-agnostic Docker deployment; two candidate vendors | DevOps |
| R-16 | Security | Answer-key leakage through API responses | Low | High | Separate student DTOs; automated response-shape tests | Lead |
| R-17 | Development | Trademarked feature names reused | Low | Medium | Rename now (C-01) | Client |

---
## 21. Open Questions and Decisions Required

Questions marked **Blocking** must be answered before Phase 1 starts; others are needed before the phase indicated. Each has a proposed default that will be used if the client prefers to defer.

| ID | Question | Why it matters | Proposed default | Needed by | Blocking |
|---|---|---|---|---|---|
| Q-01 | What is the product name (and public domain)? | Branding in UI, emails, certificates, routes | Working codename "LMS" | PH-1 | Yes |
| Q-02 | Brand assets: logo, colours, typography? | Design tokens, certificate design | Neutral palette with one accent until provided | PH-1 | Yes |
| Q-03 | Expected volumes and service levels: students per year, concurrent users, availability target, support hours? | Sizing, SLA, cost | ≤ 5,000 students, 500 concurrent, 99.5% | PH-1 | Yes |
| Q-04 | Hosting region and vendor preference; existing accounts (AWS/DO/Hetzner/Cloudflare)? | Latency, data residency, cost | India/Singapore region on DigitalOcean or AWS Lightsail + managed PostgreSQL; Cloudflare | PH-1 | Yes |
| Q-05 | Definitions: "student" (enrolled only?), "active student" (7/30 days), "course completion" (100% mandatory lessons?), "assignment done" (100%?) | Admin metrics correctness | As proposed in §4.2 and card R-01 | PH-5 | No |
| Q-06 | Will trainers and a placement team actually use the platform, and who are they? | Trainer and placement portals scope | Yes to both | PH-3 / PH-8 | Yes |
| Q-07 | Are payments, fee tracking or invoices in scope? | Adds a module and gateway | Out of scope | PH-0 | Yes |
| Q-08 | Programme/course structure: do batches follow a fixed programme of courses, or are courses assigned ad hoc? | Data model | Programme templates with per-batch overrides | PH-3 | No |
| Q-09 | Login method for students: email/password, mobile OTP, or both? Staff two-factor? | Auth design, SMS costs, DLT | Email/password (MVP), OTP (Standard), staff 2FA (Standard) | PH-2 | Yes |
| Q-10 | What are "webinars and workshops" and "interview progress" in your operation? | CR-S03/S04 modelling | Events module (Standard); mock interview attendance | PH-8 | No |
| Q-11 | Which live-class tool (Zoom, Google Meet, other)? Is API integration (auto-create meetings, join logs, cloud recordings) wanted? | Schedule design, attendance automation, cost | Links only in MVP; API integration optional later | PH-4 | No |
| Q-12 | Attendance method: trainer roll-call, QR in classroom, automatic from online joins? Are classes offline, online or both? | Attendance design | Roll-call (MVP), QR (Standard) | PH-4 | No |
| Q-13 | Where are existing videos today, how many hours, expected monthly viewing hours, and is a paid video host acceptable? | Video cost and migration | Bunny Stream; migrate library in PH-4 | PH-4 | Yes |
| Q-14 | Programming languages for coding questions at launch? | Runtime catalogue, tests | Java, Python, JavaScript, C, C++, SQL | PH-6a | No |
| Q-15 | SQL dialect for SQL Lab: MySQL-specific syntax required, or is SQLite/PostgreSQL-compatible SQL acceptable? | SQL runner design | SQLite first; MySQL runner if required | PH-6b | No |
| Q-16 | Trainer performance: formula, weights, and who may see it? | Sensitive HR metric | Composite (attendance, scores, feedback, punctuality); Admin only | PH-7 | No |
| Q-17 | Student feedback: anonymous by default? Frequency? | Feedback design | Anonymous, weekly per batch | PH-8a | No |
| Q-18 | Certificate design, signatory, issuance rules, QR verification? | Certificates | Course completion at 100% mandatory lessons + test average ≥ 50%; QR verification | PH-8a | No |
| Q-19 | Test integrity level: basic (timer, shuffling, tab-switch logging) or stricter (lockdown, proctoring)? | Assessment design | Basic; proctoring out of scope | PH-5 | No |
| Q-20 | AI features: approved? Monthly budget? Model preference (quality vs cost)? Text-only interviews acceptable? | Advanced scope and cost | Approved for Advanced tier, flag-gated, budget to be set | PH-9 | No |
| Q-21 | Student profile fields: which are mandatory, which sensitive fields are needed (guardian contact, permanent address, social links)? | Privacy, form design | Minimal mandatory set; sensitive fields optional | PH-3 | No |
| Q-22 | Report and PDF branding, required charts, scheduled report recipients? | Reports | Institute logo header; standard charts | PH-7 | No |
| Q-23 | Gamification: streaks, points and leaderboards wanted? Public or opt-in leaderboards? | Engagement design | Yes, opt-in display names | PH-7 | No |
| Q-24 | Course discussions and ratings wanted? | Course features | Standard tier | PH-8a | No |
| Q-25 | Are there offline classrooms needing QR/in-person attendance? | Attendance | Yes (Standard) | PH-6b | No |
| Q-26 | Existing question banks, tests and company kits: formats and volumes for migration? | Import tools | XLSX/CSV/JSON importers | PH-5 | No |
| Q-27 | Expected peak concurrent code submissions and test takers? | Execution sizing | 50 submissions, 200 test takers | PH-6a | No |
| Q-28 | Placement eligibility rules used today (passing year, degree, attendance, scores, backlogs)? | Rule engine | Rules as proposed in F-17 | PH-8b | No |
| Q-29 | Should hiring companies get any portal access? | Future scope | No | Future | No |
| Q-30 | Can sensitive personal fields be minimised (drop Instagram, native city, guardian contact unless needed)? | Privacy | Minimise | PH-3 | No |
| Q-31 | Self-registration or invite-only accounts? | Auth and onboarding | Invite-only | PH-2 | Yes |

Blocking questions: Q-01, Q-02, Q-03, Q-04, Q-06, Q-07, Q-09, Q-13, Q-31 (plus renaming confirmation C-01).

---

## 22. CLAUDE DEVELOPMENT OPERATING RULES

These rules govern all AI-assisted development on this project. They are binding for Claude (and any other assistant) and are to be copied into the repository as `docs/CLAUDE_OPERATING_RULES.md` and referenced from `CLAUDE.md` when the project structure is created (Step 8).

### 22.1 Process rules

1. **Do not start coding before the approved architecture is available.** Development begins only after the client approves this report (§24) and the Phase 8 deliverables (structure, conventions, backlog).
2. **Do not invent requirements.** Implement only items that exist in the approved backlog with an ID. If something seems missing, raise it as a question or a proposed backlog item; do not build it speculatively.
3. **Do not silently change the technology stack.** Any deviation from §12 requires an Architecture Decision Record (ADR) approved by the lead and, for cost-bearing changes, by the client.
4. **Do not modify unrelated modules.** A task touches the files it needs; incidental refactors go into a separate, clearly labelled change.
5. **Do not introduce unnecessary dependencies.** Prefer platform features and existing packages; a new dependency needs a one-line justification in the PR, a licence check and a maintenance assessment.
6. **Follow the approved folder structure** (Step 8 deliverable). New modules follow the module template.
7. **Follow consistent naming conventions**: kebab-case files, PascalCase components/classes, camelCase variables/functions, snake_case database columns, `resource:action` permissions, `PH-`/`F-`/`CR-` identifiers in commit and PR titles.
8. **Use environment variables for secrets and configuration.** Validate them at boot; document every variable in `.env.example`.
9. **Never hardcode credentials, API keys, tokens or personal data** in code, tests, fixtures, logs, documentation or commit messages.
10. **Follow secure coding practices** (§16): validate input, encode output, parameterise queries, least privilege, no `eval`, no disabling security controls to make something work.
11. **Keep frontend, backend and database responsibilities clear.** The frontend never accesses the database or storage directly; business rules live in API services; the database enforces integrity with constraints; workers run background work.
12. **Write maintainable, modular code**: small functions, explicit types, no cross-module repository imports, domain events for cross-module effects, comments only where intent is not obvious.
13. **Validate all inputs** at every boundary (HTTP, jobs, imports, webhooks, environment) with shared Zod schemas.
14. **Implement proper error handling**: typed domain errors, problem+json responses, no swallowed exceptions, no stack traces to clients, user-facing messages that say what to do next.
15. **Add tests for important functionality** before marking work complete: unit for rules, integration for data access, API for endpoints (including permission allow/deny), E2E for user journeys.
16. **Respect role-based access control**: every endpoint declares a permission and scope; every new permission is added to the catalogue, matrix and tests.
17. **Do not mark incomplete functionality as complete.** Partial work is reported as partial with what remains; no "TODO" hidden behind a green checkbox.
18. **Report blockers clearly and early**: missing decision, failing environment, unclear requirement, external dependency — state what is blocked, why, and what is needed.
19. **Ask for clarification when requirements are ambiguous** instead of guessing; when a guess is unavoidable to keep moving, state it explicitly as an assumption in the PR and progress log.
20. **Maintain a development progress log** (`docs/PROGRESS_LOG.md`): date, phase, items completed with IDs, tests run, blockers, next steps. Update it at the end of every working session.
21. **Record architectural decisions** as ADRs (`docs/adr/NNNN-title.md`: context, decision, alternatives, consequences, status).
22. **Keep database migrations version-controlled** (Prisma Migrate), reviewed, backward-compatible (expand/contract), and never edited after being applied to a shared environment.
23. **Do not perform destructive database operations without approval**: no dropping tables/columns, truncations, mass deletes or resets on shared environments without explicit written approval and a verified backup.
24. **Do not change approved scope without confirmation**: additions, removals and re-tiering go through the backlog with client confirmation.
25. **Complete one approved phase at a time**: do not start a later phase before its dependencies are completed, tested and approved.

### 22.2 Additional rules for reliable AI-assisted development

26. **Verify before asserting.** Do not claim that a page was inspected, a test passed, a command succeeded or a library API exists unless it was actually observed in this session. Quote outputs.
27. **Pin and check versions.** Use the versions recorded in the lockfile and `docs/STACK.md`; check the installed version before using an API; do not rely on memory for library signatures — read the installed package's types or docs.
28. **Run the checks before declaring done**: lint, type-check, unit/integration tests for touched modules, and the relevant E2E smoke; include the command output summary in the PR/progress log.
29. **Never disable or weaken tests, linters, type checks or security rules** to get a green build; fix the cause or raise a blocker.
30. **Keep changes small and reviewable**: one backlog item per PR where possible; PR description lists IDs, what changed, how it was tested, and any assumptions.
31. **Use the shared schema package** for validation and types; do not duplicate schemas in web or API.
32. **Regenerate the API client** after OpenAPI changes and commit it in the same PR.
33. **Timezones**: store UTC, display IST (Asia/Kolkata) via shared utilities; never use local machine time in business logic.
34. **Accessibility is part of done**: keyboard operability, labels, contrast and focus states for every new UI.
35. **Feature flags for anything optional or costly** (AI, gamification, OTP, labs): default off in production until approved.
36. **Do not log personal data or secrets**; use structured logs with IDs.
37. **No production data on local machines**; use seed data and factories.
38. **Document as you go**: every module has a `README.md` (purpose, entities, endpoints, jobs, flags, permissions); every runbook is updated when operations change.
39. **Idempotent and retry-safe jobs**: every background job can be re-run without side effects.
40. **Security checklist per PR**: input validation, permission declared, sensitive data handling, no new secrets, dependency review.
41. **Respect the three environments**: never point local tooling at production; production changes only through the pipeline.
42. **When a phase gate is reached, stop and report**: summarise deliverables, test evidence, open issues, and request approval before continuing.
43. **Do not copy code or content from the reference portal or other proprietary sources.** Use only the functional patterns documented here.
44. **Prefer explicit over clever**: readable code and obvious data flows over abstractions that only the author understands.
45. **Update this report and the backlog when reality changes**: if a decision or discovery invalidates a section, propose the amendment rather than working around it silently.

---

## 23. Final Recommendations

1. **Approve scope by tier, not by wish-list.** Confirm the MVP list (§6.8) and treat Standard and Advanced as separate, budgeted releases.
2. **Answer the nine blocking questions** (§21) and confirm the renaming of the practice modules before Phase 1.
3. **Start client-side prerequisites now**: provider accounts, brand assets, content inventory, pilot batch selection, and SMS DLT registration if OTP is wanted.
4. **Adopt the single-language TypeScript stack** (§12) and the modular-monolith architecture with two isolated processes (worker and execution). Resist microservices and vendor-locked backends.
5. **Isolate code execution from day one** on a separate VM with self-hosted Judge0; keep Judge0 Cloud as a documented fallback.
6. **Gate AI behind flags, quotas and budgets**, evaluate answer quality on a small set before enabling for all students, and choose the model per mode with cost visibility.
7. **Choose a per-GB video host** (Bunny Stream) unless viewing volumes are small; estimate viewing hours before committing.
8. **Use managed PostgreSQL** with point-in-time recovery; rehearse restores.
9. **Invest in import tools and content workflows early** (Phase 5); content readiness is the most common cause of launch delay.
10. **Run a pilot batch on the MVP** for at least one full week before general rollout, and keep two weeks of hypercare.
11. **Keep this report as the living project context**: update §4, §6, §19 and §21 at each phase gate; enforce §22 in every session.

---

## 24. Approval Checklist

| # | Item | Decision / signature | Date |
|---|---|---|---|
| 1 | Requirements inventory (§4.2–4.3) reviewed; interpretations accepted or corrected | ☐ Approved ☐ Changes requested | |
| 2 | Duplicates, conflicts and assumptions (§4.6–4.7) resolved | ☐ | |
| 3 | Reference portal analysis (§5) accepted as guidance | ☐ | |
| 4 | Product vision, boundaries and tiers (§6) approved; MVP feature list confirmed | ☐ | |
| 5 | Roles and permission matrix (§7) approved; trainer and placement usage confirmed (Q-06) | ☐ | |
| 6 | Page inventory and navigation (§8) approved as the basis for wireframes | ☐ | |
| 7 | Feature specifications (§9) approved for MVP features | ☐ | |
| 8 | Coding lab architecture (§10) approved, including isolated self-hosted execution and language list | ☐ | |
| 9 | UI/UX strategy (§11) approved; brand assets supplied or neutral default accepted | ☐ | |
| 10 | Technology stack (§12) approved; hosting and provider choices confirmed (Q-04, Q-13) | ☐ | |
| 11 | System architecture (§13) approved | ☐ | |
| 12 | Preliminary database design (§14) accepted as a starting point | ☐ | |
| 13 | API conventions (§15) approved | ☐ | |
| 14 | Security plan (§16) approved; privacy/legal review scheduled | ☐ | |
| 15 | Testing strategy (§17) and Definition of Done approved | ☐ | |
| 16 | Deployment and operations plan (§18) approved | ☐ | |
| 17 | Roadmap and phase gates (§19) approved; timeline understood as an estimate | ☐ | |
| 18 | Cost and risk analysis (§20) acknowledged; AI and video budgets set | ☐ | |
| 19 | Open questions (§21) answered or defaults accepted | ☐ | |
| 20 | Claude Development Operating Rules (§22) adopted | ☐ | |
| 21 | Practice module names confirmed (replacing CodeKata/WebKata/SQLKata/FixTheCode/IDE) | ☐ | |
| 22 | Authorisation to proceed to Step 8 (project structure, conventions, backlog) | ☐ | |

---

## Appendix A. Glossary

| Term | Meaning |
|---|---|
| Batch | A cohort of students following a programme together with fixed dates, trainers and timetable |
| Programme | A curriculum template (set of courses, duration, certificate) instantiated as batches |
| Course / Module / Lesson | Content hierarchy; lessons are video, reading, resources, practice or live recordings |
| Assignment | A practice set of question-bank items organised in modules, published to batches |
| Test | A timed, scheduled assessment with results and analytics |
| Practice / Lab | Self-directed problem solving: Code Practice, Debug Challenges, SQL Lab, Web Lab, Playground |
| Execution service | The isolated system (Judge0) that compiles and runs student code |
| Drive | A placement opportunity from a company with eligibility rules, rounds and deadline |
| Kit | A company-specific preparation bundle (documents, videos, question sets) |
| Employability / readiness score | A transparent composite of progress, scores, attendance and profile completeness (to be defined if adopted) |
| DPDP | India's Digital Personal Data Protection Act, 2023 |
| DLT | Telecom registration required in India to send commercial SMS (templates and sender IDs) |
| ADR | Architecture Decision Record |
| MoSCoW | Must / Should / Could / Won't (Not Planned) prioritisation |

## Appendix B. Requirement traceability matrix

| Requirement | Feature(s) | Key pages | Phase |
|---|---|---|---|
| CR-A01–A04 | F-03, F-05, F-19 | P-E01, P-E03, P-E07, P-E17 | PH-3, PH-5 |
| CR-A05 | F-13, F-19 | P-D04, P-E17, P-C01 | PH-4, PH-5 |
| CR-A06 | F-14, F-19 | P-E01, P-E17 | PH-4, PH-5 |
| CR-A07 | F-11, F-19 | P-E11, P-E17 | PH-5 |
| CR-A08 | F-10, F-19 | P-E10, P-E17 | PH-5 |
| CR-A09 | F-15, F-19 | P-E12, P-E17 | PH-8a |
| CR-A10 | F-04, F-19 | P-E05, P-E17 | PH-7 |
| CR-A11, A12 | F-17, F-19 | P-F01, P-F07, P-E17 | PH-8b |
| CR-A13 | F-16, F-19 | P-E13, P-E17 | PH-8a |
| CR-A14 | F-18, F-19 | P-E14, P-E17 | PH-8a |
| CR-A15 | F-19 | P-E17, P-E18 | PH-5 (XLSX), PH-7 (PDF, scheduled) |
| CR-S01, S02, S32 | F-14 | P-C01, P-C23 | PH-4 |
| CR-S03 | F-28 | P-C34, P-C01 | PH-8a |
| CR-S04 | F-15, F-17, F-24 | P-C01, P-C17 | PH-8 |
| CR-S05 | F-08 | P-C02, P-C01 | PH-4 |
| CR-S06, S08, S09 | F-06, F-07 | P-C03–C05 | PH-4 |
| CR-S07 | F-08 | P-C02, P-D02 | PH-4 (links), PH-9 (API) |
| CR-S10 | F-16 | P-C22, P-A02 | PH-8a |
| CR-S11 | F-12, F-12a | P-C13–C15, P-C08 | PH-6a |
| CR-S12 | F-12e | P-C14 (web), P-G03 | PH-6b |
| CR-S13 | F-12d | P-C14 (sql), P-G02 | PH-6b |
| CR-S14 | F-12b | P-C14 (debug) | PH-6b |
| CR-S15 | F-12c | P-C16 | PH-6b |
| CR-S16, S19, S31 | F-15, F-21 | P-C17, P-C23 | PH-8a |
| CR-S17 | F-09, F-10 | P-C06–C08, P-E09, P-E10 | PH-5 |
| CR-S18 | F-09, F-11 | P-C09–C12, P-E11 | PH-5 |
| CR-S20, S28 | F-24 | P-C31 | PH-9 |
| CR-S21, S33 | F-21 | P-C25 | PH-3 (upload), PH-8b (generate) |
| CR-S22 | F-21 | P-A04 | PH-9 |
| CR-S23, S24 | F-17 | P-C18–C21 | PH-8b |
| CR-S25, S26, S27 | F-23, F-27 | P-C30, P-C32, P-D09 | PH-8a (doubts), PH-9 (AI) |
| CR-S29, S30 | F-21 | P-C23, P-C24 | PH-3 |
| IR-01, IR-02 | F-01, F-02 | P-B01–B07 | PH-2 |
| IR-03–IR-05 | F-03–F-05 | P-E02–E07 | PH-3 |
| IR-06–IR-09 | F-06–F-08, F-13 | P-E08, P-D02, P-D04 | PH-4 |
| IR-10–IR-13 | F-09–F-12 | P-E09–E11, P-G01 | PH-5, PH-6a |
| IR-14–IR-17 | F-15–F-18 | P-E12–E14, P-F01–F07 | PH-8 |
| IR-18–IR-25 | F-20, F-25, F-07, F-26, F-19, F-22 | P-C27, P-C29, P-I01–I09 | PH-2–PH-7 |

## Appendix C. Sources

Reference and client materials: client ZIP (four screenshots, §3.1); reference portal pages inspected (§3.2).

Public web sources consulted (September 2026):

- Tap Academy public site — https://thetapacademy.com/ and https://thetapacademy.com/placements/
- Reference portal — https://tai.thetapacademy.com/ (login page public; student pages via the existing authenticated session)
- HCL GUVI product pages — https://www.guvi.in/code-kata/ , https://www.guvi.in/webkata/ , https://www.guvi.in/sqlkata/ , https://www.guvi.in/ide/ , https://www.guvi.in/faq/
- Judge0 — https://github.com/judge0/judge0 (GPL-3.0, isolate, 90+ languages) and https://judge0.com/ (cloud plans: Pro €27, Ultra €54, Mega €107 per month; €0.001 per extra submission)
- Piston — https://github.com/engineer-man/piston (MIT; isolate in Docker; public API non-commercial)
- Cloudflare Stream pricing — https://developers.cloudflare.com/stream/pricing/ (USD 5 per 1,000 minutes stored; USD 1 per 1,000 minutes delivered)
- Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing/ (USD 0.015/GB-month; Class A USD 4.50/M; Class B USD 0.36/M; free egress; 10 GB free)
- Bunny Stream pricing (via search results; confirm on vendor page) — https://bunny.net/stream/
- Resend pricing — https://resend.com/pricing (free 3,000/month, 100/day; Pro USD 20/month for 50,000)
- Razorpay pricing — https://razorpay.com/pricing/ (2% domestic; up to 3% international; no setup/AMC; 18% GST on fees)
- Neon pricing — https://neon.com/pricing (Free 0.5 GB/project, 100 CU-hours; Launch USD 0.106/CU-hour, USD 0.35/GB-month)
- Hetzner Cloud pricing (via search results: CX23 €5.49, CX33 €8.49, CX43 €15.99 as of June 2026; shared plans reported unavailable for new orders in September 2026) — https://www.hetzner.com/cloud/
- Next.js releases — https://nextjs.org/blog (16.x active LTS; 15.5.x maintenance LTS)
- NestJS releases — https://github.com/nestjs/nest/releases (v12, August 2026)
- Prisma ORM — https://www.prisma.io/blog/announcing-prisma-orm-7-0-0 and https://www.prisma.io/changelog
- Drizzle ORM releases — https://orm.drizzle.team/docs/latest-releases (1.0 release candidate)
- Anthropic model pricing — price table cached in the Claude API reference used during this session (June 2026): Opus 5 USD 5/25, Sonnet 5 USD 2/10, Haiku 4.5 USD 1/5 per million input/output tokens; verify at https://docs.anthropic.com/ before procurement

*End of report.*
