# ADR-0013 — The design system: neutrals that match the brand's temperature, an ink navigation plane, and tokens derived on read

- **Status**: accepted (proposed on 2026-09-27 and implemented in Task 1; the §16.4 amendment below
  is approved with it)
- **Approved**: 2026-10-01, by the client
- **Date**: 2026-09-27
- **Phase**: Task 1, premium UI/UX redesign (between Phase 6 and Phase 7)

## Context

The demo's first theme was green. The redesign brief asked for a premium red-and-charcoal identity
(burgundy rather than bright red), a warm light theme, a dark theme designed rather than inverted,
glass only where it earns its keep, and one centralised design system — while keeping the template
white-label: every visible colour must still come from the client's branding seeds (plan §16.1,
"brand-neutral core"; §16.7).

Four things in the existing token pipeline (`deriveTokens` in `@lms/shared`, served by
`GET /branding/public`, injected by `BrandingStyle`) stood in the way:

1. **Neutrals were tinted toward the brand hue** (plan §16.4: "generated from primary hue with fixed
   lightness steps"). With a green brand that read as a faint mint; with a red brand it produces pink
   greys. None of the red references studied (docs/design/RESEARCH.md) tint their greys red; the good
   ones pair red with _warm_ neutrals (ivory, stone, brown-black).
2. **Shades were computed in HSL**, whose lightness is not perceptual: a hover or a soft tint came out
   at visibly different weights for different brand colours.
3. **Tokens were stored when branding was saved**, so a change to the derivation only reached a client
   after somebody re-saved their branding, and the `ETag` (the version number alone) did not change
   when the derivation did.
4. **The token set was too small** for the brief: no stronger border, no secondary text tier, no
   third surface, no separate focus colour, nothing for a navigation plane with its own contrast.

## Decision

**1. Neutrals follow the brand's temperature, not its hue.** The system classifies the primary
colour as warm (OKLCH hue below 115° or from 325°, or chroma under 0.03) or cool, and uses one of two
fixed neutral ramps, each defined in OKLCH for light and dark: warm ivory → stone → brown-black, or
cool paper → slate → blue-black. A red, orange or magenta brand gets warm neutrals; a blue, teal or
green brand gets cool ones. The demo (primary `#7F2331`) is warm: page `#f8f4ee`, surfaces
`#fefbf8 / #f2ede7 / #e9e4dd`, ink `#281e19`.

**2. Brand shades are computed in OKLCH** (`hexToOklch`, `oklchToHex` with gamut mapping by chroma
reduction, `ensureContrastOklch`): base, foreground, hover, text-on-surface, soft and muted, for
light and dark. Dark mode lifts the brand to stay readable on near-black (`#ad4d56`, text
`#f0959b`) rather than inverting anything.

**3. Tokens are derived on read.** `BrandingService.current()` derives the token set from the stored
seeds on every read (a few microseconds); the stored copy is no longer authoritative. The `ETag` is
`"branding-v{version}-{12-char fingerprint of the tokens}"`, so a derivation change invalidates caches
without anybody re-saving.

**4. The token contract grows** (all derived, all validated for contrast in both themes):

| Added token                                                                                            | Purpose                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `--surface-3`, `--border-strong`, `--text-secondary`                                                   | A third surface, a stronger border for inputs and hover, a second text tier                                                                  |
| `--brand-primary-hover`, `--brand-primary-text`, `--brand-primary-soft`, `--brand-primary-muted`       | Hover, brand-coloured text that passes 4.5:1, soft fills and tints                                                                           |
| `--focus`, `--ring`                                                                                    | One focus colour, **blue**, distinct from the brand and from danger                                                                          |
| `--nav-bg`, `--nav-hover`, `--nav-active`, `--nav-border`, `--nav-text`, `--nav-muted`, `--nav-accent` | The navigation plane (prefixed `nav`, because shadcn owns `--sidebar-*`)                                                                     |
| `--chart-1…6`                                                                                          | Series colours: the brand in slot 1, the hue closest to it dropped, the rest fixed and validated for colour-vision separation in both themes |

Layout, elevation and motion tokens that do not depend on the brand (`--elevation-xs…xl` tinted with
the ink colour, `--glass-*`, `--motion-*`, `--nav-width` 240 px, `--header-height` 56 px,
`--content-max`, `--reading-max`) live in `packages/ui/src/styles.css` inside `@layer tokens`, with
the demo's brand tokens as fallbacks, so the server-injected brand always wins the cascade.

**5. The navigation plane is ink in both themes.** The sidebar, the mobile drawer and the code editor
share a warm charcoal plane (`--nav-*`) in light and dark, so the product's frame is the same in both
and the content area carries the theme.

**6. Semantic colours stay fixed** (success, warning, danger, info, each with a soft variant, for
both themes) and are never derived from, or overridden by, the brand.

**7. `validateTokens` checks more pairs**: brand text on surface, navigation text on the navigation
plane, the active navigation item, in addition to the existing text/surface and button pairs. It
skips pairs whose tokens a caller does not provide, so older token sets still validate.

## Alternatives considered

- **Keep hue-tinted neutrals.** Rejected: with a red brand the whole interface turns faintly pink,
  and the result depends on the brand in a way no client would expect.
- **Fixed neutral greys for every brand.** Rejected: pure greys look unconsidered next to a warm
  brand; the two-temperature rule keeps the neutrals chosen while staying automatic.
- **A brand-coloured focus ring.** Rejected: with a red brand it collides with error states, and both
  red-brand references that do this well use blue.
- **Store the derived tokens and migrate them.** Rejected: a stored copy goes stale the next time the
  derivation improves; deriving on read costs nothing measurable and removes the class of bug.
- **Name the navigation tokens `--sidebar-*`.** Rejected: shadcn's primitives already read those
  names, and sharing them would let one set silently restyle the other.

## Consequences

- **Every client re-themes coherently from one seed.** A blue brand gets cool neutrals and a blue
  plane accent; a red brand gets warm ones; both pass the contrast checks in both themes (unit tests
  cover ten sample primaries and the demo's exact values).
- **Plan §16.4 is out of date in one row** and gains rows for the new tokens. Proposed amendment,
  for approval:
  - Replace "Neutrals tinted toward the primary — Generated from primary hue with fixed lightness
    steps" with "Neutrals matched to the primary's temperature — one of two fixed OKLCH ramps (warm
    or cool), chosen from the primary's hue".
  - Add the tokens in the table above, and note that tokens are derived on read and fingerprinted
    in the `ETag`.
- **Emails follow the same palette**: `emailBrand()` passes the light tokens to the templates, which
  no longer hard-code any colour.
- **The demo default primary is `#7F2331`** (seeds, `clients/demo/branding.json`, the API default).
  An existing installation keeps its own saved colour.
- If the amendment is not approved, reverting decision 1 is contained in `derive.ts`; the rest of the
  system does not depend on which neutral ramp is chosen.
