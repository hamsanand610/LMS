# ADR-0015 — Task 3 visual refinement: a brand focus ring, layered warm neutrals, semantic streak and achievement colours, and a display width

- **Status**: accepted (proposed on 2026-09-27 and implemented in Task 3; amends ADR-0013, approved
  with it)
- **Approved**: 2026-10-01, by the client
- **Date**: 2026-09-27
- **Phase**: Task 3, premium visual refinement (after Task 2)

## Context

The Task 3 brief asked for a richer, more distinctive SI Academy without changing any workflow:
red and ink kept as the brand, secondary colours used only to carry meaning (emerald for the streak,
champagne gold for achievement, amber for warnings, blue for information), a light theme of ivory
and cream rather than white, a dark theme with visible layers and a faint warm-red undertone, a
brand-coloured focus ring instead of browser blue, a type treatment that is not a default, and the
institute's own photograph on the sign-in page. Four of those contradict decisions in ADR-0013 or
need tokens it does not define. The direction itself is in `docs/design/TASK3_VISUAL_DIRECTION.md`.

## Decision

**1. Keyboard focus takes the brand, not blue** (reverses ADR-0013 §4 on `--focus`). Light:
the brand's base shade (`#7f2331` for SI Academy, ≥ 3 : 1 on every surface by construction). Dark:
a pale tint of the brand hue (`#f5b9bb`). The navigation plane gets its own `--nav-focus` (the same
pale tint) because it is dark in both themes. ADR-0013 rejected this because a red focus ring can be
confused with an error; the mitigations are that the two never look alike (buttons, links and other
controls take a crisp 2 px outline offset by 2 px; a text field takes the brand border and a soft
halo, while an invalid field turns signal red and always carries a message in words) and that `--danger` is a different red from the brand in both themes (signal red `#b3261e` against
wine in the light theme; coral `#f58b77` against pale rose in the dark).

**2. The warm neutrals are re-tuned into clearer layers.** The rule that neutrals follow the brand's
temperature and never its hue stands. Light: ivory canvas `#f5f0e8`, cream cards `#fcf9f4` (not
white), warm beige insets `#efeae1`. Dark: canvas `#100b0b`, card `#1b1413`, inset `#241c1b`,
active `#2d2523`, with a warm-red undertone (OKLCH hue 28–34, chroma ≤ 0.013) — too little chroma to
read as pink, enough that the charcoal is not a neutral grey. The navigation plane is one step deeper
than the canvas in both themes. The cool ramp is unchanged.

**3. The active navigation item is tinted with the brand** (`--nav-active` = OKLCH L 0.27, chroma
≤ 0.045 at the brand's hue: `#381e20` for SI Academy). This is the one neutral that takes the brand's
hue, because it marks "you are here" and is small. For an achromatic brand it stays neutral.

**4. Two semantic families join the fixed set** (never derived from the brand, like success, warning,
danger and info): `--streak` / `--streak-soft` (emerald: `#0d7350` / `#dbf2e5` light, `#4fd69a` /
`#10281d` dark) and `--achievement` / `--achievement-soft` (champagne gold: `#7a5b20` / `#f4e9d2`,
`#dcc08a` / `#2a2317`). Each passes 4.5 : 1 on its soft surface, the card, the inset and the canvas
in both themes. Success, warning, danger and info are re-tuned to the new surfaces.

**5. Instrument Sans joins the font list** (`instrument-sans`), loaded with its width axis. The
display voice (hero, page titles, large figures) uses the same family at 86 % width
(`--display-stretch`); a font without a width axis simply renders at its normal width. SI Academy's
branding selects it; the template's default stays IBM Plex Sans. Instrument Sans is the one face
preloaded; the alternates (and the code face) load on demand when a page uses them.

**6. A client overlay may ship a sign-in photograph** at `clients/<key>/assets/login-background.*`.
The base seed uploads it through the storage driver into the existing `branding-background` context
and sets `login.backgroundFileId` — only when no background is set yet, so an administrator's upload
always wins, and it skips quietly when storage is not configured.

## Alternatives considered

- **Keep the blue focus ring.** Rejected at the institute's request; the collision it guarded
  against is handled by shape and by a distinct danger red.
- **Tint all dark neutrals with the brand's exact hue.** Rejected for the same reason as in
  ADR-0013: with a red brand the whole interface turns pink. Only the undertone of the warm ramp
  moves, and only the active navigation item takes the brand's hue.
- **A separate display family** (a condensed grotesk beside a text face). Rejected: two families to
  load, and the width axis gives the same editorial contrast from one file.
- **Ship the photograph as a static web asset.** Rejected: the template is white-label and the
  picture belongs to one institute; the branding background is the product's own place for it.

## Consequences

- Every institute's focus ring, active navigation state and dark undertone change with the new
  derivation on the next branding read (tokens are derived on read, ADR-0013 §3); no data migration.
- `validateTokens` gains checks for the new families, the focus colour and the active navigation
  item; the unit tests cover the SI Academy values and ten sample primaries.
- An existing installation keeps its font until an administrator picks Instrument Sans; a fresh
  SI Academy seed selects it.
- Reverting decision 1 is one line per theme in `derive.ts`.
