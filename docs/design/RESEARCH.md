# Design research — Task 1, premium UI/UX redesign

September 2026. Research came before any implementation, as the brief required. The sources were the
Inspo design archive (real production interfaces, with their extracted design tokens), the reference
portal's learner area, and a screenshot audit of this product's own 85 pages taken before the redesign.
Nothing was copied: no code, no assets, no brand colours, no layouts reproduced one to one.

## 1. References that were useful

**Inspo — about thirty queries** covering education products, burgundy and wine palettes, SaaS dashboards, docs-style
navigation, dark product pages, restrained glass and mobile navigation. The references that shaped
decisions, with what was measured from them:

| Reference                              | What it contributed                                                                                                     | Evidence taken                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Linear (product UI)                    | Enterprise sidebar: grouped sections, quiet labels, fill-not-colour active state                                        | Four text tiers (`#f7f8f8 / #d0d6e0 / #8a8f98 / #62666d`), translucent hairline borders, 15 px body, radii 4–8, two shadows |
| Ghost admin                            | Dashboard hierarchy: a compact figure row, then one dominant chart                                                      | Layout of the dashboard screenshot; small uppercase section labels                                                          |
| Baba (services)                        | Crimson on warm cream done calmly; one filled chip for the active filter                                                | `--background #faf9f1`, ink `#2a1d18` (warm brown-black, not grey), blush `#f8e2db`, maroon `#3d0017`                       |
| Todoist                                | A red brand in a productivity tool without aggression                                                                   | Warm white `#fff9f3`; shadows tinted `#25221e` instead of black; double-ring focus in blue                                  |
| Porsche                                | The most disciplined wine red; restrained glass as tokens                                                               | Wine `#822126`; `frosted-soft/strong` alpha tokens; blue focus `#1a44ea` despite a red brand; motion 250/400 ms             |
| MasterClass                            | Education on charcoal + red works — and where it gets loud                                                              | `#d0294e` at OKLCH chroma 0.20 is the "loud" end to avoid                                                                   |
| Lamborghini, Zora                      | Wine on charcoal, glass-like depth kept quiet                                                                           | `#7e2e36`, `#781b34`                                                                                                        |
| LocalCan docs, Mintlify, Bun reference | Docs navigation as the model for a curriculum: grouped tree, soft-pill active item, numbered steps, "on this page" rail | Screenshots                                                                                                                 |
| Cron                                   | Dark calendar: the hot accent spent only on "today" and the selected event                                              | Screenshot                                                                                                                  |
| Obsidian, Amie                         | Tree navigation in a sidebar; calm light app chrome                                                                     | Screenshots                                                                                                                 |
| Copilot, Captions, Mercury             | Where glass belongs: floating chrome (header, composer), never content cards                                            | Screenshots                                                                                                                 |
| "Dark Product Pages" collection        | Dark themes composed for dark, not inverted                                                                             | Editor's curation                                                                                                           |

Measured in OKLCH, the premium wine references cluster tightly — **L 0.38–0.42, chroma 0.11–0.13,
hue 10–23** (Porsche 0.407/0.131/22.6, Lamborghini 0.419/0.111/17.3, Zora 0.385/0.127/10.0). The loud
reds sit at chroma 0.20 and L 0.56–0.61. "Refined" is therefore a measurable target, not a mood.

**Reference portal (learner area).** Viewed read-only in the browser session that was already signed in
from the planning stage; no credentials were entered. Pages viewed: the dashboard (scrolled), Courses,
Assignments and Tests. No lesson, test or assignment was opened, nothing was submitted, and no
personal data is reproduced here. The planning report's §5 walkthrough (September 2026) covers the
course player, assignment module view and profile, which were not reopened.

**This product, before.** Every page captured at desktop, laptop, phone and dark (the local review
harness). Findings that drove the work: a sidebar that scrolls away on long pages; a wall of 17
identical admin KPI tiles, six of them placeholders; four full-width primary buttons on the student
dashboard, one clipping its label; neutrals faintly tinted green by the brand hue; a burnt-orange
alert band with bright green buttons in dark mode; the lesson page with no view of the curriculum;
a fallback icon on eleven navigation items; five different date formats; and a React hydration error on
both Schedule pages.

## 2. Patterns selected

1. **Ink sidebar in both themes.** A warm charcoal navigation plane with grouped, labelled items, a
   soft fill plus rose indicator for the active item, collapsible to icons with tooltips, and state remembered.
   It stays in view on long pages, with the document scrolling beside it.
2. **Warm paper surfaces.** Ivory page, near-white surfaces, stone fills, warm brown-black ink, borders
   instead of shadows; warm-tinted shadows only where something floats.
3. **Brand as accent.** Wine-burgundy for the one primary action per view, the active and progress
   states and links, never as a surface colour.
4. **Glass only on floating chrome.** Sticky header, command palette, dialog backdrop.
5. **"What matters now" dashboards.** One dominant block (continue learning / today's classes /
   what needs attention), then supporting figures of unequal weight, then lists. Placeholder metrics
   collapse into one quiet line.
6. **Resume card.** The type, the title, a small progress ring and one action (reference portal, adapted).
7. **Dominant metric + supporting metrics** on list pages (reference portal's assignments header, adapted).
8. **Curriculum as a docs tree.** On the course page a module accordion with per-module progress, the
   current lesson marked and locks explained; in the lesson, a sticky curriculum rail (a drawer on phones).
9. **Tabs with counts, search on the right, empty states that point at the next useful action.**
10. **Blue focus ring, distinct from brand and error** (Porsche and Todoist both do this with red brands).
11. **Status chips with icon + text**, never colour alone.

## 3. Why these fit an LMS

A learning platform is used daily and for long stretches by learners, and all day by staff; it must be
calm to read and quick to scan, not exciting. Warm paper and brown-black ink read like study material
and reduce glare over long sessions. A permanent, labelled navigation plane suits
a product with 7–25 destinations per role. The dashboards answer the three roles' first question in
their first block — a learner's next lesson, a trainer's roll calls, an administrator's exceptions.
A docs-style curriculum answers "where am I, what is done, what is next, what is locked" at a glance, the
same way documentation answers it for developers. Keeping red rare keeps it meaningful: it says "act
here" or "you are here", so it never has to compete with error states.

## 4. Patterns rejected

| Pattern                                                                     | Why rejected                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Marketing banner or carousel at the top of the dashboard (reference portal) | Takes the most valuable space for the least useful content (planning report §5.5 already said avoid) |
| Podium leaderboard (reference portal)                                       | Loud, demotivating by default, and not a feature of this product                                     |
| Unlabelled icon-only rail as the default                                    | Slower to learn; kept only as the optional collapsed state, with tooltips                            |
| Serif display face on cream with a terracotta accent                        | The current generic "premium" look; this product needs a technical voice                             |
| Saturated red (chroma ≈ 0.20) as the brand                                  | Measured as the "loud" end of the red references                                                     |
| Glass on content cards, heavy blur everywhere                               | Hurts legibility and performance; no reference that used it well did so                              |
| Neutrals tinted toward the brand hue (the old derivation)                   | With a red brand it produces pink greys; none of the red references do it (ADR-0013)                 |
| Brand-red focus ring                                                        | Collides with error states; both red-brand references use blue                                       |
| Wall of identical KPI tiles                                                 | Every number looks equally important, so none is                                                     |
| A single primary button per card                                            | Many primaries on one screen means no primary; the plan's rule is one per view                       |

## 5. How the design stays original

- The **palette is derived, not borrowed**: wine at OKLCH 0.406/0.126/16.2 sits inside the measured
  premium cluster without matching any reference's value; neutrals are this product's own warm OKLCH
  ramps; chart colours were generated and passed the colour-vision validator in both themes.
- The **structure is this product's own**: the pairing of an ink sidebar with paper content, the
  dashboard compositions, the curriculum treatment and the resume card come from this product's data and
  journeys, not from a reference layout. The reference portal's patterns were re-expressed, not copied —
  different components, different visual language, different copy.
- The **type is the product's white-label face** (IBM Plex Sans by default, chosen per client).
- **White-label is preserved**: every colour still derives from the client's own seeds (ADR-0013), so
  another institute's brand produces its own coherent theme through the same system.
