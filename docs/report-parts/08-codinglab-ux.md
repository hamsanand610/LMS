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
