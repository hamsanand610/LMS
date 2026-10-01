# Task 2 — reference audit, feature inventory and gap analysis

27 September 2026. The brief (Task 2, "real-world LMS transformation") asks for the product to stop
feeling like a demonstration and to offer a learner experience comparable to a mature academy
portal. This document is the Phase A–C output the brief requires before building: what the
reference product actually contains, what this LMS already has, the gap between them, the
priorities, the metric definitions, and the final navigation for every role.

Decisions taken with the client on the same day: the institute is **SI Academy**; students keep
realistic personal names; a **basic placement drives board** is in scope; the client runs
`demo:reset` when the new seed is ready.

## 1. Method

- **Reference product (TAP Academy, authenticated learner area).** Inspected read-only in the
  built-in browser, which still held the client's own signed-in session from the planning stage; no
  credentials were typed. Pages were opened and read; nothing was started, submitted, posted,
  bookmarked or changed. No other learner's name, score or review is recorded here, and nothing
  from the reference (text, questions, images, branding) is reused — this document paraphrases what
  each area _does_.
- **Inspo** (product/UX research): education platforms (Coursera, Codecademy, Brilliant,
  Duolingo, Babbel), coding and developer products, sign-in pages, stat components, bento and
  stat-led layouts, the wine-red reference cluster. The archive is mostly public marketing pages,
  so it informed patterns and type decisions rather than dashboards to emulate (section 6).
- **This LMS**: the data model, module manifests, permissions and existing pages (Phases 1–6 and
  Task 1).

## 2. What the reference product contains

| Area                                 | What exists (paraphrased)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Login                             | Email and password (reviewed during planning; not re-opened now — signing out would end the client's session).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| B. Dashboard                         | Rotating placement-success banner; "My learning": course, assignment and test completion bars and "resume" cards for the current course lesson and assignment; a practice streak (current, longest, total correct submissions) with a year-long daily heatmap and a "how we count" link; placement drives (eligible, applied, % applied); skills acquired with a level and stars; an overall points leaderboard (podium for the top three, the list below, the learner's own rank pinned); attendance by subject with a monthly present/absent calendar. |
| C. Sidebar                           | Collapsible icon rail that expands on hover: notifications, search, "scan QR" attendance, then Dashboard, Courses, Tests, Assignments, Company questions, Jobs, Bookmarks, AI assistant, Profile; an employability score; light/dark switch; the signed-in user with sign-out.                                                                                                                                                                                                                                                                           |
| D. Header                            | None; utilities live at the top of the sidebar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| E. Profile                           | Tabs: overview, personal information (contact, addresses, placement-readiness answers such as relocation and academic gaps), education, projects, experiences, certificates (self-added), documents (verified by staff); course and assignment progress; up to four PDF resumes with a default; a resume generator; quick links to help and the leaderboard.                                                                                                                                                                                             |
| F. Courses                           | "Live class now / view schedule" strip; tabs All / In progress / Completed with counts; cards with modules, total duration and progress; recordings grouped as a course.                                                                                                                                                                                                                                                                                                                                                                                 |
| G–J. Course, modules, lessons, video | The course opens into a player: video, lesson title, instructor, subject tag; tabs Overview (description), Discussions (per-lesson comments), Reviews (ratings and comments), Course content (progress ring, modules, total duration, notes pages, lesson search, module accordion with "3/5 done", lessons with durations, PDF notes).                                                                                                                                                                                                                  |
| K. Assignments                       | Tabs with counts; cards with level, modules, questions and marks. Inside: description, modules completed, questions solved and attempted, marks obtained; modules as a track that unlocks in order ("unlocks after …"); per question: type, attempts, time spent, difficulty, marks, review.                                                                                                                                                                                                                                                             |
| L. Coding practice                   | Reached through company questions and assignments; an editor with submission history opens from "solve".                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| M. Tests                             | Tabs Upcoming / Contests / History; self-paced practice tests by subject; history cards (type: weekly, on-demand, company test; date; duration) with Result and Leaderboard; a result page with score, marks, time, sections with per-section time, per-question review with the right answer and explanation, a downloadable report, and a per-test leaderboard.                                                                                                                                                                                        |
| N. Quizzes                           | Objective questions inside assignments and tests; the AI assistant offers quick quizzes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| O. Company questions                 | Companies filtered by technology, with in-progress / completed / favourites; a company "kit" lists its questions with status, attempts, marks, a bookmark and "solve".                                                                                                                                                                                                                                                                                                                                                                                   |
| P. Daily streak                      | Practice streak on the dashboard (inferred from its labels to count days with correct practice submissions; its explanation did not open).                                                                                                                                                                                                                                                                                                                                                                                                               |
| Q. Daily adherence                   | Not present as such; attendance per subject is the nearest measure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R. Leaderboard                       | Overall by points on the dashboard; per test from the results page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S. Progress                          | No dedicated page; completion bars on the dashboard and the profile.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T–U. Live classes, calendar          | Month calendar of classes with a programme filter; a class shows subject, status, time, trainer and venue.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| V. Notifications                     | Grouped by period, each with a category, age and "show more"; schedule and new-test notices.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| W. Placement                         | Jobs (technical, non-technical, internal, applied) with role, location, package, qualification, passing year, expiry; placement-readiness profile answers; eligible/applied counts on the dashboard; an employability score.                                                                                                                                                                                                                                                                                                                             |
| X. Certificates                      | Entries the learner adds to the profile (title, issuer, year, description); none issued by the platform.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Y. Resources                         | PDF notes inside modules; a "notes" course; bookmarks for questions, videos and notes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Z. Other                             | AI study assistant; QR check-in for attendance; bookmarks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| AA. Support                          | A third-party live-chat widget ("leave a message"); lesson discussions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| AB. Settings                         | Theme switch in the sidebar; details edited on the profile; no separate settings page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 3. Feature inventory and actions

Priority: **P0** core learner experience · **P1** important operational feature · **P2** enhancement ·
**P3** optional or future. "Exists" refers to this LMS before Task 2.

| Reference feature                   | Exists here?                  | Current implementation                         | Action                                                                                            | P   |
| ----------------------------------- | ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- | --- |
| Email/password login                | Yes                           | Branded sign-in (Task 1)                       | Replace the empty welcome panel with an original learning composition                             | P0  |
| Dashboard hierarchy                 | Yes                           | Continue learning, today, due soon, progress   | Rebuild around "learning / doing / today / pending" with the new measures below                   | P0  |
| Resume cards + completion bars      | Partial                       | One continue card; progress meters             | Course/assignment/test completion and resume points                                               | P0  |
| Daily streak with heatmap           | No                            | —                                              | **New**: learning streak from real activity, year heatmap, "how we count"                         | P0  |
| Daily adherence                     | No                            | Attendance % only                              | **New**: defined daily target on class days, history                                              | P0  |
| Leaderboard                         | No (plan: off by default)     | —                                              | **New**: points from real work, week/month/all, batch scope, behind a module flag                 | P0  |
| Attendance by subject + calendar    | Partial                       | Attendance % and class list                    | Subject breakdown and month calendar on progress                                                  | P1  |
| Sidebar with all learner areas      | Yes                           | Seven flat items                               | Grouped learner IA (section 5)                                                                    | P0  |
| Courses with duration and counts    | Partial                       | Cards with progress, tabs with counts          | Duration, module and lesson counts, instructor                                                    | P0  |
| Course overview, instructor         | Partial                       | Outline, no instructor                         | Overview, instructor (the batch trainer for that subject), duration                               | P0  |
| Module → lesson with notes          | Yes                           | Modules, lessons, downloads                    | Keep; add **topics** inside modules                                                               | P1  |
| Per-lesson discussions              | No (plan: doubts are future)  | —                                              | **New**: doubts on a lesson or course, answered by trainers                                       | P1  |
| Course reviews                      | No (plan: feedback is future) | —                                              | Excluded (feedback module)                                                                        | P3  |
| Assignment track with unlocks       | Yes                           | Modules with unlock rules                      | Add attempted, marks and time-spent figures                                                       | P1  |
| File-upload answers                 | No                            | —                                              | Excluded: needs a new answer type, storage scanning and a grading view                            | P3  |
| Tests: upcoming / history / results | Yes                           | Open now, coming up, already sat; result page  | Keep; add a per-test leaderboard where results are released and ranks allowed                     | P2  |
| Self-paced practice tests, contests | No                            | —                                              | Excluded for now (tests are scheduled by staff)                                                   | P3  |
| Coding editor with history          | Yes                           | Practice workspace (Task 1)                    | Add practice streak and topic filter                                                              | P1  |
| Company questions (kits)            | No                            | —                                              | **New**: companies with curated practice kits, favourites, progress                               | P1  |
| Jobs / placement drives             | No (plan: future)             | Placement permissions seeded only              | **New**: basic drives board (client decision)                                                     | P1  |
| Employability score                 | No                            | —                                              | Excluded: no definition that could be explained; streak, adherence and progress are shown instead | P3  |
| Skills with levels                  | No                            | Skills are free text on the profile            | Excluded: levels would be invented                                                                | P3  |
| Profile projects, certificates      | No (plan: future modules)     | Personal, education, experience, skills, links | **New**: self-reported projects and certificates sections                                         | P1  |
| Profile photo                       | Partial                       | Accounts have an avatar slot, never used       | Upload and show a photo on the profile and in the account menu                                    | P1  |
| Resumes (four, default)             | Yes (three)                   | Resumes page                                   | Keep                                                                                              | —   |
| Resume generator                    | No                            | —                                              | Excluded (needs PDF generation, plan: future)                                                     | P3  |
| Month calendar of classes           | Partial                       | Week agenda                                    | Month view and class details                                                                      | P1  |
| Venue for in-person classes         | No                            | Join link and provider                         | Excluded for now (notes carry it)                                                                 | P3  |
| Notifications grouped by period     | Partial                       | Inbox, categories                              | Group by day; placement and doubt categories                                                      | P1  |
| Bookmarks                           | No                            | —                                              | Deferred                                                                                          | P2  |
| AI study assistant                  | No                            | —                                              | Excluded: needs an AI provider, a cost decision and approval (plan: AI is future)                 | P3  |
| QR check-in                         | No                            | Roll call                                      | Excluded: needs a scanning device (plan: QR is future)                                            | P3  |
| Live-chat support                   | No                            | —                                              | Replaced by doubts (in-product, answered by the learner's own trainers)                           | P1  |
| Separate settings                   | Partial                       | Account page, notification preferences, theme  | One settings page for the learner                                                                 | P1  |
| Global search for learners          | Partial                       | People, batches, programmes                    | Add courses, lessons, assignments, practice problems for learners, within what they can see       | P1  |

## 4. Implementation plan (what gets built)

Reuse first: every new feature sits on existing modules, tables and components.

| Feature                        | Built on                                                                                           | New storage                                            | Permission                                                 | Flag                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Streak, adherence              | Progress module; lesson progress, assignment submissions, practice runs, test attempts, attendance | None                                                   | `progress:read` (own / batch / all)                        | always on                                                      |
| Leaderboard                    | Same sources                                                                                       | None                                                   | `leaderboard:read` (own → own batch, batch, all)           | `module.gamification` (off in the template, on for SI Academy) |
| Company kits                   | Practice problems                                                                                  | `companies`, `company_kit_items`, `company_favourites` | `placements:read`, `placements:manage`                     | `module.placement`                                             |
| Placement drives               | Companies, batches, attendance, resumes                                                            | `placement_drives`, `drive_applications`               | `placements:read`, `placements:apply`, `placements:manage` | `module.placement`                                             |
| Doubts                         | Courses, lessons, batches, notifications                                                           | `doubts`, `doubt_replies`                              | `doubts:ask` (own), `doubts:answer` (batch / all)          | `module.doubts`                                                |
| Profile projects, certificates | Profile module                                                                                     | two JSON columns on the learner profile                | `profile:update`                                           | —                                                              |
| Lesson topics                  | Courses module                                                                                     | one column on lessons                                  | `courses:manage`                                           | —                                                              |
| Course instructor, duration    | Batch trainers, lessons                                                                            | None                                                   | existing                                                   | —                                                              |
| Learner search                 | Search module                                                                                      | None                                                   | `search:use` (own)                                         | —                                                              |

Progress is never restructured: topics are a label on a lesson, so no lesson id, completion or
enrolment changes when an author groups lessons.

## 5. Metric definitions

All days are calendar days in the institute's time zone (IST).

**Learning activity** — a day counts when the learner did at least one of: completed a lesson;
submitted an answer to an assignment question; submitted a practice solution; submitted a test.
Attending a class is recorded by the trainer, so it counts towards adherence, not the streak.

**Learning streak** — consecutive days with learning activity, ending today. Until the learner acts
today the streak still stands on yesterday, and the page says what keeps it alive. Also shown: the
longest streak, active days in the last year, and a year of daily counts.

**Daily adherence** — measured on _class days_: days on which the learner's batch had at least one
class whose roll call has been taken (cancelled classes and unmarked classes do not count). The
daily target is to **attend every marked class that day and do at least one learning activity**.
A class day is _met_ when both happen, _partly met_ when only one does, _missed_ when neither does.
Adherence = met class days ÷ measured class days over the last 30 days; with no measured days the
figure is "not measured yet", never zero.

**Leaderboard points** — earned only from recorded work in the chosen period (this week from
Monday, this month, or all time): 5 points per lesson completed; a practice problem's own points
(10 by default) the first time it is solved; the marks awarded for assignment answers (best attempt
per question); the score of a test whose results are released. The board covers the learner's own
batch. Names show as first name and last initial; nobody's email, code or scores outside the board
are exposed. The module is off by default (plan §16 privacy baseline) and switched on for SI Academy.

## 6. Research that shaped decisions

- **Heatmap with an explanation** (GitHub's contribution graph, the reference's practice streak):
  a year of days, a Less→More key and a "how we count" link beside it — a number with its rule.
- **One typeface family, tight display tracking** (Coursera's Source Sans system, Codecademy's
  Apercu): kept IBM Plex Sans and JetBrains Mono (no new font dependency; Plex reads well for long
  sessions and has Indic companions), with −0.02em on display sizes and 600 as the heading weight.
- **Streaks without noise** (Duolingo, Brilliant): the streak is prominent but calm — no confetti,
  no loss-aversion copy; the next action is stated plainly.
- **Wine on charcoal** (Porsche, Lamborghini within 0.02 OKLab of the brand): confirms the Task 1
  palette; nothing changes there.
- **Navigation archetypes** (marginal index, search-first): the sidebar stays the index; search
  stays one keystroke away.

## 7. Navigation architecture

**Student** (learning first; mobile tab bar: Home, Courses, Practice, Tests, More)

| Group    | Items                                                  |
| -------- | ------------------------------------------------------ |
| —        | Dashboard                                              |
| Learn    | Courses · Schedule · Doubts                            |
| Practise | Assignments · Tests · Coding practice · Interview prep |
| Grow     | Progress · Leaderboard · Placements                    |
| You      | Profile                                                |

Account menu: Settings (account, security, notifications, appearance), sign out.

**Trainer** (teaching first)

| Group    | Items                                    |
| -------- | ---------------------------------------- |
| —        | Dashboard                                |
| Teach    | Schedule · Attendance · Courses · Doubts |
| Assess   | Assignments · Tests · Question bank      |
| Learners | My batches · Leaderboard                 |
| Insight  | Reports · Exports                        |

**Admin** (institution operations)

| Group      | Items                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| —          | Dashboard                                                                                                               |
| People     | Users · Students · Trainers                                                                                             |
| Learning   | Programmes · Batches · Courses · Schedule · Attendance                                                                  |
| Assessment | Question bank · Assignments · Tests                                                                                     |
| Placements | Drives · Companies (each company page holds its interview-prep kit)                                                     |
| Engagement | Doubts · Announcements · Leaderboard                                                                                    |
| Insight    | Reports · Exports                                                                                                       |
| Settings   | General · Branding · Feature flags · Roles · Navigation · Fields · Templates · Integrations · Audit log · System health |

## 8. Every learner feature has a staff path

| Learner sees                         | Managed by                                      | Where                              |
| ------------------------------------ | ----------------------------------------------- | ---------------------------------- |
| Courses, lessons, topics             | Admin, content manager; trainer reads           | Courses builder                    |
| Assignments, tests                   | Admin, trainer (own batches)                    | Assignments, Tests                 |
| Coding practice, interview-prep kits | Admin, placement coordinator (kits)             | Question bank, Companies           |
| Schedule                             | Admin; trainer runs classes                     | Schedule, trainer schedule         |
| Attendance                           | Trainer marks, admin corrects                   | Roll call                          |
| Doubts                               | Trainer (own batches), admin (all)              | Doubts                             |
| Placement drives                     | Admin, placement coordinator                    | Drives, Companies                  |
| Streak, adherence, leaderboard       | Read by trainers (own batches) and admins       | Student view, Leaderboard, reports |
| Notifications                        | Generated by the events above; admins broadcast | Announcements                      |

## 9. What was built (implementation status)

Status at the end of Task 2. "Done" means built, covered by tests and seen in the browser on a
freshly seeded database, desktop and phone.

| Inventory item                        | Status         | Notes                                                                                                                                                                                                                                               |
| ------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in visual                        | Done           | Original composition of the product's own surfaces (a solution passing its tests, a course, a live class); no photograph, no reference asset. Scales down on short laptop screens and is replaced by the client's background image when one is set. |
| Dashboard hierarchy                   | Done           | Continue learning and today first; streak, adherence and the batch leaderboard next; due soon beside progress (courses, attendance, assignments, test average); the placement band; other courses, announcements, batches.                          |
| Streak, heatmap, adherence            | Done           | `GET /me/consistency`, `GET /students/:id/consistency`; dashboard cards; progress page section with a 26-week calendar, recent class days and the rules.                                                                                            |
| Leaderboard                           | Done           | `GET /leaderboard`; student, trainer and admin pages; batch-scoped; short names only; `module.gamification` (off in the template, on for SI Academy).                                                                                               |
| Attendance by subject and class       | Done           | Progress page, in a collapsible "Attendance by subject and class by class" panel (the summary card stays above it).                                                                                                                                 |
| Grouped learner navigation            | Done           | Learn · Practise · Grow · You; trainer Teach · Assess · Learners · Insight; admin Placements and Engagement groups. A new `minScope` on navigation items keeps staff entries off learners' menus.                                                   |
| Course duration, counts, instructor   | Done           | Card and outline show modules, lessons, time and "Taught by" (the batch trainer for the subject). Lesson counts follow the percentage's own rule (required lessons when some are optional), so the two can never disagree.                          |
| Topics inside modules                 | Done           | `lessons.topic`; set in the course builder with the lesson's length; grouped on the learner outline.                                                                                                                                                |
| Doubts                                | Done           | Learner `/me/doubts…`, staff `/doubts…`; lesson and course links; notifications both ways; trainer dashboard counts the waiting ones; `module.doubts`.                                                                                              |
| Company kits                          | Done           | Companies with ordered, topic-labelled kits of published practice problems; favourites; per-learner solved/attempted status; `module.placement`.                                                                                                    |
| Placement drives                      | Done           | Draft → open → closed; eligibility by batch, programme and attendance; apply with the default resume; withdraw; staff stages with a note that reaches the learner; admin dashboard tiles become real figures while the module is on.                |
| Profile projects, certificates, photo | Done           | Two new sections and photo upload; the photo also shows in the account menu.                                                                                                                                                                        |
| Month calendar                        | Done           | Week and Month views on both schedule pages; dots per class on phones.                                                                                                                                                                              |
| Notifications by period               | Done           | Today · Yesterday · Earlier this week · Older; placement and doubt categories with their own preferences.                                                                                                                                           |
| One settings page                     | Done           | `/settings`: account and sign-in, notifications, profile (learners), appearance, privacy and terms.                                                                                                                                                 |
| Learner search                        | Done           | Courses, lessons, assignments and practice problems the learner can reach; never a staff-only record.                                                                                                                                               |
| Practice topic filter                 | Done           | Topic filter from the catalogue's own topics.                                                                                                                                                                                                       |
| Assignment time-spent figures         | Not built      | Marks and attempts already show; a time-spent figure needs a definition first (active time or wall time) — left for approval.                                                                                                                       |
| Per-test leaderboard                  | Not built (P2) |                                                                                                                                                                                                                                                     |
| Bookmarks                             | Deferred (P2)  |                                                                                                                                                                                                                                                     |
| Excluded (P3)                         | Excluded       | Course reviews, file-upload answers, self-paced tests and contests, employability score, skill levels, resume generator, venue, AI assistant, QR check-in — reasons in section 3.                                                                   |
