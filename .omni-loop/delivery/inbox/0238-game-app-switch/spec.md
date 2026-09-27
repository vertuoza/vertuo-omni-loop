---
prd: 238
title: Game and app switch — one tap between the arcade and the app
blocked-by: none
spec: file
---

# Game and app switch: one tap between the arcade and the app

**Date:** 2026-09-27 · **PRD:** #238 · **Touches:** `apps/galaxy` only (a new `/app` page, a new
`src/switch/` module, the arcade's bodies, menu and deep links, the `/ask` and `/knowledge` headers,
the README). No database, no kit, no contract.

## Problem

Omni Loop has two sides, and nothing joins them.

- **The fun side** is the arcade at `/`: the galaxy, the fleets, the game room, played on a Game Boy
  on a phone or on the screen alone on a computer.
- **The professional side** is a set of plain reading pages: `/ask` (your questions), `/ask/for-me`,
  `/ask/history` and `/knowledge`, and soon `/prd` (PRD 216).

Today you cross from one to the other by typing an address. The arcade never names a page, apart
from the star chart's footer (`READ IT AT /KNOWLEDGE`). The pages have no home: each draws its own
header, and none of them links back to the game, except `/knowledge`'s "Open the star chart →". A PM
who wants the questions leaves the game by hand, and a player who reads a spec has no way back to
the game.

## Solution

One tap either way, with an "Are you sure?" before each crossing, and a home page on each side.

```
the arcade (/)                                            the app (/app, /ask/*, /knowledge)
  GAME ▮▯ APP switch on the Game Boy ─┐                ┌─ Game mode, top right of every page
  APP MODE row on SELECT MODE ────────┤                │
                                      ▼                ▼
                            OPEN THE APP?        Switch to game mode?
                            A YES · B NO         [Stay]  [Switch]
                                      │                │
                                      ▼                ▼
                                    /app            /#menu  (SELECT MODE, past the boot and title)
```

### The app's home: `/app`

A new page, on the ask pages' reading surface: their tokens as CSS custom properties, their faces
from `@omni/design/fonts.css`, their theme script first, and light, dark and system themes.

- **It reads nothing and needs no sign-in.** It is a list of links. Each page it links to signs the
  visitor in on its own, as it does today. `robots: noindex`.
- **The header** is the app bar (below): `OMNI LOOP` with the sub-title `App`, the theme switch, and
  **Game mode**.
- **The body** is a heading, `Omni Loop`, one line (*"The loop's questions and knowledge, as pages.
  The game is one tap away."*), and one card per section, in this order:

  | card | opens | line |
  |---|---|---|
  | **Questions** | `/ask` | The questions Claude is asking you now |
  | **For me** | `/ask/for-me` | Questions a teammate shared with you |
  | **History** | `/ask/history` | Every question your workspace was asked |
  | **Knowledge map** | `/knowledge` | Principles, rules and invariants, as a map |

- The cards come from one list, `SECTIONS` in `src/switch/switch.ts`, so a new section (PRD 216's
  PRDs) is one entry. Two columns wide, one on a phone, and never a sideways scroll.

### The app bar: Game mode, top right

Every page of the app carries **Game mode** as the last control of its header, at the top right:

- `/app` (its own header);
- every `/ask/*` page (the `ask-bar` in `app/ask/layout.tsx`, after the theme switch);
- `/knowledge`, in every state (the `KnowledgeBar` in `src/knowledge/KnowledgeScreen.tsx`, after the
  theme switch).

In each of those headers, the `OMNI LOOP` mark becomes a link to `/app`. Nothing else in them moves.

- **Game mode** is a button with a small gamepad glyph and the words `Game mode`. On a phone it keeps
  both.
- **Pressing it opens a dialog** (`<dialog>`, modal): the title *"Switch to game mode?"*, the line
  *"The arcade opens on its menu."*, and two buttons, **Stay** and **Switch**. Switch has the focus
  as it opens.
- **Switch** goes to `/#menu`, in the same tab. **Stay**, Esc, or a click outside the dialog closes
  it, and the page is as it was.
- The button, the dialog and their styles live in `src/switch/` (`GameModeButton.tsx`,
  `switch.css`), drawn with the ask pages' tokens, in both themes.

### In the arcade: two ways out, one confirm

**The APP MODE row.** SELECT MODE gets a row `APP MODE`, with the hint *"Leave the game for the app"*,
just above SIGN OUT, for everyone who reaches the menu. It is the one way out on a computer, where
the screen has no body around it.

**The GAME ▮▯ APP switch.** Both Game Boy bodies get a small slide switch, in the body's colours
(theme tokens only, as `shell.css` requires), a nod to the handheld's power switch:

- **Upright** (`handheld`): at the right end of the wordmark row, beside `OMNI LOOP · SEASON n`.
  The wordmark keeps its place, and nothing else on the body moves.
- **Sideways** (`advance`): under the speaker grille, on the right wing.
- Its knob rests on GAME. It is a button (`aria-label="Switch to the app"`), so a screen reader and a
  keyboard can press it. It fires on touch-down and buzzes like the pad's controls, but it is not a
  pad action: the game never reads it, and it never appears in a key hint.
- It works on every scene, from the boot on.

**The confirm.** The row and the switch open the same overlay on the screen, on whatever scene is
showing:

```
        OPEN THE APP?
   QUESTIONS AND KNOWLEDGE, AS PAGES
     [A] YES        [B] NO
```

- **A** (or START) goes to `/app`, in the same tab. **B** closes the overlay, and the scene is
  exactly as it was: its selection, its page, its tab. Nothing else is read while it is open.
- While it is open, the switch's knob shows APP; it goes back to GAME when the overlay closes.
- **In Entropy Invaders**, the game pauses first. B goes back to the pause, never to play.
- On the name screen, where letters type, the overlay takes the keys while it is open: A, Z, Space,
  K and Enter say yes; B, X, Esc, J and Backspace say no.
- It is an overlay, not a scene: the 24 scenes and their grids are unchanged. It is laid out on the
  wide grid and on the tall one, and its hints are buttons a tap presses, as every key hint is.
- The decisions are a small pure module, `src/arcade/leave.ts`: what each action does while the
  overlay is open (`go`, `stay`, or nothing), and whether a game must be paused first.

**Back in the arcade.** `#menu` joins the deep links (`#map`, `#chart`, …). `/#menu` opens SELECT MODE
at once, past the boot and the title, as any deep link does. Signed out, it lands on INSERT COIN,
through the one door every deep link goes through. Because the arcade writes the hash of the scene it
is on, the menu's address now reads `/#menu`.

**Where there is no app.** The single-file artifact has no server, so it has no `/app`. The arcade
takes the app's path as a prop (`app`, `/app` from `ArcadeClient`, absent in the artifact). Without
it, neither the switch nor the APP MODE row appears, and the menu is as it is today.

### Arriving with PRD 216

PRD 216 (dossiers) is being built on `feat/prd-dossiers`, and adds `/prd` and `/prd/<id>`. The two
PRDs meet in two places. **Whichever PRD merges into `main` second adds them**, in its own feature
branch, after it merges `main` in:

- a **PRDs** card on `/app`, first in `SECTIONS`, opening `/prd`;
- **Game mode**, and the `OMNI LOOP` mark as a link to `/app`, in the `/prd` pages' header.

When this PRD finishes its feature branch, it checks `main` for `apps/galaxy/app/prd/`. If it is
there, the last slice adds both. If not, this PRD adds nothing for `/prd`.

## Decisions

1. **A new, static `/app` is the app's home.** It reads nothing, so it needs no sign-in, no data layer
   and no failure states. The pages it links to keep their own sign-in.
2. **Both crossings ask first.** Leaving the game drops whatever is on screen, and leaving a page
   drops a half-read one: one question costs one tap.
3. **The game side lands on SELECT MODE, the app side on `/app`.** There is no "where you left it",
   and no page chosen from the scene (a planet's dossier, say): each side has one home. The browser's
   Back button still returns where you were.
4. **Same tab.** The switch swaps sides, so it never opens a second window. The browser leaves
   fullscreen as the page changes.
5. **The switch on the body is a slide switch, not a pill.** SELECT and START are pad actions the game
   reads; the switch leaves the game, so it looks like the body's hardware, not a button of the pad.
6. **The APP MODE row goes just above SIGN OUT:** both leave the game, so they sit together at the
   bottom.
7. **The confirm is an overlay, not a scene.** A scene needs a wide and a tall layout and a place in
   the walk; an overlay keeps the scene under it untouched, which is what B must restore.
8. **`/design` stays as it is.** It is the design system's reference, on the arcade's dark ground,
   and not one of the app's pages.
9. **The words:** `APP MODE` and `GAME ▮▯ APP` in the arcade, `Game mode` in the app, and the confirm
   lines above. The app's words live in `src/switch/switch.ts`, and the arcade's in its own files
   (`leave.ts`, the menu).

## User stories

- As a PM on my phone, playing the arcade upright, I slide GAME ▮▯ APP, answer A to OPEN THE APP?,
  and land on `/app`, where I open Questions.
- As an engineer at my desk, I pick APP MODE on SELECT MODE, press A, and read the knowledge map.
- As a player in the middle of Entropy Invaders, I brush the switch by mistake: the game pauses, I
  press B, and I am back on the pause with my score intact.
- As anyone on `/ask/history`, I press Game mode at the top right, press Switch, and the arcade opens
  on SELECT MODE with no boot or title to sit through.
- As a teammate who opened a shared question (`/ask/q/<round>`), I press Game mode by mistake, press
  Stay, and the question is still on screen.

## Scope

**In:**
- `/app`, with its layout, its header and the four section cards.
- `src/switch/`: `SECTIONS`, the two home paths, `GameModeButton` with its dialog, and their styles.
- Game mode in the `/ask` layout's header and the `/knowledge` bar, and the `OMNI LOOP` mark as a
  link to `/app` in both.
- The APP MODE row, the GAME ▮▯ APP switch on both bodies, the confirm overlay and `leave.ts`.
- The `#menu` deep link.
- The `app` prop through `ArcadeClient` and `ArcadeApp`, absent in the artifact.
- The confirm in `pnpm galaxy:shots` (on the menu, at the three sizes).
- The galaxy README: the new page, the switch, the row, the confirm and the deep link.
- PRD 216's two meeting points, only when `/prd` is on `main` as this PRD finishes.

**Out:**
- Remembering the last side, or sending `/` to the app.
- A landing chosen from the scene (a planet's dossier, the knowledge map from the star chart).
- A keyboard key for the switch: the row is the way on a computer.
- Counts or any data on `/app` (such as For me's waiting count).
- `/design`, and the single-file artifact.
- The kit, the database, and every API route.

## Test seams

No test calls Supabase, GitHub or the network (`omni kb show testing`). Every test here is a unit or
static-render test beside the code, as `*.test.ts` under `apps/galaxy/src/`.

- **`src/switch/switch.test.ts`:** `SECTIONS` holds the four sections in order, each with a title,
  a line and a path. Each path has its page on disk (`app/<path>/page.tsx`), so a renamed route fails
  here. The two home paths are `/app` and `/#menu`.
- **`src/switch/render.test.ts`** (`renderToStaticMarkup`, as `src/ask/page/render.test.ts`):
  - `/app`'s body lists the four cards as links, in order.
  - `GameModeButton` renders a button named `Game mode`, and a dialog with *Switch to game mode?*,
    **Stay** and **Switch**, where Switch leads to `/#menu`.
  - The `/ask` header and the `/knowledge` bar, in each of `/knowledge`'s states, end with Game
    mode, and their `OMNI LOOP` mark links to `/app`.
- **`src/arcade/leave.test.ts`:** while the overlay is open, A and START go, B stays, and every other
  action does nothing. Opening it over Entropy Invaders in play pauses the game, and B returns to the
  pause. Over a paused or finished game, it opens as it is.
- **`src/arcade/scenes/menu.test.ts`:** with the app, `menuItems()` puts APP MODE just above SIGN
  OUT, for a visitor and for a player. Without the app, there is no such row. `MenuOverlay` renders
  its hint.
- **The bodies** (a static render of `Handheld` and `Advance`): with `onApp`, the switch is there,
  named "Switch to the app". Without it, there is no switch.
- **The deep link:** `#menu` opens SELECT MODE, and the address at the menu reads `/#menu`. Signed
  out, `/#menu` shows INSERT COIN.
- **`page.test.ts`:** the arcade page hands `app: '/app'` to the arcade in every mode. The artifact's
  entry passes none.
- **By hand, with screenshots in the last slice's sub-PR** (`pnpm galaxy:shots` and the app pages at
  393×700, 852×393 and 1440×900): both bodies with the switch, the confirm on the menu, SELECT MODE
  at its longest (10 rows, a linked player) on the tall grid, `/app` in both themes, and the Game
  mode dialog.

## Risks

- **What merging publishes** (`omni kb show releasing`): the galaxy's pages and arcade, through its
  Vercel project. No migration, no kit, no workflow.
- **Rollback:** a revert of the feature PR. Nothing is stored, so nothing needs cleaning up.
- **SELECT MODE on the tall grid is the tightest fit.** A linked player's menu grows from 9 rows to
  10, about 230 of the tall grid's 288 px. The last slice's screenshot at 393×700 must show all 10
  rows with none clipped, and the footer on screen. If it does not fit, tighten the tall menu's rows
  (their padding, or the footer on one line). Never page the menu or drop a hint.
- **The upright body's wordmark row is short.** A long season label (`SEASON 2026-09`) and the switch
  share it. The wordmark is cut with an ellipsis before the switch is ever pushed off the body.
- **PRD 216 is being built at the same time.** The two PRDs meet on `/app`'s cards and the `/prd`
  pages' header. The rule above (the second to merge adds them) settles it, and neither PRD edits a
  file of the other's before then.
- **`/#menu` changes the menu's address.** A bookmark of `/` still starts at the boot, and a
  reload at the menu now stays on the menu.

## Acceptance criteria

No acceptance harness in this repository (`acceptance.enabled` is false). Each criterion becomes an
ordinary test, or a manual step recorded with screenshots in the last slice's sub-PR.

1. On a phone held upright, the Game Boy shows GAME ▮▯ APP at the right end of the wordmark row;
   held sideways, under the grille on the right wing. Nothing else on either body moves.
2. On a computer, SELECT MODE shows APP MODE, with its hint, just above SIGN OUT. The same holds on
   both bodies.
3. Pressing the switch, or picking APP MODE, shows OPEN THE APP? with A YES and B NO over the current
   scene. A (or START) opens `/app` in the same tab. B closes it and leaves the scene as it was.
4. In Entropy Invaders, the switch pauses the game before the confirm shows. B returns to the pause.
5. In the single-file artifact, there is no switch and no APP MODE row.
6. `/app` shows the header (OMNI LOOP · App, the theme switch, Game mode) and the four cards, which
   open `/ask`, `/ask/for-me`, `/ask/history` and `/knowledge`. It needs no sign-in, and it reads
   well on a phone, in light and dark.
7. Every `/ask/*` page and `/knowledge`, in every state, shows Game mode as the last control at the
   top right of its header, and its `OMNI LOOP` mark links to `/app`.
8. Game mode opens *Switch to game mode?* with Stay and Switch. Switch opens the arcade on SELECT MODE,
   past the boot and the title. Stay, Esc or a click outside closes it, and the page is unchanged.
9. `/#menu` opens SELECT MODE directly for a signed-in person, and INSERT COIN for anyone signed out.
10. SELECT MODE at its longest (10 rows) fits the tall grid at 393×700, with every row and the footer
    on screen.
11. If `apps/galaxy/app/prd/` is on `main` when this PRD finishes, `/app` also has a PRDs card, first,
    opening `/prd`, and the `/prd` pages carry Game mode and the `/app` link.
12. `pnpm test` is green.
