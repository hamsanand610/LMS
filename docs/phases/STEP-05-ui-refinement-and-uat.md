# Step 5 — Final UI refinement and UAT

The client's locked execution plan, Step 5 ("final UI refinement and full UAT across all roles"),
started on 10 October 2026 after Step 4 (real placement data) was released in `bc483a3`. It is the
UX and wording part of Roadmap Phase 12 (responsive behaviour, accessibility, loading, empty and
error states, visual consistency; stale demo language, placeholders, dead UI and inconsistent
terminology, with the register in `docs/product/IMPLEMENTATION_ROADMAP.md` §5), done ahead of
Phase 11 on the client's plan. Phase 12's performance part and Phase 11 are not started.

Out of scope: new features, redesign, production data, AWS changes, `ai.lab_hints`, the legal
texts (they stay drafts until `docs/legal/LEGAL_REVIEW.md` is closed). Signed-in UAT in production
is the institute's; this step prepares its script and does everything that can be verified locally.

## How the pages were checked

A scratch Playwright script (not committed) signed in on the local QA copy (`lms_qa`, the sample
data) as each role, collected every route of the role's menu plus the first detail page each list
links to, and visited each at **desktop (1366 × 768)**, **phone (390 × 844, touch)** and **desktop in
dark mode**. On every visit it recorded axe-core's WCAG 2.1 A/AA violations, console errors, failed
requests (4xx/5xx) and the page's sideways overflow. A read-only review of `apps/web/src` covered
what a crawler cannot judge: wording, terminology, missing loading/empty/error states and dead
links.

| Role                  | Pages | Visits | Console errors | Failed requests        | Overflow              |
| --------------------- | ----- | ------ | -------------- | ---------------------- | --------------------- |
| Learner               | 47    | 141    | 0              | 0                      | 0                     |
| Administrator         | 56    | 168    | 1 page         | 1 (`branding/preview`) | 1 page (batch, 35 px) |
| Placement Coordinator | 14    | 42     | 0              | 0                      | 0                     |
| Trainer               | 47    | 141    | 0              | 0                      | 0                     |

## What was found and fixed

**Accessibility (axe, WCAG 2.1 AA)**

| Finding                                                                                          | Where                                                                                                 | Fix                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Filter tabs pointed at tab panels that do not exist (`aria-controls`), critical                  | Nine pages: courses, schedule, doubts, labs, interview prep, leaderboard, placements, drives, reviews | `<Tabs filter>`: tabs that filter a list name no panel (`components/ui/tabs.tsx`)                       |
| Every progress bar announced itself as "indeterminate"; three had no name                        | `components/ui/progress.tsx`; students, student, trainer's student                                    | The value reaches the accessible element; each bar is named ("Profile 80% complete")                    |
| Dropdowns and file inputs not tied to their labels                                               | Branding, student import, seven dialogs                                                               | `htmlFor`/`id` (or `useId`)                                                                             |
| Hand-in file input without a label (a hidden duplicate of the button)                            | Assignment question                                                                                   | Hidden from the keyboard and assistive technology, as the other upload buttons are                      |
| Scrolling boxes the keyboard could not reach                                                     | Every table that scrolls; the activity calendar; AI usage tables                                      | A table box becomes a tab stop only while it actually scrolls (`useScrolls`); the calendar is focusable |
| Low contrast: the phone bar's labels over coloured content (3.55:1); a count in a red pill (4:1) | Phone tab bar; trainer dashboard                                                                      | Darker label colour (5.4:1 at worst); no opacity on the count                                           |
| Notification switches named by an internal key ("…for assignment")                               | Notification preferences                                                                              | Named by the category's visible label                                                                   |

**Defects**

| Finding                                                                                                                                                                                                                                                                                                                  | Fix                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A trainer reading a course they do not teach got the learner's outline: every link led to "Access denied"                                                                                                                                                                                                                | The outline's staff mode: the curriculum without learner progress or actions; "All courses" returns to the trainer's list                             |
| Branding showed an empty interface font, its preview was refused (400), and **Save did nothing** (no request, no message: the empty font failed the form's own check). Inside a form, Radix's Select reports an empty value when the form is reset or its hidden native select lags                                      | The shared `Select` never passes an empty value on (no item can have one), which fixes every form; the first preview also waits for the form's values |
| The batch page's header was 35 px wider than a phone                                                                                                                                                                                                                                                                     | Its actions wrap                                                                                                                                      |
| A response without a problem body reached people as "Request failed with status 502"                                                                                                                                                                                                                                     | Plain words per status ("The service could not be reached just now. Try again in a moment.")                                                          |
| The trainer's question bank showed **Import** (to a custom role holding `questions:import`) leading to a page the trainer portal does not have                                                                                                                                                                           | The link shows in the admin portal only                                                                                                               |
| 16 places with a missing or misleading loading/error/empty state (an endless skeleton, "No more live classes today" on an error, "every doubt is answered" before the count loaded, "Start the test" enabled without the test's details, "No questions yet" under active filters, option lists with no loading or error) | Each now loads, fails with a reason and **Try again**, or says it is empty, in the existing components (`ErrorState`, `EmptyState`, `LoadingRows`)    |

**Wording**

- Internal requirement codes left the screens: the admin dashboard's definitions ("(CR-A08)",
  "(F-15)", "(Q-16)", "(D10)") and the report catalogue. A test now fails if one comes back.
- "Not in this build" / "Not measured by this installation" became "Not available yet" / "Not
  measured", and the project-status reason says what is true ("learners keep their own projects on
  their profiles, but project progress is not followed") instead of pointing at a roadmap phase.
- "Test sent. Look in Mailpit." (a developer tool) became "Test sent to ‹address›."
- "Modules for this portal arrive in later phases", "their API is blocked", "Jobs run inline
  here" and the integrations page's "(ADR-0005)" became plain sentences.
- Terminology: staff tables name the person column **Student** (as the Students menu does; prose
  keeps "learner"); **batch**, not "cohort"; **email** and **resumes** throughout; "Trainers", not
  "Instructors".

**Kept on purpose**

- "Technology" on questions and assignments and "Subject" on courses and classes: the same
  vocabulary, named by Task 4's decision for the assignment and question filters.
- "SI Academy AI" written into the AI's messages: SI Academy is the product (not a white-label
  template any more).
- The sign-in page's illustration (a sample course card) is decorative and hidden from assistive
  technology.
- System health, Integrations and AI settings keep technical terms (driver, environment): they
  are the Super Admin's diagnostics.
- CodeMirror's scroller (third party) is excluded from the accessibility check: its editable
  content takes the focus itself.

## The old-framing register (§5)

Updated: `docs/runbooks/staging.md` (title, "sample data", the walkthrough points to the UAT
script), `page-checklist.md` (item 17 now names the UAT script; the not-measured figures as they
are), `local-setup.md` and `testing.md` ("sample data"), `DESIGN_SYSTEM.md` (the font fallback),
the settings, trainers and worker READMEs, `clients/demo` and `clients/_template` READMEs, and
`packages/shared/src/roles.ts`. **Deferred:** renaming the tooling (`db:seed:demo`, `demo:reset`,
`demo:advance`, `clients/demo`, `CLIENT_KEY=demo`). It is invisible to users and touches scripts,
CI and the deployment's configuration; it belongs with Phase 12's remaining (performance and
tooling) work, so a release is not put at risk for a rename.

## Regression guard

`apps/web/e2e/accessibility.spec.ts` runs axe-core (WCAG 2.1 A/AA) on 23 main pages of the
learner, the trainer and the administrator, at desktop size (`chromium`) and phone size (`mobile`).
`axe-core` 4.13.0 becomes a direct development dependency of `apps/web`: it was already installed
through `eslint-plugin-jsx-a11y` (no new code), it is MPL-2.0, and Deque maintains it actively
(operating rule 5).

## UAT

The signed-in production script, for the institute: `docs/runbooks/production-uat.md` (everyone,
Super Admin, Trainer, Placement Coordinator, learner; phone and tablet; keyboard and zoom; how to
record and report).

## Verification (local QA copy, 10 October 2026)

**The audit again, after the fixes**, on fresh builds: the learner 141 visits (and 47 more at phone
size in dark mode), the administrator 168, the Placement Coordinator 42, the trainer 141. No
console error, no failed request, no sideways overflow on any page. axe reports only CodeMirror's
scroller on the lab pages (excluded above). Branding's 400 remained on the first re-run; it led to
the Select defect, fixed and checked after a rebuild: the preview answers 200, the font shows
"Instrument Sans", Save stays disabled while nothing has changed, and two saves (Density changed,
then restored) answered 200 with the font kept. Before the fix the same check showed an empty font
and a Save that sent nothing.

**The trainer's courses**: all five courses the demo trainer reads without teaching open the
curriculum with no link into the student portal, no learner progress panel, and "All courses"
going to `/trainer/courses`.

**Tests**:

- `e2e/accessibility.spec.ts`: 26/26 at desktop (`chromium`) and 26/26 at phone size (`mobile`),
  sign-ins included. A planted unlabelled input is reported by the same set-up, so a pass means
  something.
- New browser tests: Branding's first preview answers 200 and keeps the font
  (`self-service.spec.ts`); a trainer reads a course they do not teach without links into the
  student portal (`staff-journeys.spec.ts`). The dashboard assertions of `admin-people.spec.ts` and
  `operations.spec.ts` follow the new wording ("Not measured").
- Browser specs run locally: self-service, admin-people and accessibility (48 passed; the one
  failure was the old dashboard wording, now updated), then the changed tests (all passed).
- Web: type check, lint, 93/93 unit tests (`errors.spec.ts` covers the plain-words fallback). API:
  type check and lint; e2e `admin` 7/7 (no requirement code in any figure), `reports` and
  `feedback` 25/25 after their patterns followed the new wording, `settings` and
  `admin-operations` passed.

CI and the release are recorded in the progress log.
