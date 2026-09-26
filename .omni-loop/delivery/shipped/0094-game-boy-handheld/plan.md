# A Game Boy on phones, the screen alone on desktop — plan

**PRD:** #94 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/game-boy-handheld` →
`main` (`Closes #94`) · **Sub-PRs:** `feat/game-boy-handheld--<slice>` → the feature branch (`Part of #94`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

s3 is the tracer: a phone gets the Game Boy upright and the Advance body sideways, and a computer gets
the screen alone, with every scene still drawn on the wide grid and letterboxed inside the lens. It
wires every seam the scene slices fill, so that wave 3 builds the tall layouts side by side, one scene
group each. Before it, s2 splits today's three big scene files (`scenes.ts`, `screens.tsx`,
`join-screens.tsx`) and `arcade.css` into one module per scene group, with no change a player can see,
and s1 gives every slice the screenshot script it proves itself with.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `pnpm galaxy:shots`: Playwright opens the demo galaxy at 393×700 upright touch, 852×393 sideways touch and 1440×900 with a mouse, walks every scene from the keyboard, saves a screenshot of each, and reports any text in the screen below 8 CSS px at 393×700 | `apps/galaxy/scripts/shots` `apps/galaxy/package.json` `apps/galaxy/.gitignore` `apps/galaxy/README.md` `package.json` `pnpm-lock.yaml` | — | 1 |
| s2 | One module per scene group, with no change a player can see: the canvas drawing, the text layer and the styles of attract (`boot`, `title`, `heroes`), join (`coin`, `away`, `outsider`, `gate`, `intro`, `link`, `ready`, `welcome`), recruit (`select`, `name`, `hero`), menu (`menu`, `briefing`), map, planet and fleets move to `src/arcade/scenes/<group>.*`, the shared helpers to `scenes/common.*` and the dispatcher to `scenes/index.ts`; the Next build and the single-file artifact both carry every group's styles | `apps/galaxy/src/arcade/scenes` `apps/galaxy/src/arcade/screens.tsx` `apps/galaxy/src/arcade/join-screens.tsx` `apps/galaxy/src/arcade/arcade.css` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/app/layout.tsx` `apps/galaxy/artifact/` | — | 1 |
| s3 | The three forms, the two grids and the two bodies: `formFor()` picks `full`, `handheld` or `advance`; `gridFor()` gives every scene the wide grid, letterboxed in the lens, until its group lists it as tall; the screen alone fills the window on `full`; the Game Boy upright and the Advance body sideways, with the shared controls (touch-down, the D-pad rocker, hold to repeat, several fingers, the buzz, the grille's sound switch) and the page held still; the cabinet retired; page turning on `briefing` and `heroes` for a tall layout that declares pages | `apps/galaxy/src/arcade/form.` `apps/galaxy/src/arcade/grid.` `apps/galaxy/src/arcade/Screen.tsx` `apps/galaxy/src/arcade/Controls.tsx` `apps/galaxy/src/arcade/dpad.` `apps/galaxy/src/arcade/repeat.` `apps/galaxy/src/arcade/Handheld.tsx` `apps/galaxy/src/arcade/Advance.tsx` `apps/galaxy/src/arcade/shell.css` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/arcade.css` `apps/galaxy/src/arcade/scenes/` `apps/galaxy/app/layout.tsx` | s1, s2 | 2 |
| s4 | Fullscreen on the first press of each page load, never forced back: the Esc that leaves it is never also B, F toggles it except on the name screen, a refused request is ignored, and a new page load asks again | `apps/galaxy/src/arcade/fullscreen.` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s3 | 3 |
| s5 | The attract group on the tall grid: `boot`, the title's three phases (title, story, high scores) and the Hall of Heroes, split into pages ◀ ▶ turn when the table does not fit | `apps/galaxy/src/arcade/scenes/attract.` | s3 | 3 |
| s6 | The join group on the tall grid: `coin` (demo, closed and error lines included), `away`, `outsider`, `gate`, `intro`, `link` (idle, away, done and error), `ready` and `welcome` | `apps/galaxy/src/arcade/scenes/join.` | s3 | 3 |
| s7 | The recruit group on the tall grid, and hints that name the buttons you have: `select` (the cards, the lock-in, the change-fleet confirmation), `name` (the ten slots and the wheel) and `hero` (the rows and the pedestal); on `handheld` and `advance` a hint reads START for ENTER, SELECT for TAB, B for ⌫, and drops TYPE OR | `apps/galaxy/src/arcade/scenes/recruit.` `apps/galaxy/src/arcade/keys.` `apps/galaxy/src/arcade/hint.tsx` | s3 | 3 |
| s8 | The menu group on the tall grid: the menu, short and long (a visitor's and a player's), and How to play, split into pages ◀ ▶ turn when the rules do not fit | `apps/galaxy/src/arcade/scenes/menu.` | s3 | 3 |
| s9 | The galaxy map on the tall grid: `layoutMap()` for 320×288 keeps every planet inside it and apart, the D-pad reaches every planet, and the sectors, the hyperlanes, the distress pulses and the planet's dialog all show | `apps/galaxy/src/arcade/scenes/map.` | s3 | 3 |
| s10 | The planet on the tall grid: the planet with its Entropy in orbit and its fleets on station, and all four tabs (status, zones, Entropy, log) | `apps/galaxy/src/arcade/scenes/planet.` | s3 | 3 |
| s11 | The fleets wall on the tall grid: every fleet with its season points, streak, planets and crew | `apps/galaxy/src/arcade/scenes/fleets.` | s3 | 3 |
| s12 | Done: every one of the 19 scenes is tall (the completeness test), `pnpm galaxy:shots` reports no text below 8 CSS px upright, and the arcade README describes the three forms and the controls, without the "Tiny type on phones held upright" limit | `apps/galaxy/src/arcade/grid.test.ts` `apps/galaxy/README.md` | s1, s4, s5, s6, s7, s8, s9, s10, s11 | 4 |

**Shared ground.**

- **`apps/galaxy/src/arcade/ArcadeApp.tsx`** belongs to s2 (wave 1: new import paths), s3 (wave 2: the
  forms, the bodies, the screen, the page seam, the cabinet removed) and s4 (wave 3: the Esc guard and
  F). No other wave-3 slice edits it. s3 moves everything a scene slice could need out of it:
  - the screen and its hit test go to `Screen.tsx`, in grid pixels;
  - the map's layout is computed by `layoutMap(view, grid)` in `scenes/map.ts`;
  - the form and the grid reach every text layer through context;
  - page turning is generic: a group declares how many pages its tall `briefing` or `heroes` takes,
    and s3's `act()` turns them with ◀ ▶.
- **`apps/galaxy/src/arcade/scenes`** is s2's whole territory (wave 1), and s3 owns `scenes/` again in
  wave 2 to add the grid seam:
  - `drawFrame` takes the grid;
  - each `scenes/<group>.ts` exports the scenes it has laid out on the tall grid, an empty list, and
    the page counts;
  - `grid.ts` reads those lists instead of keeping its own.
  
  In wave 3 each scene slice owns only its group's prefix (`scenes/attract.`, `scenes/join.`, …),
  which covers its canvas file, its text layer, its CSS and its tests. `scenes/common.*` and
  `scenes/index.ts` are s3's last. A wave-3 slice that needs a new helper adds it to its own file, and
  no wave-3 slice edits `common`, `index` or another group's files.
- **`apps/galaxy/src/arcade/arcade.css`** is s2's in wave 1 and s3's in wave 2. After s2 it keeps only
  what every group shares, and each group's styles live in `scenes/<group>.css`, imported by that
  group's own module.
- **`apps/galaxy/app/layout.tsx`** is s2's (the style imports) and s3's (the viewport). They are in
  different waves.
- **`apps/galaxy/README.md`** is s1's (how to run the shots) and s12's (the forms and the controls).
  They are in waves 1 and 4.
- **`apps/galaxy/src/arcade/grid.test.ts`** is s3's (the unit tests of `gridFor`) and s12's (the
  completeness test, once every group is tall). They are in waves 2 and 4.

**Across PRDs.** PRD 71 (ask mode) builds in `apps/galaxy` too, under `app/ask/`, `app/api/ask/`,
`src/ask/` and the auth callback. None of those is ground this plan touches. If it adds dependencies,
`pnpm-lock.yaml` and `apps/galaxy/package.json` meet s1's Playwright entry. Whichever PRD ships second
merges `main` into its feature branch and regenerates the lockfile with `pnpm install`, never by hand.

## Per slice: done when

- **s1:**
  - With `pnpm galaxy:dev` running, `pnpm galaxy:shots` saves a screenshot of each scene at 393×700
    touch, 852×393 touch and 1440×900 with a mouse into a gitignored folder. The title's three phases
    and the planet's four tabs are each their own screenshot, and the joining scenes are reached by
    walking the demo galaxy's flow from the keyboard.
  - For 393×700 it prints each text element inside the screen that renders below 8 CSS px, with its
    scene. On today's cabinet the list is long, and that is expected: the report does not fail the run.
  - Without a dev server it stops with a message naming `pnpm galaxy:dev`, and a non-zero exit.
  - The arcade README says how to run it, including installing Playwright's Chromium once.
  - `pnpm test` stays green: no test starts Playwright.
- **s2:**
  - Every scene looks the same before and after, at 1440×900 and at 393×700. The sub-PR attaches
    `pnpm galaxy:shots` screenshots from the feature branch before and from the slice after.
  - `screens.tsx`, `join-screens.tsx` and `scenes.ts` are gone.
  - Each of the seven groups has `scenes/<group>.ts` (canvas), `scenes/<group>.tsx` (text layer) and
    `scenes/<group>.css`. The dispatcher is `scenes/index.ts`, and the helpers two groups share are in
    `scenes/common.*`.
  - `pnpm galaxy:artifact` builds a single-file page whose every screen is styled, because it carries
    every group's CSS.
  - `pnpm test`, the arcade's `typecheck` and `pnpm galaxy:build` are green. No test changes but for
    its import paths.
- **s3:**
  - **Acceptance criterion 1, its layout:** with a mouse at 1440×900 the page shows only the screen,
    1440×810, centred, with no marquee, deck plate, side art, bezel or pad.
  - **Acceptance criteria 2 and 3:**
    - With touch at 393×700 the Game Boy shows, with the lens (its stripe label and LED), the
      wordmark, the D-pad, A, B, SELECT, START and the grille. At 852×393 the Advance body shows.
    - Every control is fully inside the viewport, at the sizes the spec gives.
    - Every scene is drawn on the wide grid, letterboxed inside the lens.
  - **Acceptance criterion 4:** rotating keeps the scene, the selection, the planet tab and the name
    being entered.
  - **Acceptance criteria 6, 7, 8, 10 and 11:**
    - Hold to repeat and the rocker work as the spec describes.
    - The grille switches sound off and on, and its LED follows, under `omni-loop:muted`.
    - On the Game Boy bodies nothing scrolls, zooms or selects text.
    - Every key still works.
  - **Unit tests** pin `formFor`, the D-pad direction, hold to repeat and `gridFor`, as the spec's
    **Test seams** table sets them out.
  - Taps still work: hints, menu rows, fleet cards, builder rows, planet tabs, and planets on the map.
    The map's hit test runs in grid pixels.
  - Each group module exports an empty list of tall scenes, and a declared page count turns pages with
    ◀ ▶ on `briefing` and `heroes`. No group declares any yet.
  - The sub-PR attaches `pnpm galaxy:shots` at the three sizes. `pnpm test`, `typecheck` and
    `pnpm galaxy:build` are green.
- **s4:**
  - **Acceptance criterion 1, fullscreen:**
    - The first key press or click of a page load asks for fullscreen.
    - In fullscreen, Esc leaves it and the scene does not change.
    - The next key does not ask again, and F does.
  - On the name screen, F types an F.
  - On touch, the first press asks where the browser allows it, and a refused request leaves no error
    and no toast. That includes the single-file artifact inside an iframe.
  - A unit test pins the fullscreen rule, as the spec's **Test seams** table sets it out.
- **s5 to s11, for each group:**
  - With touch at 393×700, each of the group's scenes is drawn on the tall grid, and the group lists it
    as tall.
  - Each shows the same information as its wide layout: the sub-PR attaches the wide and the tall
    screenshots of every scene, side by side.
  - `pnpm galaxy:shots` reports no text below 8 CSS px in the group's scenes.
  - The wide layouts at 1440×900 and 852×393 are unchanged.
  - `pnpm test`, `typecheck` and `pnpm galaxy:build` are green.
- **s5 also:** the high-score phase of the title and the Hall of Heroes show every row they show today.
  When the tall table takes more than one page, ◀ ▶ turn them, and the page shows "PAGE n/N".
- **s6 also:** every state of `coin` and `link` is laid out: the demo and closed coin, the error line,
  and linking idle, away, done and error.
- **s7 also:**
  - **Acceptance criterion 9:** on `handheld` and `advance`, the name screen reads "B ERASE" and
    "START DONE", the hero builder reads "RANDOM (SELECT)", and no hint names ENTER, TAB, ESC, ⌫ or
    TYPE. On `full` the hints read as today.
  - A unit test pins the hint wording per form.
  - `keys.test.ts` passes unchanged.
- **s8 also:** both menus (a visitor's six items, a player's seven) fit or page. How to play shows
  every rule `game/rulebook.mjs` gives it. When it takes more than one page, ◀ ▶ turn them.
- **s9 also:** with the demo galaxy, a unit test holds that every planet of the tall layout sits inside
  320×288 with its radius, that no two overlap, and that `neighbour` reaches every planet from any
  planet.
- **s10 also:** all four tabs are laid out on the tall grid, and ◀ ▶ switch them as today.
- **s11 also:** every fleet the wide wall shows is reachable, with its points, streak, planets and crew.
- **s12:**
  - **Acceptance criterion 5:** at 393×700 with touch, `pnpm galaxy:shots` reports no text below 8 CSS
    px in any of the 19 scenes, and a test in `grid.test.ts` holds that every `SceneName` is listed as
    tall.
  - **Acceptance criterion 12:**
    - The arcade README describes the three forms and the controls, and no longer lists "Tiny type on
      phones held upright".
    - `pnpm test`, the arcade's `typecheck` and `pnpm galaxy:build` are green.
