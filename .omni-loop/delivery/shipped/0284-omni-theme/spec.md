---
prd: 284
title: Omni theme — the homepage's palette on the app, beside Light and Dark
blocked-by: none
spec: file
---

# Omni theme: the homepage's palette on the app, beside Light and Dark

**Date:** 2026-09-27 · **PRD:** #284 · **Touches:** `packages/design` (the Ask tokens) and
`apps/galaxy` (the theme module, the switch, the ask stylesheets, the five app layouts, their tests,
the READMEs). No database, no kit, no route, no layout change.

## Problem

HOME at `/` (PRD 261) gave Omni Loop a look of its own: the void and the cabinet's navy, comic yellow,
the ad's magenta, OmniMan's world. One click further, the app (`/app`, `/ask/*`, `/knowledge`,
`/prd`, `/releases`) drops it. Its pages wear a neutral reading surface, light or dark, and their
theme switch offers **System · Light · Dark**:

- **System** only picks between the two neutral themes, so the app never shows the product's own
  palette, and a visitor crossing from HOME to `/app` lands somewhere that looks like another
  product.
- **Light and Dark** are right for reading, and some people want them for clarity; they must stay.

## Solution

The switch becomes **Omni · Light · Dark**, in that order, on every page that has it today.

- **Omni** is HOME's palette on the app's pages, and the default. It is a colour theme only: the
  faces, sizes, spacing, corners, controls and layout are exactly those of Light and Dark, so the
  professional pages keep one UX whichever theme is on. (Asked: "keep the UX, do not go too far".)
- **Light** and **Dark** are today's themes, unchanged, token for token.
- **System** is gone. Omni is always Omni: it never follows the operating system's light or dark
  preference.

```
today    OMNI LOOP  App        [ System | Light | Dark ]  [Game mode]
after    OMNI LOOP  App        [ Omni ▮ | Light | Dark ]  [Game mode]
                                  └ pressed by default: HOME's void ground, yellow signal
```

### The Omni palette

A third entry in `@omni/design`'s `ASK` tokens, `ASK.omni`, beside `light` and `dark`, with the same
fourteen token names. Every value is one of HOME's colours (`INK` and `ARCADE`), except the
selected option's fill, `#2a2350`, a deep purple between `cab` and `adPurple` that keeps the hint on
it readable.

| token | role on the page | Omni | from |
|---|---|---|---|
| `ground` | the page | `#07061c` | `INK.void` |
| `surface` | an option, a card, the switch | `#120f3a` | `ARCADE.cab` |
| `sunk` | the preview panel, a chip, a key cap | `#0e0d33` | `INK.deep` |
| `line` | borders | `#1a2170` | `INK.navyDark` |
| `ink` | text | `#f2f4ff` | `INK.white` |
| `muted` | hints, descriptions | `#8a90d6` | `ARCADE.dim` |
| `plasma` | the signal: the selected option, the pressed theme, Send, Game mode, the wordmark | `#ffd84a` | `INK.yellow` |
| `plasmaSoft` | the selected option's fill | `#2a2350` | Omni's own |
| `onPlasma` | text on the signal | `#07061c` | `INK.void` |
| `yellow` | the Recommended badge, the knowledge map's sun | `#ff3ea5` | `INK.magenta` |
| `onYellow` | text on the badge | `#07061c` | `INK.void` |
| `cyan` | links, the focus ring | `#6ff0ff` | `INK.cyan` |
| `green` | answered | `#4ee08a` | `INK.green` |
| `red` | errors | `#ff6b86` | `ASK.dark.red` |

- **The signal is comic yellow**, as HOME's PRESS START: yellow with the void's text on it.
  (Asked, over plasma purple and magenta.)
- **The Recommended badge is magenta** in Omni, so it never reads as a selection now that the
  signal is yellow. The token keeps its name, `yellow`: a comment beside `ASK.omni` says it holds
  magenta there, and why.
- **Contrast.** Every pair in `ASK_TEXT_PAIRS` reaches 4.5:1 and every pair in `ASK_UI_PAIRS` 3:1
  in Omni. The lowest text pair is `muted` on `plasmaSoft`, 4.84:1; the badge is 6.16:1; the signal
  on the ground is 14.43:1.
- **Knock-on on the knowledge map.** Its kinds read the tokens: principles (`plasma`) turn yellow in
  Omni, as they are in the arcade's star chart; rules stay cyan, invariants red. The map's sun
  (`yellow`) turns magenta.

### The choice, stored and applied

`apps/galaxy/src/ask/theme.ts` keeps its storage key, `omni-ask-theme`, so a saved Light or Dark
carries over.

- **The choice is the theme.** `ThemeChoice` and `Theme` are both `'omni' | 'light' | 'dark'`;
  nothing is resolved against the system any more, so `resolveTheme` goes.
- **Reading.** A stored `light` or `dark` is itself. Anything else is Omni: no key, a stored
  `system` from before this PRD, an unknown value, and storage that refuses to be read.
- **Storing.** Omni is the key's absence: choosing it removes the key. Light and Dark set it.
- **The script before the first paint** reads the key the same way and marks the ask root with
  `data-ask-theme` and `data-ask-choice` set to the choice. It no longer calls `matchMedia`.
  `theme.test.ts` keeps running it against `readChoice` for every stored value.
- **The switch** (`theme-switch.tsx`) shows `Omni`, `Light`, `Dark`, in that order, and drops its
  listener on the system's preference.

### The stylesheet

- **`themeCss()`** writes one block per theme (`omni`, `light`, `dark`), each on the ask root the
  script marked and on `<html>` through `:has()`, as today. A root the script never marked (no
  script ran) shows Omni, whatever the system prefers: the `prefers-color-scheme` fallback goes.
- **`color-scheme`** is `dark` for Omni (its native controls and scrollbars are dark), `light` and
  `dark` for the other two.
- **`ask.css`** draws the pressed button for `omni`, `light` and `dark` from `data-ask-choice`.
- **Dark-only rules** apply to Omni too: the Game mode dialog's backdrop (`switch.css`) takes the
  ground's colour on `dark` and `omni` alike.
- No other stylesheet changes: every colour on the app's pages is already an `--ask-*` token.

### The five layouts

`app/app`, `app/ask`, `app/knowledge`, `app/prd` and `app/releases` each set the browser's
`themeColor` from the tokens. It becomes one value, `TOKENS.omni.ground`, with no media query: the
metadata is static and cannot know a stored choice, and Omni is the default. `colorScheme` stays
`'light dark'`: the root's own `color-scheme` follows the theme.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | The switch reads Omni · Light · Dark; System goes. | Omni carries the product's look; Light and Dark stay for clarity. (Asked.) |
| D2 | Omni is the default: no stored choice, a stored `system`, or anything unknown shows Omni. A stored Light or Dark is kept. | Everyone sees the opinionated design first and opts out for clarity. (Asked.) |
| D3 | Omni changes colours only; faces, sizes, spacing, corners and controls are the same in all three themes. | The professional pages need one consistent UX. (Asked: "keep the UX, do not go too far".) |
| D4 | Omni's signal is comic yellow on the void; the Recommended badge turns magenta. | HOME's PRESS START; the badge must not read as a selection. (Asked, over plasma purple and magenta.) |
| D5 | Omni is a third `ASK` theme in `@omni/design`, held to the same WCAG AA pairs as Light and Dark. | One source of colour; the package's test already guards every theme it holds. |
| D6 | The token names stay; `yellow` holds magenta in Omni, with a comment. | A rename would touch three stylesheets and every theme for no visible change. |
| D7 | Omni never follows the system's preference, and an unmarked root shows Omni. | Omni is one deliberate dark world, as HOME is. |
| D8 | The browser's `themeColor` is Omni's ground on every app layout. | Static metadata cannot read the stored choice; the default wins. |

## User stories

1. As someone opening `/app` for the first time, coming from HOME, I see the same void, navy and
   yellow, and the switch shows Omni pressed.
2. As someone who reads long specs, I press Light (or Dark) once and every app page shows it on my
   next visits, without a flash of Omni first.
3. As someone who had chosen Light or Dark before this change, I still see it.
4. As someone who had chosen System, I now see Omni, and Light or Dark is one tap away.
5. As someone answering a question on `/ask` in Omni, I read every option, hint and badge as easily
   as in Light or Dark, and the selected option and the Recommended badge never look alike.

## Scope

**In:**

- `packages/design/src/tokens.mjs` (`ASK.omni`), its declaration file, `tokens.test.mjs`, and the
  package README's lines on Ask's themes.
- `apps/galaxy/src/ask/theme.ts`, `theme-switch.tsx`, `theme-tokens.ts`, `ask.css`, and their tests.
- `apps/galaxy/src/switch/switch.css` (the dialog's backdrop on `omni`).
- The five layouts' `themeColor`: `app/app`, `app/ask`, `app/knowledge`, `app/prd`,
  `app/releases`.
- The tests that list the switch's buttons or the theme stylesheet: `switch/headers.test.ts`,
  `knowledge/render.test.ts`, `knowledge/kinds.test.ts` (the kinds' 3:1 now in all three themes),
  `dossier/page/page.test.ts`, and any other that names `System`.
- `apps/galaxy/README.md` where it says the app pages have light, dark and system themes.

**Out:**

- Any face, size, spacing, corner, shadow or layout change: Omni is a palette.
- HOME at `/`, the arcade at `/play`, `/design`: unchanged.
- Renaming the Ask tokens.
- Showing the Omni tokens on `/design`.
- Any database, kit or route change.

## Test seams

Commands and conventions from the testing playbook: `pnpm test` runs vitest over `packages/` and
`apps/*/src/`, tests sit beside their code, and no test calls GitHub or Supabase.

- **`packages/design/src/tokens.test.mjs`:** `ASK`'s themes are exactly `dark`, `light` and `omni`,
  with the same token names; every value is `#rrggbb`; every text pair reaches 4.5:1 and every edge
  pair 3:1 in each of the three (the existing loops, over the new theme).
- **`apps/galaxy/src/ask/theme.test.ts`:** `readChoice` gives `light` and `dark` back, and `omni` for
  `null`, `'system'`, `'omni'`, `''` and `'sepia'`; `storeChoice` removes the key for Omni and sets
  it for Light and Dark, and never throws on refusing storage; the script marks the root with the
  choice `readChoice` gives, for every one of those stored values and when storage throws, and
  contains no `matchMedia`.
- **`apps/galaxy/src/ask/theme-tokens.test.ts`:** the stylesheet declares every token for `omni`,
  `light` and `dark`, with `color-scheme: dark` for Omni; an unmarked root carries Omni's tokens; no
  `prefers-color-scheme` remains; `ask.css` draws the pressed button for all three choices.
- **`apps/galaxy/src/knowledge/kinds.test.ts`:** each kind holds 3:1 on every ground in all three
  themes.
- **The header tests** (`switch/headers.test.ts`, `knowledge/render.test.ts`,
  `dossier/page/page.test.ts`): the switch's buttons read `Omni`, `Light`, `Dark`, in that order,
  before Game mode.
- **The design-system guard** (`src/design-system.test.ts`) still passes: no stylesheet names a
  colour of its own.
- **Manual, recorded in the feature PR:** `/app`, `/ask` (the demo question with a Recommended
  option selected), `/knowledge`, `/prd` and `/releases` in each of the three themes, at 393 and
  1440 px wide; a reload after choosing Light shows no flash of Omni.

## Risks

- **What merging publishes.** The galaxy is a Vercel project imported from this repository, so a
  merge may deploy: every app page opens in Omni for anyone who had no choice saved or had System.
  No migration, no ledger event, no kit file changes.
- **Rollback.** Revert the feature PR's merge commit. Stored `light` and `dark` keep working either
  side of it; a browser that chose Omni has no key, and reads as System again after the revert.
- **A System user who wanted light** now lands on a dark page. Light is one tap away and remembered.
- **The browser bar** shows Omni's void colour to someone on Light: static metadata cannot know the
  stored choice. Cosmetic.
- **Contrast** is guarded by the package's AA test over all three themes, and the knowledge map's
  3:1 test; a value changed later fails them.

## Acceptance criteria

1. On `/app`, every `/ask/*` page, `/knowledge`, every `/prd` page and `/releases`, the theme switch
   shows three buttons, `Omni`, `Light`, `Dark`, in that order, and no `System`.
2. With no stored choice, or a stored `system` or unknown value, those pages show Omni (the ask root
   carries `data-ask-theme="omni"`) whatever the system prefers, with Omni pressed.
3. A stored `light` or `dark` from before this change shows that theme, pressed.
4. Choosing Omni removes the stored key; choosing Light or Dark stores it; a reload shows the chosen
   theme from the first paint, with no flash of another.
5. In Omni the page ground is `#07061c`, cards `#120f3a`, text `#f2f4ff`, and the selected option,
   the pressed theme, Send and Game mode are comic yellow `#ffd84a` with `#07061c` text; the
   Recommended badge is magenta `#ff3ea5`.
6. Every Ask text pair reaches 4.5:1 and every edge pair 3:1 in Omni, Light and Dark
   (`tokens.test.mjs`); each knowledge kind reaches 3:1 on every ground in all three.
7. Light and Dark render exactly as before this change: the same token values, the same pages.
8. Only colours differ between the three themes: no face, size, spacing, corner or layout rule is
   scoped to a theme, except the Game mode dialog's backdrop, which is the ground's colour on Omni
   as on Dark.
9. HOME at `/`, the arcade at `/play` and `/design` are unchanged.
10. `pnpm test`, the galaxy's `typecheck` and `build` pass.
