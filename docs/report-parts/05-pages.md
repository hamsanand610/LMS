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
