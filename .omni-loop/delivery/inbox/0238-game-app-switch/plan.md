# Plan: Game and app switch

PRD #238, spec beside this plan (`spec.md`). The feature branch `feat/game-app-switch` merges into
`main` through the feature PR, whose body says `Closes #238`. Each slice is a sub-PR from
`feat/game-app-switch--<slice>` into the feature branch, whose body says `Part of #238`. Everything
is in `apps/galaxy`. No database, no kit, no contract.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The app has a home, and Game mode takes you back to the game. Covers: `/app` (its layout on the ask pages' reading surface, its header with `OMNI LOOP · App`, the theme switch and Game mode, and the four section cards); `src/switch/` (`SECTIONS`, the two home paths, `GameModeButton` with its *Switch to game mode?* dialog, and their styles); and the `#menu` deep link, so Switch lands on SELECT MODE past the boot and the title | `apps/galaxy/app/app/` `apps/galaxy/src/switch/` `apps/galaxy/src/arcade/deep-link` `apps/galaxy/src/arcade/ArcadeApp.tsx` | — | 1 |
| s2 | Every app page carries Game mode. Covers: Game mode as the last control of the `/ask` layout's header and of the `/knowledge` bar in every state, and the `OMNI LOOP` mark as a link to `/app` in both | `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/src/ask/page/AskBar` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/knowledge/KnowledgeScreen.tsx` `apps/galaxy/src/knowledge/knowledge.css` `apps/galaxy/src/knowledge/render.test.ts` `apps/galaxy/src/switch/headers.test.ts` | s1 | 2 |
| s3 | APP MODE leaves the game after OPEN THE APP?. Covers: the `app` prop through the page, `ArcadeClient` and `ArcadeApp` (absent in the artifact); the APP MODE row just above SIGN OUT; the confirm overlay on the wide and tall grids, with its decisions in `leave.ts` (A or START goes to `/app`, B restores the scene, Entropy Invaders pauses first); and the tall menu fitting 10 rows | `apps/galaxy/src/arcade/leave` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/ArcadeClient.tsx` `apps/galaxy/src/arcade/scenes/menu` `apps/galaxy/src/arcade/page.test.ts` `apps/galaxy/app/page.tsx` | s1 | 2 |
| s4 | The GAME ▮▯ APP switch on both Game Boy bodies. Covers: the slide switch at the right end of the upright body's wordmark row and under the sideways body's grille, in the body's theme tokens, pressed on touch-down, opening the same confirm with its knob on APP while it is open; no switch without the app; and the confirm and the bodies in `pnpm galaxy:shots` | `apps/galaxy/src/arcade/Handheld.tsx` `apps/galaxy/src/arcade/Advance.tsx` `apps/galaxy/src/arcade/Controls.tsx` `apps/galaxy/src/arcade/shell.css` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/bodies.test.ts` `apps/galaxy/scripts/shots.mjs` | s3 | 3 |
| s5 | The README tells it, and the app meets PRD 216 when `/prd` is on `main`. Covers: the galaxy README's lines (`/app`, Game mode, the switch, the APP MODE row, the confirm, `#menu`); when `apps/galaxy/app/prd/` is on `main`, a PRDs card first in `SECTIONS` and Game mode with the `/app` link in the `/prd` pages' header; and the manual acceptance, recorded with screenshots | `apps/galaxy/README.md` `apps/galaxy/src/switch/switch.ts` `apps/galaxy/src/switch/switch.test.ts` `apps/galaxy/app/prd/` `apps/galaxy/src/dossier/page/` | s2, s4 | 4 |

**Shared ground.** Three prefixes are declared by more than one slice, so those slices run in
different waves:

- `apps/galaxy/src/arcade/ArcadeApp.tsx` is declared by s1 (the `#menu` deep link), s3 (the `app`
  prop, the row and the confirm) and s4 (handing the bodies the switch), in waves 1, 2 and 3. s1
  moves the deep links into `src/arcade/deep-link.ts`, so later slices change `ArcadeApp.tsx` only
  to wire what they add.
- `apps/galaxy/src/switch/` is s1's. s2 adds `src/switch/headers.test.ts` in wave 2, and s5 edits
  `src/switch/switch.ts` and its test in wave 4, only when `/prd` is on `main`.
- `apps/galaxy/src/arcade/` is split by file between s1, s3 and s4. `leave*` is s3's alone, the
  bodies (`Handheld`, `Advance`, `Controls`, `shell.css`) are s4's alone, and name the new files
  exactly as their territory does (`deep-link.ts`, `leave.ts`, `leave.css`, `bodies.test.ts`).

Wave 2 runs s2 (the app's headers) and s3 (the arcade's row and confirm) together: their territories
do not meet.

The ordering has reasons behind it:
- s2 and s3 follow s1: the headers render s1's `GameModeButton`, and the arcade leaves for s1's
  `/app` through its home path.
- s4 follows s3: the switch opens s3's confirm.
- s5 follows s2 and s4: the README describes everything, and its manual acceptance covers every
  slice.

## Per slice: done when

**s1: the app has a home, and Game mode takes you back**
- `SECTIONS` holds Questions (`/ask`), For me (`/ask/for-me`), History (`/ask/history`) and
  Knowledge map (`/knowledge`) in that order, each with its title and line, and each path has its
  `app/<path>/page.tsx` on disk. The home paths are `/app` and `/#menu` (`src/switch/switch.test.ts`).
- `/app`, rendered statically, shows `OMNI LOOP · App`, the theme switch and Game mode in its header,
  its heading and line, and the four cards as links in order. It reads nothing: no Supabase, no
  cookie, no sign-in.
- `GameModeButton` renders a button named Game mode and a `<dialog>` with *Switch to game mode?*,
  *The arcade opens on its menu.*, Stay and Switch, where Switch leads to `/#menu` and has the focus.
  Stay, Esc and a click outside close it.
- `#menu` opens SELECT MODE, and the address at the menu reads `/#menu`. A signed-out `/#menu`
  shows INSERT COIN (`src/arcade/deep-link.test.ts`).
- `/app` reads in light, dark and system, and at 393 px wide it shows one column with no sideways
  scroll.
- `pnpm test` is green.

**s2: every app page carries Game mode**
- The `/ask` header (`AskBar`, rendered by `app/ask/layout.tsx`) ends with Game mode after the theme
  switch, and its `OMNI LOOP` mark links to `/app`. History and For me are unchanged.
- The `/knowledge` bar ends with Game mode after the theme switch in each of the page's states
  (closed, sign-in, crew-only, out of reach, the map, no knowledge yet), and its `OMNI LOOP` mark
  links to `/app`. "Open the star chart →" stays.
- `src/switch/headers.test.ts` and `src/knowledge/render.test.ts` pin both. `pnpm test` is green.

**s3: APP MODE leaves the game after OPEN THE APP?**
- With the app, `menuItems()` puts APP MODE, hinted *Leave the game for the app*, just above SIGN
  OUT, for a visitor and for a player. Without it, there is no such row (`scenes/menu.test.ts`).
- `leave.ts`: while the confirm is open, A and START go, B stays, and every other action does
  nothing. Opening it over Entropy Invaders in play pauses the game, and B returns to the pause.
  Over a paused or finished game, it opens as it is (`leave.test.ts`).
- The overlay shows OPEN THE APP?, *QUESTIONS AND KNOWLEDGE, AS PAGES*, [A] YES and [B] NO, on the
  wide and the tall grid, and its hints are buttons. On the name screen it takes the keys while
  open. A goes to `/app` in the same tab. B leaves the scene, its selection, page and tab as they
  were.
- The arcade page hands `app: '/app'` to the arcade in every mode, and the artifact's entry passes
  none (`page.test.ts`).
- A linked player's SELECT MODE (10 rows) fits the tall grid, every row and the footer on screen, at
  393×700.
- `pnpm test` is green.

**s4: the GAME ▮▯ APP switch on both bodies**
- With the app, `Handheld` shows the switch at the right end of the wordmark row and `Advance` under
  the grille on the right wing, each a button named "Switch to the app". Without it, neither shows
  one (`bodies.test.ts`).
- The switch fires on touch-down, buzzes like the pad, and opens s3's confirm on any scene, the boot
  included. Its knob shows APP while the confirm is open and GAME after B. It never appears in a key
  hint, and nothing else on either body moves.
- It is drawn only in theme tokens (`theme.test.ts` stays green), and a long season label is cut
  with an ellipsis before the switch leaves the body.
- `pnpm galaxy:shots` takes the confirm over the menu, and both bodies with the switch, at its three
  sizes.
- `pnpm test` is green.

**s5: the README, and the meeting with PRD 216**
- The galaxy README names `/app` beside `/ask`, `/knowledge` and `/design`, the switch on both bodies,
  the APP MODE row on Select mode, the confirm, and `#menu` among the deep links.
- If `apps/galaxy/app/prd/` is on `main` (merged into the feature branch first): `SECTIONS` starts
  with PRDs (`/prd`), its test says so, and the `/prd` pages' header ends with Game mode and links
  `OMNI LOOP` to `/app`. If it is not, the sub-PR says so, and changes neither.
- The manual acceptance, with screenshots in the sub-PR at 393×700, 852×393 and 1440×900: both
  bodies with the switch, the confirm on the menu and in Entropy Invaders, SELECT MODE at 10 rows on
  the tall grid, `/app` in light and dark, and the Game mode dialog on `/ask/history` and
  `/knowledge`.
- `pnpm test` is green.
