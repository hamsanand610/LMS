# Design system

The one place that says how this product looks and behaves on screen. It implements plan §16 (design
principles, layout, typography, tokens, component standards) with the decisions recorded in
ADR-0013 and refined by ADR-0015 (Task 3); the research behind it is in [RESEARCH.md](./RESEARCH.md)
and the Task 3 direction in [TASK3_VISUAL_DIRECTION.md](./TASK3_VISUAL_DIRECTION.md).

**The rule that governs everything else:** components use tokens, never colours. Every colour on
screen comes from the client's branding seeds through `deriveTokens` (`packages/shared/src/theme`),
is served by `GET /branding/public`, and is injected as CSS variables before the page paints. A
hard-coded hex in `apps/web` or `packages/ui` is a bug — with two deliberate exceptions: the sign-in
picture and the course plates, which are night scenes in both themes (section 7).

---

## 1. Principles

1. **What matters now comes first.** Every dashboard opens with the one block that answers its
   role's first question: a learner's greeting and next lesson, a trainer's roll calls, an
   administrator's exceptions. Supporting figures follow, in groups, at a lower weight.
2. **Red and ink are the brand; other hues carry meaning.** The brand colour marks the one primary
   action per view, the current place, learning progress and links. Emerald is the streak and what
   is done, champagne gold is achievement and what is still to come, amber is "soon", blue is
   information, signal red is an error. A colour never decorates.
3. **Paper and ink.** Content sits on ivory paper with cream cards; the navigation frame and the one
   hero per page are ink planes in both themes.
4. **One signature, used with restraint.** The Progress Arc (a thin arc with a bright head) is how
   progress is drawn; the Burgundy Glow (one soft light from an upper corner) marks the few surfaces
   that lead a page. Never both twice in one region.
5. **Colour is never the only signal.** Status chips carry a dot or icon and a word; the flagged
   question has a flag; the current question has a ring as well as a colour.
6. **Glass only on floating chrome** — the sticky header, the exam console, the command palette,
   sticky action bars — never on content cards.
7. **Every number explains itself.** Figures carry a definition (a tooltip, a line under the value, or
   a "What these mean" sheet), and anything this build cannot measure says so instead of showing zero.

## 2. Colour tokens

Derived per client; the values below are SI Academy's (primary `#7F2331`, a warm brand, so the warm
neutral ramp). Names are the CSS variables; Tailwind exposes them as `bg-surface-2`, `text-brand`,
`border-border-strong`, `ring-focus`, `text-streak`, `bg-achievement-soft` and so on
(`apps/web/src/app/globals.css`, `@theme inline`).

| Role                                    | Token                   | Light                                                | Dark                  |
| --------------------------------------- | ----------------------- | ---------------------------------------------------- | --------------------- |
| Page background (ivory / near-black)    | `--bg`                  | `#f5f0e8`                                            | `#100b0b`             |
| Card, input (cream / charcoal)          | `--surface`             | `#fcf9f4`                                            | `#1b1413`             |
| Inset, secondary card, hover            | `--surface-2`           | `#efeae1`                                            | `#241c1b`             |
| Active, track                           | `--surface-3`           | `#e5dfd6`                                            | `#2d2523`             |
| Hairline                                | `--border`              | `#ded8cf`                                            | `#302826`             |
| Input, hover border                     | `--border-strong`       | `#cac2b8`                                            | `#463e3b`             |
| Text                                    | `--text`                | `#271b17`                                            | `#efeae2`             |
| Secondary text                          | `--text-secondary`      | `#514642`                                            | `#c9c3bd`             |
| Muted text                              | `--text-muted`          | `#6c625d`                                            | `#a19a94`             |
| Primary (buttons, active, progress)     | `--brand-primary`       | `#7f2331`                                            | `#ad4d56`             |
| Primary hover                           | `--brand-primary-hover` | `#701426`                                            | `#b7565f`             |
| Brand text on surfaces (links)          | `--brand-primary-text`  | `#7f2331`                                            | `#f0959b`             |
| Brand soft fill                         | `--brand-primary-soft`  | `#fde9e9`                                            | `#3e2022`             |
| Brand tint (selected borders)           | `--brand-primary-muted` | `#f0c4c6`                                            | `#72393e`             |
| Focus ring (brand, ADR-0015)            | `--focus` / `--ring`    | `#7f2331`                                            | `#f5b9bb`             |
| Streak (+ `-soft`), emerald             | `--streak`              | `#0d7350` / `#dbf2e5`                                | `#4fd69a` / `#10281d` |
| Success, done (+ `-soft`)               | `--success`             | `#17744a` / `#e0f2e7`                                | `#5ccf95` / `#12291d` |
| Achievement, upcoming (+ `-soft`), gold | `--achievement`         | `#7a5b20` / `#f4e9d2`                                | `#dcc08a` / `#2a2317` |
| Warning, due soon (+ `-soft`), amber    | `--warning`             | `#8a5a0f` / `#fbedd0`                                | `#ebb95e` / `#33260f` |
| Danger, error (+ `-soft`), signal red   | `--danger`              | `#b3261e` / `#fce8e4`                                | `#f58b77` / `#3f1c19` |
| Info (+ `-soft`), muted blue            | `--info`                | `#2e6293` / `#e4eef9`                                | `#86b5e6` / `#172a3c` |
| Disabled                                | —                       | 50–60 % opacity of the control, `cursor-not-allowed` | same                  |

**Navigation plane** (sidebar, mobile drawer, code editor, dashboard hero): `--nav-bg` `#191211` /
`#0c0706`, `--nav-hover`, `--nav-active` (a deep brand tint, `#381e20` / `#2e1617`), `--nav-border`,
`--nav-text` `#ece7e1`, `--nav-muted`, `--nav-accent` `#f0959b` (the active indicator), `--nav-focus`
`#f5b9bb`. Any element marked `data-nav-plane` switches the focus ring to `--nav-focus`.

**Code** (`--code-*`, on the navigation plane; fixed, not derived from the brand, so the same
source looks the same for every client): comment `#9d958f` (italic), string `#9fd8a8`, number
`#e7c27d`, type `#8fc3ee`, function `#c8b6f5`, operator `#c9c1bb`, invalid `#f58b77`; keywords take
`--nav-accent` and names `--nav-text`. Each is at least 4.5:1 on `--nav-bg` in both themes
(unit-tested in `packages/shared/src/theme/derive.spec.ts`).

**Charts** (`--chart-1…6`): light `#9e404a #3a75af #bc7d19 #209993 #814a8d #779243`, dark
`#cd6a72 #5290cf #bf851e #169d97 #9156a2 #809b4c`. Validated for colour-vision separation in both
themes. Assign in order, never cycle; a seventh series folds into "Other".

**Rules**

- Text on a soft fill uses the matching strong colour (`bg-streak-soft text-streak`), never a third
  colour. Every pairing is ≥ 4.5:1 on its soft fill, the card, the inset and the page (unit-tested).
- Brand-coloured text is `text-brand` (`--brand-primary-text`); `text-primary` is for fills only.
- Semantic colours never come from the brand and the brand never stands in for a status. What a
  measure means picks its colour: learning progress brand, attendance and completion emerald,
  scores and rank gold, capacity and neutral counts ink (`ProgressRing`, `Progress`, `Meter` tones).

## 3. Typography

Faces come from branding. SI Academy uses **Instrument Sans** (loaded with its width axis); the
platform's fallback when branding names no face is IBM Plex Sans; code is **JetBrains Mono** (plan §16.3). Instrument Sans speaks in
two voices: the **display voice** (`font-display`, `stat-figure`: 86 % width, 600, tracking
−0.022em) for heroes, page titles, section titles and large figures, and the regular width for
everything that is read.

| Role          | Size / weight                                                   | Use                                             |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Hero          | 36 → 50 px, display voice, leading 1.02                         | The dashboard greeting, the sign-in statement   |
| Page title    | 32 → 38 px (sm+), display voice, `text-balance`                 | `PageHeader` only, one `h1` per page            |
| Section title | 20 px, display voice                                            | `SectionHeader`; card headings stay 15 px, 600  |
| Body          | 14–15 px, 400, line-height 1.6–1.75                             | Lesson and statement text up to `--reading-max` |
| Label / meta  | 12–13 px, 500                                                   | Field labels, table headers, meta rows          |
| Eyebrow       | 11 px, 600, uppercase, tracking 0.12em (`eyebrow` utility)      | The context above a title: section, type, date  |
| Figures       | 20–52 px, `stat-figure` (display voice, tabular lining figures) | Stat bands, streak, rank, scores, timers        |
| Code          | 13 px mono, line-height 24 px                                   | Editors, inputs and outputs                     |

Numbers that line up (tables, timers, counts) always use `tabular-nums`. Dates and times always go
through `apps/web/src/lib/format.ts` (en-IN, Asia/Kolkata): "27 Sept 2026", "9:30 am", "Sun, 27 Sept".

## 4. Space, shape, depth, light, motion

- **Spacing**: the 4-px scale of plan §16.2 (4, 8, 12, 16, 24, 32, 48, 64). Card padding 20–24 px;
  section rhythm 40 px on dashboards (`space-y-10`).
- **Radius**: controls 8 px (`rounded-lg`), cards 12–16 px (`rounded-xl`, `rounded-2xl`), heroes 28 px.
- **Elevation**: borders first. Cards take `shadow-xs` (a 1 px ink line); `--elevation-card` lifts
  the few cards that lead a page; `--elevation-sm…xl` only for things that float (menus, dialogs, the
  exam console, toasts, hover on clickable cards). Light shadows are tinted with the ink; dark ones
  add a faint warm top highlight.
- **Light**: `glow-corner` / `--glow-brand(-strong)` for the Burgundy Glow; `CardGlow` for a card's
  semantic light (emerald streak, gold rank); `--canvas-glow` is the page's faint wash at the top;
  `grain` (a static SVG noise tile) and `knowledge-grid` only on the sign-in picture and the hero.
- **Motion**: `--motion-fast` 120 ms (hover, colour), `--motion-base` 200 ms (state changes),
  `--motion-slow` 320 ms (sheets, dialogs); easing `--motion-ease-out`. Arcs draw in once
  (`arc-draw`, 900 ms) and their head appears after; clickable cards lift 2 px; the primary button
  gains a soft brand glow on hover. Everything collapses to no motion under `prefers-reduced-motion`.
- **Glass**: the `glass` utility (`--glass-bg` over the page colour, `--glass-blur` 16 px, saturate
  1.4); switched off under `prefers-reduced-transparency`.

## 5. Layout

- **Shell** (`apps/web/src/shell`): ink sidebar 248 px (72 px collapsed, remembered), sticky to the
  viewport with its own scroll and the Burgundy Glow behind the brand; glass header 60 px, sticky,
  naming the section with its icon in a small tile; content capped at `--content-max` 1280 px;
  reading text at `--reading-max` 760 px.
- **Sidebar**: grouped by the navigation manifest, role-filtered, the current group always open,
  other groups foldable; the active item has a deep brand tint, a soft light from its leading edge
  and a glowing rose rule; icon-only mode shows tooltips. Pages outside the navigation map to their
  section (a roll call highlights Attendance).
- **Phones**: staff get the drawer (focus-trapped sheet, Esc closes, body scroll locked); learners
  get the five-tab bar (Home, Courses, Practice, Tests, More), hidden while sitting a test.
- **Breakpoints**: phone < 640, tablet 640–1023, laptop 1024–1279, desktop ≥ 1280. Split
  workspaces (problem + editor) go side by side from `xl`; before that they stack.

## 6. Components

Primitives live in `apps/web/src/components/ui` (restyled shadcn/Radix, ADR-0008); composites in
`apps/web/src/components`.

| Component                                                | Use it for              | Notes                                                                                                                                                                                             |
| -------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                 | Actions                 | `default` = the one primary per view; `outline` secondary; `ghost` tertiary; `destructive` soft red; sizes `sm` / default / `lg`; icons are `aria-hidden`                                         |
| `PasswordInput`                                          | Passwords               | Show/hide toggle button with a fixed name and `aria-pressed`; keeps the field's label and autocomplete                                                                                            |
| `PageHeader`                                             | Every page's title row  | `eyebrow`, `title` (the page's `h1`, display voice), `description`, `meta`, `back` (a link up, not breadcrumbs), `actions`                                                                        |
| `SectionHeader`                                          | A section's heading     | Display voice; optional description and "see all" link                                                                                                                                            |
| `ProgressRing`                                           | The Progress Arc        | Tones `default` (brand), `success`, `streak`, `achievement`, `warning`, `neutral`, `onDark`; optional `threshold` tick; bright head; draws in once                                                |
| `StatStrip`                                              | Summary figures         | One band with hairlines and `stat-figure` numbers; cells wrap and grow, so a short row never leaves a hole                                                                                        |
| `OverviewBand`                                           | A list page's summary   | One dominant measure as an arc with its figure, three supporting figures                                                                                                                          |
| `Meter`, `Progress`                                      | Measures in a list      | Toned by meaning (see section 2); Meter has an optional threshold tick                                                                                                                            |
| `StatusBadge`, `DifficultyBadge`                         | State                   | Soft fill + dot + word; tones neutral, info, success, warning, danger, `brand` (under way), `upcoming` (gold)                                                                                     |
| `CourseCard`, `CourseCover`                              | Courses                 | Uploaded artwork, or an ink plate lit rose or champagne with the arc's concentric lines; progress as an arc; the next lesson as the footer action                                                 |
| `ChoiceRow`                                              | Answer options          | Whole row is the target; the checkbox or radio carries the state; "Right answer" in words after marking                                                                                           |
| `CodeArea` / `CodeFrame`                                 | Code                    | Ink surface, no wrapping, Tab still leaves the field; focus shows on the frame                                                                                                                    |
| `CodeEditor` (`components/code-editor`)                  | Writing code            | CodeMirror 6, loaded only where used; `--code-*` colours, line numbers, folding, bracket matching, language indentation; Tab indents (Esc, Tab leaves); Ctrl+Enter runs, Ctrl+Shift+Enter submits |
| `CodePanel`, `SplitPanes` (`modules/workspace`)          | The coding workspace    | File tab, language, text size, format, reset; console with visible cases, own input and results; side by side from `xl` with a keyboard-movable divider, tabs below it                            |
| `TechMark`                                               | A technology            | A monogram tile with a chart-colour top rule; no third-party logos                                                                                                                                |
| `AssignmentStatusBadge`, `ProgressBadge`, `VerdictBadge` | Assignment states       | Done green, under way burgundy, upcoming gold, overdue red; every chip carries its word                                                                                                           |
| `SearchInput`                                            | The filter above a list | Width on the wrapper                                                                                                                                                                              |
| `Tabs` (+ `TabsCount`)                                   | Views of one thing      | Underline by default, segmented for small switches; counts in the trigger                                                                                                                         |
| `Table`                                                  | Data                    | Sticky header on the inset colour inside a bounded scroll area on desktop, sideways scroll on phones, hover rows, `tabular-nums`                                                                  |
| `PaginationBar`                                          | Paged lists             | "1–25 of 60 rows", page n of m, Previous / Next                                                                                                                                                   |
| `BarChartCard`, `LineChartCard`                          | Trends                  | Token colours, quiet axes, 2 px lines with a faint area, 4 px bar ends, tooltips, a legend for two or more series, an empty state                                                                 |
| `EmptyState`, `ErrorState`, `LoadingRows`, `Skeleton`    | States                  | Empty says what will appear and offers the next step; errors carry a reference and a retry                                                                                                        |
| `StatusPage`                                             | 403, 404, 500           | One message, one way on                                                                                                                                                                           |
| Dialog, Sheet, Dropdown, Tooltip, Select, Toaster        | Overlays                | Radix focus management; toasts bottom-right on desktop, top on phones, 5 s, three at most                                                                                                         |

## 7. Page patterns

- **Learner dashboard**: the hero (an ink plane with the Burgundy Glow: date, greeting as the page's
  `h1`, the welcome line, a live class when there is one, and where you left off with the Progress
  Arc and the one primary action) → habits (streak in emerald, adherence in neutral segments, rank in
  gold) → due soon (a left edge in the urgency colour) beside today and tomorrow → placements →
  other courses → announcements, batches and the progress measures.
- **Staff dashboards**: greeting → the "needs you" list → grouped figures (display numerals, bars
  and arcs toned by meaning) → trends → lists. No wall of identical tiles.
- **List page**: header with the primary action → search, filters and tabs with counts → framed
  table → pagination. Empty and filtered-empty states are different messages.
- **Detail page**: back link, eyebrow naming the record type, title, status in `meta` → stat band →
  tabs.
- **Lesson**: one primary action — "Open the question" on a question lesson (with "Mark complete"
  as an outline button), "Mark complete" otherwise; the course contents with an arc for progress.
- **Workspace** (practice, coding questions): statement panel beside an ink editor; run, submit and
  a console with Results and Your own input; submissions underneath.
- **Exam**: a glass console (title, autosave status, answered bar, countdown, Submit) sticky under
  the header; the question card; a palette grouped by section with a legend; the tab bar hidden on
  phones and the question's own controls sticky at the bottom instead. The countdown turns amber at
  five minutes and red at two, and announces five minutes and one minute to screen readers.
- **Auth** (Task 3, direction A): the form on paper beside the institute's photograph, masked into a
  rounded dark panel on every edge with the lamp's light carried past the frame, grain, a faint grid
  and the corner arcs; the statement sits in the dark space above the learner. The same panel
  serves every width — beside the form from 640 px, above it on phones — so the photograph always
  dissolves into the dark and is never a cropped strip (`login-photo` places it for each shape).
  Without a photograph the panel shows the product arrangement (`LoginArt`, wide screens only);
  "centered" keeps the form alone. A client overlay may ship the picture as
  `clients/<key>/assets/login-background.webp`; the base seed uploads it once (ADR-0015).

## 8. Accessibility

WCAG 2.2 AA (plan §16.5): 4.5:1 text and 3:1 UI contrast, validated for every derived theme and every
semantic family; a visible brand focus ring on every interactive element (a crisp offset outline on
controls, the brand border and a soft halo on text fields, the pale tint on ink planes); a skip
link; one `h1` per page; labelled landmarks (Main navigation, Sections, Questions, Console);
`aria-current` on the current item and question; `aria-sort` on sorted columns; polite live regions
for autosave and timer milestones; 44-px targets on phones; reduced motion and reduced transparency
respected; colour never the only signal; arcs are images with their value in words.

## 9. Adding to the system

1. Need a colour? Use a token. If none fits, add a token to `deriveTokens` (both themes, validated)
   and to the fallback layer in `packages/ui/src/styles.css`, and record it in an ADR.
2. Need a component? Check section 6 first; a new composite goes in `apps/web/src/components` with a
   one-paragraph doc comment saying what it is for.
3. Changed how something looks? Capture the before and after at desktop, laptop, tablet and phone,
   light and dark, and run the browser suite: several journeys find elements by their visible text.
