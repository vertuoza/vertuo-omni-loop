# Plan: Omni theme

PRD #284, spec beside this plan (`spec.md`). The feature branch `feat/omni-theme` merges into `main`
through the feature PR, whose body says `Closes #284`. Each slice is a sub-PR from
`feat/omni-theme--<slice>` into the feature branch, whose body says `Part of #284`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The app pages open in Omni, and the switch reads Omni · Light · Dark. Covers: `ASK.omni` in `@omni/design` with its comment on `yellow`, its declaration and the AA test over three themes; `ThemeChoice` and `Theme` as `omni`, `light`, `dark`, `readChoice` (anything but light or dark is Omni), `storeChoice` (Omni removes the key), the script without `matchMedia`, `resolveTheme` gone; the switch's labels and order, its system listener gone; `themeCss()` with three blocks, `color-scheme: dark` for Omni and Omni for an unmarked root; the pressed button for `omni` in `ask.css`; the dialog's backdrop on `omni` in `switch.css`; every test that lists the switch's buttons or the theme stylesheet, and the knowledge kinds' 3:1 in all three themes | `packages/design/src/tokens` `apps/galaxy/src/ask/theme` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/switch/` `apps/galaxy/src/knowledge/render.test.ts` `apps/galaxy/src/knowledge/kinds.test.ts` `apps/galaxy/src/dossier/page/page.test.ts` | — | 1 |
| s2 | The browser bar and the docs say Omni. Covers: `themeColor` as `TOKENS.omni.ground`, one value with no media query, in the five layouts (`/app`, `/ask`, `/knowledge`, `/prd`, `/releases`); the galaxy README's lines on the app pages' themes; the design package README's lines on Ask's tokens; the manual acceptance with screenshots | `apps/galaxy/app/app/layout.tsx` `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/app/knowledge/layout.tsx` `apps/galaxy/app/prd/layout.tsx` `apps/galaxy/app/releases/layout.tsx` `apps/galaxy/README.md` `packages/design/README.md` | s1 | 2 |

**Shared ground.** No prefix is declared by both slices, and they sit in different waves.

- `packages/design/src/tokens` is s1's alone: `tokens.mjs`, `tokens.d.mts` and `tokens.test.mjs`.
  `tokens.css` does not change (`ASK` is not in it), so no regeneration is needed; if the
  generator's test says otherwise, s1 runs `pnpm --filter @omni/design tokens` and commits the
  result, never an edit by hand.
- `packages/design/README.md` is s2's alone, beside the galaxy README: s1 writes no README.
- `apps/galaxy/src/ask/theme` covers `theme.ts`, `theme-script.tsx`, `theme-switch.tsx`,
  `theme-tokens.ts` and their tests, all s1's.

The ordering has a reason: s2's layouts read `TOKENS.omni`, which s1 creates, and s2 ends the PRD, so
it carries the manual acceptance across the five pages.

## Per slice: done when

**s1**

- `ASK` has exactly the themes `dark`, `light` and `omni`, with the same fourteen token names, every
  value `#rrggbb`, and `ASK.omni` holds the spec's values; `ASK.light` and `ASK.dark` are unchanged.
- `tokens.test.mjs` passes: every text pair reaches 4.5:1 and every edge pair 3:1 in all three
  themes.
- `readChoice` gives `light` for `'light'`, `dark` for `'dark'`, and `omni` for `null`, `'system'`,
  `'omni'`, `''` and `'sepia'`.
- `storeChoice` removes the key for Omni, sets it for Light and Dark, and never throws when storage
  refuses.
- The script, run against a fake root for each of those stored values and for storage that throws,
  marks the root's `data-ask-theme` and `data-ask-choice` with what `readChoice` gives; it contains
  no `matchMedia`.
- `themeCss()` declares every token for `omni`, `light` and `dark`, with `color-scheme: dark` for
  Omni; the unmarked root carries Omni's tokens; the string holds no `prefers-color-scheme`.
- `ask.css` draws the pressed button for `omni`, `light` and `dark`; `switch.css` gives the dialog's
  backdrop the ground's colour on `omni` as on `dark`.
- Every page header the tests render lists the switch as `Omni`, `Light`, `Dark`, in that order,
  before `Game mode`, and no `System` button remains.
- Each knowledge kind reaches 3:1 on every ground in all three themes.
- `pnpm test` passes, and the design-system guard (`src/design-system.test.ts`) with it.

**s2**

- The five layouts' `viewport.themeColor` is `TOKENS.omni.ground`, one value, and no layout reads
  `TOKENS.light` or `TOKENS.dark` for it any more; `colorScheme` stays `'light dark'`.
- `apps/galaxy/README.md` says the app pages have Omni, Light and Dark themes, Omni the default and
  the homepage's palette; no line says "system" theme.
- `packages/design/README.md` says `ASK` holds Ask's Omni, light and dark reading tokens, and that
  the AA test runs in all three.
- `pnpm test`, the galaxy's `typecheck` and `build` pass.
- Manual, recorded in the feature PR with screenshots: `/app`, `/ask` (the demo question, a
  Recommended option selected), `/knowledge`, `/prd` and `/releases` in Omni, Light and Dark, at 393
  and 1440 px wide; a first visit with no stored choice opens in Omni with Omni pressed; a reload
  after choosing Light shows no flash of Omni; HOME at `/`, `/play` and `/design` look as before.
