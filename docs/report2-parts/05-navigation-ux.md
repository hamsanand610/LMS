## 15. Navigation and User Journeys

### 15.1 Navigation maps

**Student portal** (bottom tab bar on phones: Home · Courses · Practice · Tests · More)

| Menu item | Route | Leads to | Opens modal / page |
|---|---|---|---|
| Dashboard | `/dashboard` | Session join (external link), lesson player, assignment, test instructions, announcement detail (drawer) | Announcement: drawer |
| Schedule | `/schedule` | Join link; recording lesson | Session detail: bottom sheet |
| Courses | `/courses` → `/courses/{id}` → `/courses/{id}/lessons/{lid}` → `/…/practice` | Player, inline practice | Resource download: direct |
| Assignments | `/assignments` → `/assignments/{id}` → `/assignments/{id}/q/{qid}` | Workspace | Report issue: modal |
| Tests | `/tests` → `/tests/{id}` → `/tests/{id}/attempt` → `/tests/{id}/result` | Attempt (full-screen), result | Submit confirmation: modal |
| Practice | `/practice` → `/practice/{slug}` | Workspace | — |
| Progress | `/progress` | Course/assignment/test pages | — |
| Profile (menu) | `/profile` → `/profile/edit/{section}`, `/profile/resumes`, `/profile/documents` | — | Photo crop: modal |
| Notifications (bell) | dropdown → `/notifications` | Target page | — |
| Search (⌘K) | palette → item | — | Palette: modal |
| Settings (menu) | `/settings/notifications` | — | — |
| Sign out (menu) | `/logout` | `/login` | — |

**Trainer portal** (sidebar; drawer on phones)

| Menu item | Route | Leads to | Modals |
|---|---|---|---|
| Dashboard | `/trainer` | Attendance marking, grading, schedule | — |
| Schedule | `/trainer/schedule` | Session sheet → attendance marking; attach recording | Attach recording: modal; request change: modal |
| Batches | `/trainer/batches` → `/trainer/batches/{id}` → `/trainer/students/{id}` | Student view | Note: drawer |
| Assignments | `/trainer/assignments` → `/{id}` (tabs) | Grading queue | New assignment: wizard (page) |
| Tests | `/trainer/tests` → `/{id}` (tabs) → `/{id}/grading` | Monitor, results | Schedule: modal; release: confirm |
| Attendance | `/trainer/schedule` (today) → `/trainer/sessions/{id}/attendance` | — | Correction reason: inline |
| Reports | `/trainer/reports` → report page | Export | — |
| Question bank | `/trainer/question-bank` → editor | — | — |
| Profile | `/trainer/profile` | — | — |

**Admin portal** (sidebar; grouped: People · Learning · Assessment · Operations · Settings)

| Group | Items → routes |
|---|---|
| Home | Dashboard `/admin` |
| People | Users `/admin/users`; Students `/admin/students` (→ `/import`, `/{id}`); Trainers `/admin/trainers` (→ `/{id}`) |
| Learning | Programmes `/admin/programs`; Batches `/admin/batches` (→ `/{id}` tabs); Courses `/admin/courses` (→ `/{id}/edit`, `/{id}/publish`) |
| Assessment | Question bank `/admin/question-bank` (→ `/new`, `/{id}`, `/import`); Assignments `/admin/assignments` (→ `/{id}`); Tests `/admin/tests` (→ `/{id}`, `/{id}/grading`) |
| Operations | Attendance `/admin/attendance`; Reports `/admin/reports` (→ `/{name}`); Exports `/admin/exports`; Announcements `/admin/announcements` |
| Settings (Super Admin sections marked) | General; Branding*; Feature flags*; Navigation*; Fields & taxonomies*; Templates & content*; Integrations*; Roles*; Audit log*; System health* |

Modals in admin: invite user, new batch, add members, assign trainer, series editor (page section), publish dialogs, schedule test, release confirm, verify/reject document (reason), retry job.

### 15.2 Navigation behaviours

| Behaviour | Rule |
|---|---|
| Breadcrumbs | Staff portals show breadcrumbs from the portal home (e.g. Batches › JFS-2026-B1 › Timetable); student portal uses back links and page titles instead |
| Sidebar | Collapsible to icons with tooltips; state remembered per user (local storage); active item highlighted; groups collapsible |
| Mobile | Students: bottom tabs (5) + "More" sheet; staff: hamburger drawer; full-screen modes for player, workspace, attempt |
| Permission-based visibility | Navigation built from module manifests filtered by the user's effective permissions and flags; hidden items are also blocked by the API |
| Disabled modules | Not rendered; direct navigation shows a "This feature is not enabled" page (distinct from 403) |
| Deep links | Unauthenticated deep link → login → return to the link; wrong-role deep link → 403 with link to own portal |
| Unauthorized routes | Route guards (server-side layout check) plus API 403 handling; audit entry for repeated 403s (rate-limited) |
| Return paths | Create flows return to the created object; wizard cancel returns to the list; drawers keep list state (filters in URL) |
| Keyboard | ⌘/Ctrl+K search; `?` shows shortcuts; all menus focusable |

### 15.3 User journeys

Each journey is written to be logically complete from entry to a verifiable end state, including the API calls and events involved.

**J-01 Admin creates a student.** Admin signs in → Students → "New student" → form (name, email, mobile, programme/batch optional, custom fields) → save → `POST /students` creates user (invited) + student profile → invitation email queued (`user.invited` → notifications job) → email visible in Mailpit → student opens `/invite/{token}` → sets password, accepts consent → `POST /auth/invitations/{token}/accept` → session created → redirected to `/dashboard` (empty state guidance) → admin sees status "active" and audit entries. *Alternative*: bulk import (DP-A07) with validation report and invitations. *Failure branches*: duplicate email → 409 shown inline; email provider down → invitation "pending" with retry.

**J-02 Admin creates a batch.** Batches → "New batch" → choose programme, name/code, dates, mode, capacity → `POST /batches` → batch detail → Students tab → add from list or import → `POST /batches/{id}/members` (state: enrolled) → Trainers tab → assign trainer with subject → `PUT /batches/{id}/trainers` → Timetable tab → create series (Mon–Fri 10:00–11:30, 4 weeks, holidays) → `POST /batches/{id}/timetable` → occurrences generated (conflict check) → Content tab → publish programme courses to batch → `POST /courses/{id}/publish` (scope batch) → status "running" → students receive "batch started" notification and see courses and schedule. *End state*: dashboard batch-wise tile counts the batch; trainer dashboard shows sessions.

**J-03 Admin creates a course.** Courses → "New course" → settings (title, level, subject, thumbnail) → builder → add module → add video lesson (upload MP4 → presigned upload → `POST /files/uploads/{id}/complete` → video driver marks ready) → add article lesson (rich text) → add resources (PDF) → add practice lesson (pick coding question) → set completion rules → preview as student → publish (scope: programme) → `course.published` event → enrolments derived for students in scope → course appears in students' catalogue with "Ready to start".

**J-04 Trainer manages a batch.** Trainer signs in → dashboard shows today's session and batch health → Batches → batch detail → Students tab sorted by attendance → open a low-attendance student → add staff note → notify student (in-app + email) → Assignments tab: publish an existing assignment to the batch with a due date → Tests tab: schedule the weekly test for Friday → Content tab: confirm published courses → back to dashboard: pending grading count updated after students submit.

**J-05 Trainer marks attendance.** Session ends → dashboard "Mark attendance" → roll-call page (all present) → toggle 3 absent, 1 late with note → submit → `PUT /sessions/{id}/attendance` → `attendance.marked` event → progress/report aggregates update → students below threshold flagged on next weekly job → next day trainer corrects one record (reason required, within 48 h) → audit entry with before/after → admin attendance report shows corrected values.

**J-06 Trainer creates an assignment.** Assignments → "New" → wizard step 1 pick questions from bank (filter Java, Beginner) → step 2 group into modules with unlock rule (previous ≥ 60%) → step 3 settings (3 attempts, explanation after solve, marks) → step 4 publish to own batch with due date → `POST /assignments` + `POST /assignments/{id}/publish` → students notified → Progress tab shows 0/40 → after submissions, descriptive answers appear in Grading queue → trainer grades → marks visible to students.

**J-07 Student joins a course.** Student receives "new course available" notification → Courses list shows the course → opens course overview → curriculum shows module 1 unlocked → clicks "Start" → player opens lesson 1 → enrolment record exists (derived on first access or at publication) → progress 0% → course appears in "Continue learning" on dashboard after first lesson activity.

**J-08 Student watches a lesson.** Player → video plays from signed URL → position saved every 10 s (`POST /lessons/{id}/progress`) → at 90% watched, lesson auto-completes (`lesson.completed`) → "Up next" prompts the article lesson → student downloads a resource (presigned URL, audited for sensitive docs only) → module progress updates in sidebar → course progress on dashboard equals player value → closing and reopening resumes at the saved position.

**J-09 Student submits an assignment.** Assignments → assignment → module 1 → MCQ question → answer → `POST /questions/{id}/submissions` → graded instantly → explanation shown (policy) → next: coding question → run with sample input in browser driver → submit → results per test with "verified in browser" badge (or "verified by server" with Judge0) → marks recorded → module 1 reaches 60% → module 2 unlocks → descriptive question → submitted, status "awaiting grading" → trainer grades (J-06) → notification "graded" → assignment progress and marks update everywhere.

**J-10 Student takes a test.** Tests → Upcoming card becomes "Start" within window → instructions page (rules, sections, connectivity check) → Start → `POST /tests/{id}/attempts` → attempt page with server deadline → answers autosaved (`PATCH /attempts/{id}/answers`) → connection dropped for 1 minute → reload restores answers and timer → coding question run/submit via adapter → submit dialog → `POST /attempts/{id}/submit` → objective questions auto-graded, descriptive queued → "Submitted" confirmation; results hidden until release. *Failure branches*: deadline reached → auto-submit job; second tab → 409 "attempt already active".

**J-11 Student views results.** Trainer releases results (`POST /tests/{id}/release`) → `test.released` event → students notified → Tests › History card shows score → result page: total, section scores, rank (if enabled), per-question review per policy → student opens review of a wrong answer with explanation → progress page shows the test in history → admin assessment-scores tile includes the test.

**J-12 Admin views reports.** Admin dashboard with default filters → tile "Attendance" → attendance report (batch filter) → sorts by % → exports XLSX (`POST /exports`) → job runs (embedded worker) → notification with download link → file matches filtered rows → back to dashboard → change date range → tiles recompute (aggregates + live queries) → "data as of" stamp updated.

---

## 16. UI/UX and Design-System Plan

### 16.1 Design principles

Unchanged from master §11.1: today first; one shell, four portals; phone-first for students, desktop-first for staff; explain every number; low-bandwidth respect; accessible by default; calm and professional; consistent state feedback. Added for the template: **brand-neutral core** — no colour, font or copy is hard-coded; every visible brand element comes from tokens or settings.

### 16.2 Layout and grid

- App shell: sidebar 240 px (72 px collapsed) at ≥ 1024 px; top bar 56 px; content padding 24 px desktop / 16 px mobile; max content width 1280 px (tables), 960 px (reading), full width (editors, attempts).
- Grid: 12 columns, 24 px gutters desktop, 16 px mobile; dashboard tiles 3–4 per row desktop, 2 per row mobile.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px (`--space-1…8`).
- Density: comfortable default; compact toggle for staff tables (row height 36 px vs 44 px).

### 16.3 Typography

Roles: display (page titles), heading, body, label, code. Default faces: UI **IBM Plex Sans** (self-hosted), code **JetBrains Mono**; clients may choose from an allowed list (system stack, Inter, Manrope, Plex, Source Sans, Noto Sans for Indic scripts) or upload licensed fonts. Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 px; line height 1.5 body, 1.25 headings; tabular numerals in tables and timers.

### 16.4 Colour system and theme tokens

Token contract (CSS variables, defined for light and dark; branding sets the seed values and the system derives the rest with contrast checks):

| Token | Purpose | Derived from |
|---|---|---|
| `--brand-primary`, `--brand-primary-foreground` | Primary actions, active navigation, links, progress | Branding primary colour |
| `--brand-accent` | Highlights, badges | Branding accent (optional; defaults to primary) |
| `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted` | Neutrals tinted toward the primary | Generated from primary hue with fixed lightness steps |
| `--success`, `--warning`, `--danger`, `--info` (+ `-soft`, `-foreground`) | Semantic status only (never brand) | Fixed palette, contrast-checked against surfaces |
| `--radius-sm/md/lg`, `--density` | Shape and density | Branding radius/density choice |
| `--font-ui`, `--font-code` | Fonts | Branding font choice |
| `--chart-1…6` | Chart series | Generated from primary/accent with distinct hues |

Rules: minimum contrast 4.5:1 for text and 3:1 for UI components is validated when branding is saved (the form blocks failing combinations and suggests corrected values); dark theme is generated from the same seeds with adjusted lightness, never inverted; semantic colours are never overridden by brand colours.

### 16.5 Component standards

| Component | Standard |
|---|---|
| Buttons | Variants primary / secondary / ghost / destructive / link; sizes sm/md/lg; loading state; icon+label; one primary per view |
| Inputs | Label above; helper and error text; required marker; masks for phone/date; tag input for skills; select with search; file input with type/size hints and progress |
| Tables | Server pagination (25/50/100), sortable headers, column filters, column chooser, sticky header, row selection with bulk bar, empty and error states, export; cards on mobile |
| Cards | Consistent padding (16/24), one radius token, shadow only for elevated interactive cards; stat tiles with label, value, delta and explain popover |
| Modals / sheets | Modal for short confirmations and small forms; side sheet for details on desktop; bottom sheet on mobile; destructive actions need typed confirmation for irreversible operations; focus trap; Esc closes |
| Tabs | Underline tabs with counts; URL-synced; scrollable on mobile |
| Badges / chips | Status chips with semantic colour + icon + text; verdict chips (Accepted, Wrong answer, TLE, …); trust badge for practice results |
| Alerts | Inline alerts (info/success/warning/danger) with optional action; page-level banners (offline, staging environment) |
| Toasts | Bottom-right (desktop) / top (mobile), 5 s, max 3 stacked, dismissible, action link |
| Dropdowns / menus | Radix menus; keyboard navigable; icons + labels; destructive items separated |
| Sidebars / navigation | Grouped items, active state, collapse, tooltips when collapsed, permission-filtered, badge counts (pending grading, unread) |
| Charts | Recharts with token colours; axis labels; tooltips; table alternative toggle; empty state |
| Progress indicators | Linear bars (course, assignment), rings (overall, course completion), stepper (wizards), timers (large, accessible) |
| Empty states | Icon-free text + action; illustration optional per client (asset) |
| Loading skeletons | Layout-matching skeletons; never spinner-only for lists |
| Error states | Inline retry; form summary; full-page with reference ID |
| Mobile layouts | Bottom tabs; sheets; full-screen modes; 44 px targets; sticky primary actions |
| Accessibility | WCAG 2.2 AA; focus visible; skip links; labels; live regions (autosave, timer at 5 and 1 minutes); reduced motion; colour never the only signal; axe in CI |

### 16.6 Page templates (composites)

`ListPage` (header + filters + table/cards + bulk bar), `DetailPage` (header + tabs), `WizardPage` (steps + summary), `DashboardPage` (attention band + tiles + charts + lists), `PlayerPage` (media + sidebar/drawer), `WorkspacePage` (split panes / tabs), `AttemptPage` (full-screen with palette), `SettingsPage` (sections with save bar), `AuthPage` (branded single column).

### 16.7 White-label theming mechanism

1. Branding settings (DP-A29) store seeds: brand name, logos (light/dark), favicon, primary/accent, fonts, radius, density, login variant, background, welcome text.
2. The API exposes `GET /branding/public` (cached, ETag) with computed tokens for light and dark.
3. The web app injects tokens as CSS variables in the root layout on the server (no flash), loads the chosen font (self-hosted files from storage or system stack), and sets `<title>`, favicon and manifest from branding.
4. Components use tokens only; a lint rule forbids hard-coded colours in `apps/web` and `packages/ui`.
5. Email templates use the same seeds through a small inline-CSS token set.
6. Changing branding therefore re-themes every page, email and the login screen without code changes or redeploys; a preview endpoint renders the login and dashboard with unsaved seeds.

---
