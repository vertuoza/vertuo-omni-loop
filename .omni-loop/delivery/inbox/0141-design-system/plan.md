# Omni Loop design system — plan

**PRD:** #141 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/design-system` →
`main` (`Closes #141`) · **Sub-PRs:** `feat/design-system--<slice>` → the feature branch
(`Part of #141`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**Built after #100.** This PRD is blocked by #100 (Workspaces), so every galaxy path below is the
layout #100 leaves behind: the house brand in `apps/galaxy/src/arcade/brand.ts`, the letter mark in
`mark.ts`, and the theme module (`apps/galaxy/src/arcade/theme.ts`) that #100's last slices add. If
#100 lands a path or a name differently, the slice follows the code, and the drift is an outbox item.

**The tracer is s1.** It renames `@omni/sprites` to `@omni/design` and moves every import, with no
change on screen. It also shapes the package for what follows:

- `src/index.mjs` re-exports each module with `export *`, and `index.d.ts` splits into one
  declaration file per module, so a slice that grows a module does not touch the index.

Wave 2 fills the package in two independent lanes:

- s2 moves every colour into `tokens`, generates `tokens.css`, and points the arcade, Ask and the
  theme module at it;
- s4 draws the three OmniMan poses and the poster scale.

Wave 3 adds the fonts (s3), which first proves that Next bundles a workspace package's woff2 before
moving the layouts. Wave 4 draws the 16-bit crest and makes Omni Loop the house brand (s5). Wave 5
shows it all on `/design` (s6), and closes with the guard test and the docs (s7).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `@omni/sprites` becomes `@omni/design` at `packages/design`, every import moved, one declaration file per module, nothing changes on screen | `packages/sprites/` `packages/design/` `apps/galaxy/src/` `apps/galaxy/next.config.mjs` `apps/galaxy/package.json` `pnpm-lock.yaml` `README.md` | — | 1 |
| s2 | One source of colour: the `tokens` module with the six new colours and Ask's light and dark tokens, a generated `tokens.css`, and the arcade, Ask and the theme module reading it | `packages/design/src/tokens` `packages/design/src/palette` `packages/design/tokens.css` `packages/design/src/index.` `packages/design/package.json` `apps/galaxy/src/arcade/arcade.css` `apps/galaxy/src/arcade/theme` `apps/galaxy/src/ask/theme-tokens` | s1 | 2 |
| s4 | OmniMan points, cheers and runs: `omni-point`, `omni-cheer`, `omni-run` on the 32×48 body, recolourable, and any sprite drawn at poster scale up to 16× | `packages/design/src/sprites` `packages/design/src/draw` `packages/design/src/heroes` | s1 | 2 |
| s3 | The four font roles served from the package: woff2 files, `fonts.css` and the type scale; both layouts drop Google Fonts; the artifact inlines the pixel faces | `packages/design/fonts/` `packages/design/fonts.css` `packages/design/src/fonts` `packages/design/src/index.` `packages/design/package.json` `apps/galaxy/app/layout.tsx` `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/artifact/` `apps/galaxy/next.config.mjs` | s1 | 3 |
| s5 | The 16-bit crest and the Omni Loop house brand: the `logo` and `brand` modules, and the boot, the title, the favicon, the page title and `themeColor` under `OMNI_LOOP` | `packages/design/src/logo` `packages/design/src/brand` `packages/design/src/index.` `packages/design/package.json` `apps/galaxy/src/arcade/brand` `apps/galaxy/src/arcade/scenes/attract` `apps/galaxy/app/layout.tsx` `apps/galaxy/app/icon` | s2 | 4 |
| s6 | A public `/design` page, rendered from the package: every logo form, colour, type step, sprite, pose and icon | `apps/galaxy/app/design/` `apps/galaxy/src/design/` | s3, s4, s5 | 5 |
| s7 | The guard and the docs: a test that no copy of the look creeps back into the galaxy, the package's README with the brand rules, and the READMEs that name the old package | `apps/galaxy/src/design-system.test.ts` `packages/design/README.md` `apps/galaxy/README.md` `README.md` | s2, s3, s5 | 5 |

**Shared ground.**

- `packages/design/src/index.` and `packages/design/package.json`: s1, s2, s3 and s5 each add
  their module's export there. They sit in waves 1, 2, 3 and 4, one each.
- `apps/galaxy/app/layout.tsx`: s3 swaps its font links, s5 its title, `themeColor` and icon.
  Waves 3 and 4.
- `apps/galaxy/next.config.mjs`: s1 renames the transpiled package, s3 may add what bundling the
  fonts needs. Waves 1 and 3.
- `apps/galaxy/src/` belongs to s1 whole, for the import rename; every later galaxy path sits
  inside it, in waves 2 to 5.
- `packages/design/` belongs to s1 whole, since it moves the package there; every later package
  path sits inside it, in waves 2 to 5.
- `README.md`: s1 renames the package in the layout table, s7 describes it. Waves 1 and 5.

## Per slice: done when

**s1: the rename.**

- `packages/sprites` no longer exists; `packages/design/package.json` names `@omni/design`, and
  nothing in the repository imports `@omni/sprites` (a grep over `apps/`, `packages/` and `game/`
  finds none).
- `src/index.mjs` re-exports each module with `export *`, and `index.d.ts` re-exports one
  declaration file per module.
- The package has no `react`, `react-dom` or `next` dependency.
- `pnpm test`, the galaxy's `typecheck` and `build` pass, and `pnpm galaxy:shots` shows every scene
  as before.

**s2: one source of colour.**

- `INK` holds `highlight #fff3a8`, `ember #d9531a`, `magenta #ff3ea5`, `orange #ff9b30`,
  `adPurple #5b1a86` and `starfield #05040f`, and every existing value is unchanged.
- The committed `tokens.css` equals the generator's output; changing a JS value without
  regenerating fails `pnpm test`.
- Ask's text and ground pairs pass WCAG AA in light and dark, tested in the package; the test in
  `ask/theme-tokens.test.ts` has moved there.
- `arcade.css` declares no colour on `:root` and imports `@omni/design/tokens.css`; the theme
  module's defaults equal the package's values, and a workspace override still wins.
- Every scene looks as before in `pnpm galaxy:shots`.

**s4: the OmniMan poses.**

- `SPRITE_DEFS` has `omni-point`, `omni-cheer` and `omni-run` (two frames); each is 32×48 and uses
  only palette colours.
- Each pose recolours through `heroes.mjs` like the idle body: a hero's skin, hair, suit and cape
  apply to it.
- A poster-scale render of any sprite at scale *k* (1 to 16) is exactly *k* times its size, with
  every pixel a *k*×*k* block.

**s3: the fonts.**

- The first commit proves that the galaxy's build serves one woff2 from `@omni/design/fonts.css`;
  the rest follows only once it does.
- `fonts.css` declares Anton, Press Start 2P, Jersey 10, Atkinson Hyperlegible Next and JetBrains
  Mono from files in the package; every declared face has its file.
- The type scale names each step as a role, a size, a line height and a slant, and every role names
  a declared face.
- No file under `apps/galaxy/app` links `fonts.googleapis.com`; the arcade and Ask render in the
  same faces as before.
- `pnpm galaxy:artifact` inlines the two pixel faces, and the display and body roles fall back to
  system faces there.

**s5: the crest and the house brand.**

- The `logo` module draws the 16-bit crest as the spec describes: a loop-arrow O, the 5×7 pixel
  face at 2×, the 4-tone ramp lit from the top left, a `navy-dark` outline and a two-pixel
  `plasma-dark` shadow.
- It exports `full`, `lockup` and `mark`, each with a one-colour variant, as pixels, as a crisp
  SVG at any whole-number scale, and as a canvas drawing; the favicon is its own 16×16 drawing.
- `logo.test.mjs` proves it: `INK` colours only, no stray pixel, SVG size *k* times the pixels
  with `crispEdges`, and a favicon gap and arrowhead of at least one pixel.
- `OMNI_LOOP` is the house brand. Signed out, in demo mode, closed and in the artifact, the boot
  reads "OMNI LOOP PRESENTS", and the boot and the title draw the crest.
- The favicon is the crest's mark, and the page title and `themeColor` come from `OMNI_LOOP`.
- A member of the Vertuoza workspace still sees the V, pixel for pixel.

**s6: `/design`.**

- `/design` opens without signing in, outside the arcade.
- It shows every logo form on dark and light grounds at several whole-number scales, every `INK`
  colour with its name and hex, every type-scale step, every sprite in every frame, the heroes in
  every fleet's colours, the three poses at poster scale, and every icon.
- A render test of its component finds each of those by name.
- It reads well on a phone (393 px wide) and on a desktop, recorded as screenshots in the sub-PR.

**s7: the guard and the docs.**

- `design-system.test.ts` fails when a stylesheet under `apps/galaxy` declares a colour on `:root`,
  when a file under `apps/galaxy/app` links `fonts.googleapis.com`, or when any file imports
  `@omni/sprites`.
- `packages/design/README.md` says what each module exports, and the brand rules: which logo form
  on which ground, whole-number scales only, the favicon's own drawing, and the minimum sizes.
- `apps/galaxy/README.md` and the root `README.md` name `@omni/design` wherever they named the old
  package, the fonts or the boot's "VERTUOZA presents".
- The feature PR carries the `pnpm galaxy:shots` comparison: every scene unchanged but the boot and
  the title.
