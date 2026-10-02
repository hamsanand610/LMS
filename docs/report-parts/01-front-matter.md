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
