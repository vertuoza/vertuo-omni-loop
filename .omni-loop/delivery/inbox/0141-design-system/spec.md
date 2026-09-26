---
prd: 141
title: Omni Loop design system — one library for the logo, colours, fonts and sprites
blocked-by: [100]
spec: file
---

# Omni Loop design system

**Date:** 2026-09-26 · **PRD:** #141 · **Touches:** `packages/sprites` (renamed `packages/design`),
`apps/galaxy` · **Blocked by:** #100 (Workspaces), whose theme module and house brand this PRD
feeds

This is the first of two PRDs that give Omni Loop a front door:

1. **This one.** The design system: one package holding the Omni Loop logo, the colour tokens, the
   fonts, the sprites and new OmniMan poses; the galaxy game and Ask moved onto it; a public
   `/design` page that shows it all; Omni Loop as the house brand.
2. **HOME.** A public home page at `/`, drawn as a retro Super Nintendo print ad, that explains
   loop engineering, with a PRESS START that opens the game on a route of its own. It is built from
   this PRD's package and is brainstormed once this one's phase-0 PR is merged.

## Problem

Omni Loop has no look of its own. What exists is scattered and carries a customer's brand:

- **Colours live in three places.** The pixel palette (`packages/sprites/src/palette.mjs`,
  `PALETTE` and `INK`), the arcade's `:root` custom properties (`apps/galaxy/src/arcade/arcade.css`,
  lines 11 to 30, a hand copy of `INK`), and Ask's light and dark tokens
  (`apps/galaxy/src/ask/theme-tokens.ts`). Nothing checks that the copies agree.
- **Fonts are Google Fonts links** in two layouts: Jersey 10 and Press Start 2P in
  `apps/galaxy/app/layout.tsx`, Atkinson Hyperlegible Next and JetBrains Mono in
  `apps/galaxy/app/ask/layout.tsx`. There is no type scale and no display face for large headlines.
- **There is no Omni Loop logo.** The boot screen says "VERTUOZA presents" and draws the Vertuoza
  V (`apps/galaxy/src/arcade/mark.ts`); the title's OMNI/LOOP is DOM text
  (`src/arcade/scenes/attract.tsx`). After #100 the house brand, used signed out, in demo mode and
  in the single-file artifact, is still `{ name: 'Vertuoza' }` (`src/arcade/brand.ts`).
- **OmniMan has two idle frames only.** An ad needs him to point, cheer and run.

Vertuoza is Omni Loop's first customer, not its brand. The HOME page (PRD 2 above) cannot be built
on this: it would copy the tokens a fourth time and draw a customer's logo on the product's front
door.

## Solution

`packages/sprites` becomes `packages/design`, published in the workspace as `@omni/design`: plain
ES modules, CSS and font files, with no React or Next dependency, so that it can leave the monorepo
as a library later without a rewrite. It stays `private` in this PRD.

| Module | What it holds |
|---|---|
| `tokens` | The pixel palette (`PALETTE`, one character to one colour, unchanged), the named colours (`INK`, plus the poster accents below), and Ask's semantic light and dark tokens. One generator writes `tokens.css`, the `:root` custom properties, from the JS values. |
| `fonts` | The woff2 files of the four font roles, `fonts.css` with their `@font-face` rules, and the type scale. |
| `logo` | The Omni Loop logo as pixel art, the 16-bit crest (below), in three forms: `full` (OMNI LOOP), `lockup` (a big O leading MNI LOOP) and `mark` (the O alone), plus the favicon on its own 16×16 grid and a one-colour variant of each. It exports the pixels, a crisp SVG at any whole-number scale, and a canvas drawing. |
| `sprites` | Everything `@omni/sprites` holds today (the forge, the drawing code, the heroes, the fleet mascots, Entropy, the icons), plus three OmniMan poses and a poster scale. |
| `brand` | `OMNI_LOOP`: the product's name, its tagline, its logo and its theme colour. |

**The new colours.** Six named colours are added to `INK`. Two finish the logo's ramp:
`highlight` (`#fff3a8`) and `ember` (`#d9531a`), around the existing `yellow` and `orange`
(`PALETTE.o`, `#ff9b30`). Four give the print ad its voice: `magenta` (`#ff3ea5`), `adPurple`
(`#5b1a86`, the ad's text column), `starfield` (`#05040f`, the space behind the hero art), and
`orange`, which gains a name.

**The 16-bit crest.** The logo is pixel art, made by the rules the sprites are made by:

- **The O is a loop arrow:** a pixel ring broken at the top right, its end sharpened into an
  arrowhead. The same O is every O of the wordmark, and the `mark` alone.
- **The letters** M, N, I, L and P are a chunky pixel face: 5×7 glyphs drawn at 2× on the grid.
- **The finish** is the forge's: a 4-tone ramp lit from the top left (`highlight`, `yellow`,
  `orange`, `ember`), a `navy-dark` outline on every edge, and a two-pixel `plasma-dark` drop shadow.
- **Scale** is whole numbers only, never smoothed: the logo grows with the poster scale like any
  sprite. The favicon is drawn on its own 16×16 grid, not shrunk.
- **The one-colour variant** is the silhouette in `navy-dark`, for a light ground or a single ink.

**The four font roles.** All four are under the SIL Open Font License, so their files ship in the
package.

| Role | Face | Used for |
|---|---|---|
| `display` | Anton, slanted 12° by the type scale | Ad headlines and taglines beside the logo |
| `pixel` | Press Start 2P for labels and HUD, Jersey 10 for longer game text | The game, its hints, its numbers |
| `body` | Atkinson Hyperlegible Next | Reading copy, Ask |
| `mono` | JetBrains Mono | Code, commands |

The type scale names each step (`display-xl` to `display-s`, `pixel-l` to `pixel-s`, `body-l` to
`body-s`, `mono`) as a role, a size, a line height and a slant, in `tokens.css` and in JS.

**The OmniMan poses.** `omni-point` (arm out, finger pointing to his left, the spokesperson of the
ad), `omni-cheer` (thumbs up) and `omni-run` (two frames), on the same 32×48 body as `omni`, drawn
through the same forge, recolourable through `heroes.mjs` like every hero. The poster scale renders
any sprite at a whole-number scale up to 16×, with the forge's outlines kept on the pixel grid, for
art that fills half a page.

**Two brand layers.** Omni Loop is the product brand; a workspace's mark is its customer's.

- The house brand becomes Omni Loop. Signed out, in demo mode and in the single-file artifact, the
  boot screen reads "OMNI LOOP presents" and draws the Omni Loop logo, the title shows the logo in
  place of the OMNI/LOOP DOM text, and the favicon, the page title and `themeColor` come from
  `OMNI_LOOP`.
- Inside a workspace, the letter mark #100 built stays: a member of Vertuoza sees the V, pixel for
  pixel, on the deck emblem and wherever #100 draws it.

**Galaxy moves onto the package.**

- `arcade.css` drops its `:root` colour block and imports `@omni/design/tokens.css`. The theme
  module #100 adds takes its default values from the package; a workspace's overrides are written
  on top as #100 built them, and `valid_theme()` is unchanged.
- `ask/theme-tokens.ts` re-exports the package's semantic tokens; its WCAG test moves with them.
- Both layouts drop their Google Fonts links and import `@omni/design/fonts.css`, so the fonts are
  served from the arcade's own origin.
- Every `@omni/sprites` import becomes `@omni/design` (about 25 files in `apps/galaxy`, and
  `next.config.mjs`).
- The single-file artifact (`artifact/build.mjs`) inlines the two pixel fonts; the display and body
  roles fall back to system faces there, to keep the page small.

**The `/design` page.** A public route in the galaxy app, outside the arcade, readable without
signing in. It renders, straight from the package: every logo form on dark and light grounds, at several whole-number scales; every
colour with its name, its hex and its contrast pairs; the type scale; every sprite in every frame,
the heroes in every fleet's colours; the three OmniMan poses at poster scale; and the icons.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Two PRDs: this design system first, the HOME page after it and blocked by it. | HOME is the library's first real user; building the library alone keeps this review small and gives HOME finished parts. (Asked; the person chose it.) |
| D2 | `@omni/sprites` is renamed and grown into `@omni/design`; one package, not two. | The palette already lives with the sprites and feeds both pixels and CSS; a second package would split one source of truth. (Asked.) |
| D3 | The package has no React or Next dependency: ES modules, CSS, SVG strings and font files. | It must be able to leave the monorepo as a library; the galaxy wraps what it needs in its own components. |
| D4 | The logo is the 16-bit crest: pixel art, a loop-arrow O and a chunky pixel face, finished by the forge's rules (4-tone ramp, navy outline, plasma drop shadow). | The person picked it from five drawn directions (pixel crest, comic impact, orbit, star box-art, signal bars), after rejecting a box-art wordmark with an emblem O. It is the game's own language, so the logo, the sprites and the arcade read as one. |
| D5 | Four font roles, display Anton, self-hosted from the package. | The ad needs a heavy condensed face the pixel fonts cannot give; self-hosting removes the third-party request and makes the library portable. (Asked.) |
| D6 | Three OmniMan poses and a poster scale are part of the system. | HOME and any later page pick poses from the library instead of drawing their own. (Asked.) |
| D7 | Galaxy's game and Ask move onto the package in this PRD; `apps/omni-app` does not. | One source of truth from the day the package lands; the GitHub App's avatar belongs to its registration, which is out of reach here. (Asked.) |
| D8 | Blocked by #100. Omni Loop is the house brand; the V survives only as Vertuoza's workspace mark; the package gives #100's theme module its defaults. | #100 is nearly delivered and reshapes the same files; the two brand layers keep its per-workspace mark and theme overrides intact. (Asked.) This takes "the signed-out Omni brand" from #100's planned PRD 2, and leaves that PRD the sign-in and workspace work. |
| D9 | A public `/design` page, rendered from the package. | The style guide doubles as a visual test and as the reference for HOME. (Asked.) |
| D10 | The artifact inlines only the pixel fonts. | The single-file page must stay small; the display and body roles have close system fallbacks. |

## User stories

1. As a visitor with no account, I open `/design` and see the Omni Loop logo, its colours, its type
   and every sprite, so I know what Omni Loop looks like.
2. As an engineer building HOME, I import the logo, the tokens, the fonts and OmniMan pointing from
   `@omni/design`, and draw nothing of my own.
3. As a player signed out, I see "OMNI LOOP presents" and the Omni Loop logo on the boot and title
   screens, not a customer's name.
4. As a member of the Vertuoza workspace, I still see the V on the deck, exactly as before.
5. As an engineer changing a colour, I change it once in the package, and the game, Ask and
   `/design` all follow; a test fails if a copy drifts.
6. As a visitor reading Ask, the text keeps its WCAG AA contrast in light and dark.

## Scope

**In:**

- **Package:** the rename to `packages/design` / `@omni/design`; the `tokens`, `fonts`, `logo`,
  `sprites` and `brand` modules; `tokens.css` and `fonts.css` and the generator of `tokens.css`;
  the woff2 files; the three OmniMan poses and the poster scale; the package's README (what each
  module exports, and the brand rules: which logo form on which ground, the minimum sizes).
- **Galaxy:** every import moved to `@omni/design`; `arcade.css` and `ask/theme-tokens.ts` reading
  the package; the layouts loading `fonts.css`; the house brand as `OMNI_LOOP` on the boot and
  title screens, the favicon, the page title and `themeColor`; the `/design` route; the artifact
  build inlining the pixel fonts.
- **READMEs:** `apps/galaxy/README.md` where it names `packages/sprites`, the boot screen or the
  fonts; the root `README.md` where it lists the packages.

**Out:**

- **PRD 2 (HOME):** the page at `/`, its copy, its hero art, and the game's move to its own route.
- **`apps/omni-app`:** its `logo.png` and the GitHub App's avatar.
- **Publishing** `@omni/design` to a registry, or moving it to a repository of its own.
- **Workspace theming:** #100's overrides, `valid_theme()`, the letter mark and the theme editor
  are unchanged.
- **Game rules, data and screens** other than the boot and title: nothing else changes on screen.

## Test seams

Commands and conventions from the testing playbook: `pnpm test` runs vitest over `packages/` and
`apps/*/src/`, tests sit beside their code, and no test calls GitHub or Supabase.

- **`packages/design/src/tokens.test.mjs`:**
  - `tokens.css`, as committed, equals what the generator writes from the JS tokens.
  - Every semantic text/ground pair Ask declares passes WCAG AA (4.5:1, 3:1 for large text) in
    light and in dark (moved from `ask/theme-tokens.test.ts`).
  - Every `INK` colour that names a `PALETTE` character has that character's value.
- **`packages/design/src/logo.test.mjs`:** every form's pixels use only colours from `INK`; every
  filled pixel has an outline or a filled neighbour on each side (no stray pixel); the SVG at scale
  *k* is exactly *k* times the pixel size, with `shape-rendering="crispEdges"`; the favicon is
  16×16 and its ring's gap and arrowhead are each at least one pixel.
- **`packages/design/src/fonts.test.mjs`:** every face `fonts.css` declares points to a woff2 file
  that exists in the package, and every role in the type scale names a declared face.
- **`packages/design/src/sprites.test.mjs`:** the existing sprite and hero tests, plus: each
  OmniMan pose is 32×48, uses only palette colours, recolours through `heroes.mjs`, and renders at
  poster scale 16× to an image exactly 16 times its size.
- **`apps/galaxy/src/arcade/brand.test.ts`:** the house brand is `OMNI_LOOP`; the boot and title
  read OMNI LOOP signed out, in demo mode and closed; a Vertuoza workspace brand still draws the V.
- **`apps/galaxy/src/design-system.test.ts`:** no stylesheet under `apps/galaxy` declares a colour
  custom property on `:root`; no file under `apps/galaxy/app` links `fonts.googleapis.com`; no file
  imports `@omni/sprites`; the theme module's defaults equal the package's values.
- **`/design`:** a render test of the page's component that finds every logo form, every `INK`
  colour, every type-scale step and every sprite name.
- **Manual, recorded in the feature PR:** `pnpm galaxy:shots` before and after, at its three sizes;
  every scene is unchanged but the boot and title, which show the Omni Loop logo; and `/design`
  opened on a phone and a desktop.

## Risks

- **What merging publishes.** The galaxy app is a Vercel project imported from this repository, so
  a merge to `main` can deploy: the public `/design` route, the new favicon and page title, and the
  Omni Loop boot and title screens. No migration, no ledger event and no kit file changes. The kit's
  playbook leaves open whether a merge deploys the galaxy; this PRD assumes it may.
- **Rollback.** Revert the feature PR's merge commit. The package rename and the imports revert
  together; nothing is stored anywhere that outlives the revert.
- **Fonts through Next 16.** Next bundling woff2 files referenced by a workspace package's CSS is
  unproven here. The first slice proves it with one face before any layout moves.
- **The rename touches about 25 imports.** It is mechanical and lands as one slice, so it merges or
  reverts whole.
- **The artifact's size** grows by the two pixel fonts only (tens of kilobytes).
- **#100's theme module** may land with a shape this spec guesses at. The slice that feeds its
  defaults reads the module as merged, and keeps its names.

## Acceptance criteria

1. `@omni/design` exists at `packages/design`, and nothing in the repository imports `@omni/sprites`.
2. The package has no `react`, `react-dom` or `next` dependency, and its exports name `tokens`,
   `fonts.css`, `tokens.css`, `logo`, `sprites` and `brand`.
3. `tokens.css` equals the generator's output from the JS tokens, and a changed JS value without a
   regenerated `tokens.css` fails `pnpm test`.
4. Ask's text and ground pairs pass WCAG AA in light and dark, tested in the package.
5. No stylesheet in `apps/galaxy` declares its own `:root` colours, and no page loads Google Fonts:
   the four font roles are served from the arcade's own origin.
6. The logo is the 16-bit crest in `full`, `lockup` and `mark`, each with a one-colour variant,
   in the system's colours only; every O is the loop arrow, and the favicon is its own 16×16
   drawing of the `mark`.
7. OmniMan has `omni-point`, `omni-cheer` and `omni-run` on the 32×48 body, recolourable like any
   hero, and any sprite renders at poster scale up to 16× on the pixel grid.
8. Signed out, in demo mode, closed and in the single-file artifact, the boot reads "OMNI LOOP
   presents" and the boot and title draw the Omni Loop logo; the page title and `themeColor` come
   from `OMNI_LOOP`.
9. A member of the Vertuoza workspace sees the V on the deck, pixel for pixel as before.
10. `/design` opens without signing in and shows every logo form, every colour with its hex, every
    type-scale step, every sprite and pose, and every icon.
11. `pnpm galaxy:shots` before and after shows every other scene unchanged; the comparison is in
    the feature PR.
12. `pnpm test` and the galaxy's `typecheck` and `build` pass.
