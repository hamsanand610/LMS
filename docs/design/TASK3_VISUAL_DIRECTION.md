# Task 3 — Visual direction: SI Academy, premium refinement

A visual pass over the Task 1 design system and the Task 2 screens. Nothing here changes a workflow,
a permission, an API or a business rule; the brand foundation (burgundy and ink, ivory in the light
theme, charcoal in the dark), the navigation structure and every Task 2 feature stay as they are.
Decisions that amend ADR-0013 are recorded in ADR-0015.

## 1. Where the interface stood

Screens audited in both themes at 1440 × 900 (learner, trainer, administrator, sign-in):

1. **Flat hierarchy after the hero.** Every block below "Continue learning" is the same bordered card
   at the same weight, so the dashboard reads as a grid of equals.
2. **Red did every job.** Streak checks, progress bars, the leaderboard highlight, badges and two
   competing primary buttons on the lesson page ("Open the question", "Mark complete") were all the
   brand colour, so it stopped meaning "the thing to do next".
3. **One black in the dark theme.** Page, card and inset sat within a few lightness points of each
   other on a brown-grey, so depth came only from borders.
4. **Corporate white in the light theme.** Cards were almost `#fff` on ivory; the paper never felt
   designed.
5. **Template covers.** A course without artwork showed a large letter on diagonal stripes, which read
   as placeholder and turned muddy in the dark theme.
6. **Bars everywhere.** Progress was a thin horizontal bar on nearly every surface.
7. **Neutral type.** IBM Plex Sans at one width for everything: legible, but nothing about it said
   "SI Academy".
8. **A plain frame.** The sidebar and header were correct but had no light, no material and a blue
   focus ring that belonged to no one.

## 2. Research

**Inspo** (screens, colour and component search) was used for every decision below; the references
teach principles, nothing was copied.

- Burgundy luxury brands (automotive, audio, hospitality) pair wine with restrained grotesk type,
  photography that falls off into charcoal, and a _champagne_ secondary accent (`#d0ab86`,
  `#b47e5b` families) — the model for the achievement colour.
- A premium education reference pairs a condensed grotesk display face with a regular-width body on
  charcoal and a single crimson call to action — the model for the display/body split.
- Editorial hospitality and leather-goods sites put wine on warm stone and ivory paper — the model for
  the light theme's cream cards on ivory.
- A research lab's identity built on concentric arcs showed how one geometric motif can carry a whole
  product — the model for the Progress Arc.
- Across the display faces in the corpus, grotesk sans dominates (about three quarters); humanist
  serifs appear mostly in fashion and food.

**21st** was requested for component research, but no 21st connector is available in this
environment (it is neither connected nor listed in the connector registry), so it was not used and
nothing was installed. Component patterns came from Inspo's component search and the existing
primitives instead; no new dependency was added.

## 3. Signature

- **Primary motif — the Progress Arc.** A thin arc with a round cap and a small bright head: the
  learner's movement through a course. It appears wherever progress is shown (course cards, the
  dashboard hero, streak week, completion states) and once, large and faint, on the sign-in picture.
  Arcs replace most horizontal bars.
- **Secondary motif — the Burgundy Glow.** One soft radial light in the brand colour, always from the
  upper corner of the element that carries it: the sign-in picture, the dashboard hero, the sidebar
  head, the header of a course. Never on ordinary cards, never more than one per view region.
- A faint architectural grid survives only inside the glow (sign-in and hero), as texture, not as a
  motif of its own.

## 4. Sign-in — three directions

| Direction                           | Idea                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Verdict                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **A — Cinematic Learner Workspace** | The institute's own photograph of a learner at a desk at night, lit by one wine lamp. The picture is not a rectangle: it is masked into the panel's charcoal on all four edges, graded with a burgundy light that continues the lamp beyond the frame, a vignette, fine grain and a faint grid in the empty wall. The words sit in the dark negative space above the subject; the Progress Arc sits in the empty corner. The same panel serves every width: beside the form from 640 px, above it on phones. | **Selected and locked** by the institute. Implemented.                                                                          |
| **B — Knowledge Grid**              | No photograph. An architectural grid of hairlines, oversized editorial numerals for the institute's own facts, and concentric arcs converging on the sign-in statement.                                                                                                                                                                                                                                                                                                                                      | Strong and brandable, but abstract: it says "design studio" before it says "learning". Not implemented.                         |
| **C — Product Constellation**       | A refined version of the Task 2 arrangement: real product surfaces (a passing solution, a course in progress, today's class, the streak) floating in the burgundy glow.                                                                                                                                                                                                                                                                                                                                      | Honest about the product but reads like a feature tour; kept only as the fallback when an institute has uploaded no photograph. |

**Direction A in detail**

- Split layout kept: form on the left in the page's own theme; the picture inset as a rounded dark
  panel on the right in both themes (the picture's world is night, whatever the theme). The split
  holds from 640 px; on phones the panel sits above the form. At every width the photograph is
  anchored to the panel's foot and masked on all four edges, never shown as a cropped rectangle.
- The photograph is stored as the institute's branding background (the existing
  `branding-background` upload context), optimised to WebP, and seeded from
  `clients/demo/assets/login-background.webp` only when no background has been set.
- Copy, all backed by the product: eyebrow **SI ACADEMY**; statement **Continue where your learning
  left off.**; supporting line **Courses, practice, projects and career growth — in one place.**
- The form gains a show/hide control for the password, a brand focus ring and quieter helper text.

## 5. Typography

**Instrument Sans** for the whole interface (a grotesk with a width axis, free, on Google Fonts), used
in two voices, plus **JetBrains Mono** for code:

| Role                                 | Setting                                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| Display (hero, page titles, numbers) | 86 % width, weight 600, tracking −0.02 em, tabular lining figures |
| Headings in cards                    | 100 % width, weight 600, tracking −0.01 em                        |
| Body and controls                    | 100 % width, 400/500, 14–16 px, line height 1.5–1.6               |
| Labels (eyebrows)                    | 11 px, weight 600, tracking 0.12 em, uppercase                    |
| Code                                 | JetBrains Mono 400/500                                            |

Plex, Inter and Manrope stay available to other institutes; only Instrument Sans is preloaded.

## 6. Colour and tokens

Red and ink are the brand; other hues carry information only. Values are for the SI Academy seed
(`#7F2331`); every token is still derived, so another institute's colour re-themes the same way.

| Token                                       | Light                             | Dark                                 | Job                                                        |
| ------------------------------------------- | --------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `--bg` canvas                               | `#f5f0e8` ivory                   | `#100b0b` near-black, wine undertone | The page                                                   |
| `--nav-bg` sidebar                          | `#191211`                         | `#0c0706`                            | The navigation plane (ink in both themes)                  |
| `--surface` card                            | `#fcf9f4` cream                   | `#1b1413` charcoal                   | Cards, tables, dialogs                                     |
| `--surface-2` inset / secondary card, hover | `#efeae1` warm beige              | `#241c1b`                            | Insets, secondary cards, hover rows                        |
| `--surface-3` active / track                | `#e5dfd6`                         | `#2d2523`                            | Pressed states, progress tracks                            |
| `--border` / `--border-strong`              | `#ded8cf` / `#cac2b8`             | `#302826` / `#463e3b`                | Hairlines / controls                                       |
| `--text` / secondary / muted                | `#271b17` / `#514642` / `#6c625d` | `#efeae2` / `#c9c3bd` / `#a19a94`    | Ink tiers (all ≥ 4.5 : 1 on cards)                         |
| `--brand-primary`                           | `#7f2331` wine                    | `#ad4d56`                            | Primary action, active navigation, current progress        |
| `--nav-active`                              | `#381e20`                         | `#381e20`                            | Active navigation item: a burgundy tint, not a block       |
| `--focus`                                   | `#7f2331`                         | `#f5b9bb` pale rose                  | Keyboard focus (brand, never browser blue)                 |
| `--streak`                                  | `#0d7350` emerald                 | `#4fd69a`                            | Streak, consistency                                        |
| `--success` / completed                     | `#17744a`                         | `#5ccf95`                            | Done, passed, met                                          |
| `--achievement`                             | `#7a5b20` champagne gold          | `#dcc08a`                            | Rank, podium, milestones; also "upcoming" in neutral chips |
| `--warning`                                 | `#8a5a0f` amber                   | `#ebb95e`                            | Due soon, partly met                                       |
| `--danger`                                  | `#b3261e` signal red              | `#f58b77` coral                      | Errors, overdue — a different red from the wine brand      |
| `--info`                                    | `#2e6293` muted blue              | `#86b5e6`                            | Information                                                |

Each semantic colour has a `-soft` surface (e.g. streak `#dbf2e5` / `#10281d`); every pairing is
≥ 4.5 : 1 on its soft surface, the card, the inset and the canvas in both themes (derive.spec.ts).
Violet is not used: nothing in the product needs a sixth meaning.

## 7. Card roles

| Role              | Treatment                                                                       |
| ----------------- | ------------------------------------------------------------------------------- |
| Primary feature   | Ink plane, burgundy glow, display type, the one primary button                  |
| Progress          | Cream card, Progress Arc, figure in display numerals                            |
| Metric            | Borderless figure band on the canvas, semantic colour only on the figure's icon |
| Learning (lesson) | Reading surface, generous measure, one completion action                        |
| Assignment / test | Card with a due-state rule on the left edge in the semantic colour              |
| Course            | Cover with subject pattern, arc for progress, next lesson as the footer action  |
| Schedule          | Time column in tabular figures; the live class lit in brand                     |
| Achievement       | Champagne on the achievement soft surface; streak in emerald                    |
| Notification      | Row, unread marked by a dot and weight, not by colour alone                     |
| Data / table      | Flat surface, sticky header on the inset colour, hover row                      |

## 8. Motion

120–320 ms, decelerating (`cubic-bezier(0.22, 1, 0.36, 1)`): arcs draw in once, cards lift 2 px on
hover, the active navigation light fades in. No looping animation except the "live" dot. Everything
is switched off under `prefers-reduced-motion`.
