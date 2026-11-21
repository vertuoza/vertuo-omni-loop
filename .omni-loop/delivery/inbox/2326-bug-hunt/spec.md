---
prd: 2326
title: BUG HUNT, a first-person bug shooter unlocked at LV 6
blocked-by: none
spec: file
phase0: server
---

# BUG HUNT, a first-person bug shooter unlocked at LV 6

**Date:** 2026-10-21 · **PRD:** #2326
**Touches:**
- `game/rulebook.ts` (`xp.unlocks` gets `hunt: 6`)
- `apps/galaxy/src/arcade/games/index.ts` (the sixth `GAMES` row)
- `apps/galaxy/src/arcade/scenes/common.ts` (the `hunt` scene name and its `FrameState` field),
  `apps/galaxy/src/arcade/scenes/index.ts` (the new group and its case)
- `apps/galaxy/src/arcade/scenes/hunt.ts`, `hunt.tsx` and `hunt.css` (new: the scene group, the
  canvas hand-off and the text layer)
- `apps/galaxy/src/arcade/hunt/` (new: the map, the raycaster, the sprites, the rules, the match, the
  art, the loader)
- `apps/galaxy/src/arcade/ArcadeApp.tsx` (the scene's loading, frame loop, presses, pauses and
  score; `hunt` in `HELD_SCENES`)
- `apps/galaxy/src/arcade/onboarding.ts` (`hunt` in `SIGNED_IN_ONLY`)
- `apps/galaxy/README.md` (The game room: the sixth game)
- `.omni-loop/knowledge/design/screens/` (the draft `hunt-match`; `game-room`'s Source)

## Problem

The arcade's game room stands five cabinets: ENTROPY INVADERS from LV 1, STARHOP from LV 2, OMNI KART
from LV 3, OMNI DUET from LV 4 and PULSAR VOLLEY from LV 5. A player who reaches LV 6 gets nothing new
to play.

Four of the five games look at the action from the side or from above, or from behind a kart. None
puts the player inside the world. A colleague asked for a small first-person shooter, with Vertuoza
for its theme: the people who read this arcade spend their days with bugs, and a game where they walk
through the codebase and shoot them is a joke they all get.

STARHOP taught that dying must never earn a point (PRD 1633's Problem): a new game keeps that rule.
The last two games were renamed so that no title echoes a trademarked game: this one does not echo
one either.

## Solution

**BUG HUNT** is a first-person shooter in a maze, unlocked at LV 6, played from the game room's sixth
cabinet with the pad: the player walks a maze made of a codebase's modules and shoots waves of bugs
until the third life is lost.

### Unlock and the room

- The rulebook's `xp.unlocks` becomes `{ invaders: 1, platformer: 2, kart: 3, duet: 4, pong: 5, hunt: 6 }`.
  `GAMES` gets a sixth row: `{ id: 'hunt', title: 'BUG HUNT', scene: 'hunt', measure: 'points' }`.
- The room's wide grid already shows a window of three cabinets that scrolls by one (`roomWindow` in
  `games/room.ts`): cabinets 4–6 show with the cursor on the sixth. The tall grid already shows one
  cabinet a page. Nothing in the room's code changes.
- Below LV 6 the sixth cabinet shows `REACH LV 6 TO PLAY`. From LV 6 it shows the room's standard lit
  cabinet (crew top 5, `A · PLAY`).
- `hunt` joins `SIGNED_IN_ONLY`: a visitor lands on INSERT COIN, as for OMNI DUET and PULSAR VOLLEY.
- The game's code sits in `apps/galaxy/src/arcade/hunt/`, imported only when the cabinet opens
  (`LOADING…` meanwhile; a failed import reads `GAME DID NOT LOAD · A TO RETRY`, B back to the room),
  as PULSAR VOLLEY's. It adds no dependency.

### The maze

- One map, hand-written in `hunt/map.ts`: a 24×24 grid of cells, each a floor or a wall. The player
  starts at its centre, facing north.
- The walls are the maze's modules. Each wall cell belongs to one of four zones (`CORE`, `API`, `UI`,
  `DB`), told apart by a texture and a theme colour; no zone is named on screen after a real product,
  repository or person.
- Bugs appear at eight spawn cells at the ends of the corridors, out of the player's sight.

### The hunt

- A **wave** is a set of bugs that all appear when it starts. Wave 1 has 4 bugs and each wave adds 2.
  When the last bug of a wave dies, `WAVE n CLEARED` shows for two seconds, the wave bonus (25 × n
  points) is added, and wave n+1 starts.
- Three kinds of bugs, each drawn in its own sprite:
  - `GNAT`: small and fast, one hit, 10 points. From wave 1.
  - `BEETLE`: medium, three hits, 30 points. From wave 2.
  - `SPITTER`: slow and heavy, six hits, 60 points, and it spits a slow ball at the player from a
    distance. From wave 4.
- A bug walks toward the player along the shortest path through the maze, recomputed every quarter of a
  second. A `GNAT` or a `BEETLE` that touches the player costs one life; a `SPITTER`'s ball that hits
  the player costs one life.
- The player has **three lives** (`♥♥♥`). After losing one, the player is untouchable for 1.5 seconds
  and the screen flashes. The match ends when the third life is lost.
- The player has one gun, with unlimited ammo and a delay of a third of a second between shots. A shot
  hits the first bug on the line of sight, if no wall is nearer. A hit bug flashes and, at its last hit,
  dies.
- **The score is the points of the bugs killed plus the wave bonuses.** A life lost never adds to it.

### The controls

- ▲ walks forward and ▼ backward; ◀ ▶ turn. B held turns ◀ ▶ into steps to the side. A fires, and held
  it fires again at each delay. START pauses and SELECT quits from the pause.
- The keyboard's keys are the pad's (`keys.ts`); on the Game Boy bodies the pad's buttons are the keys,
  with several fingers at once through the held channel (`HELD_SCENES`).
- The player slides along a wall instead of stopping against it, and never enters a wall cell.

### The view

- The maze is drawn in perspective by a **raycaster**: for each column of the view, a ray runs from the
  player over the grid to the first wall it meets, and the column's height is the inverse of that
  distance. A wall is shaded by its distance, and a wall facing one way is darker than one facing the
  other.
- The view is drawn at **320×180 on the wide grid and 160×144 on the tall grid**, enlarged 2× without
  smoothing to the grid's 640×360 and 320×288. The ceiling and the floor are two flat theme colours.
- Bugs and the spitters' balls are flat sprites, drawn from the farthest to the nearest, each scaled by
  its distance and cut by the walls in front of it, in the theme's stripes through `@omni/design`'s
  `drawSprite`. A colour that is a theme token is read from the frame's theme, never written in the
  game.
- The HUD is on the text layer: `SCORE n` at the left, `WAVE n` in the middle, the lives at the right,
  and a crosshair at the centre of the view.
- With `prefers-reduced-motion`, the game plays as it does without it and only drops the screen's
  shake and flash.

### The match, the pause and the score

- The match is pure and seeded: the same seed and the same presses give the same match, stepped at
  1/60 s or at 1/120 s. The seed picks the order of the spawn cells and a bug's small delay before it
  sets off.
- START pauses and only START resumes; a blurred window, a hidden tab or leaving the scene pauses too.
  The pause reads `PAUSED`, `START · RESUME`, `SELECT · QUIT`.
- The score is sent once, through `submitScore('hunt', points)`, on the move into `over`, whichever
  route led there (the third life lost, or SELECT · QUIT on the pause screen).
- The game over screen reads `GAME OVER`, the score, then the saving states the other games show:
  `SAVING…`, `NEW BEST`, the best, or `SCORE NOT SAVED · A TO RETRY`. A plays again, B goes back to the
  room.

### Not in this PRD

- A second map, levels with an exit, a boss, more than one weapon, pick-ups, and a seeded random map.
- Live multiplayer, as OMNI KART's MULTI (PRD 1572).
- Sound beyond what `sound.ts` already offers the other games.
- Any change to the XP curve, the other five games or the play dock.

## Decisions

- **The theme is a hunt for bugs in the codebase,** chosen by the person over the Vertuoza offices and
  over a building site: it follows ENTROPY INVADERS, shows no real person, and names no real
  repository.
- **One map and waves of bugs,** chosen by the person over three short levels with a boss and over one
  map against the clock: it is the smallest game that is a shooter, and it keeps a points board, the
  one the crew table already has.
- **A raycaster in canvas 2D,** chosen by the person over a 3D engine and over a rail shooter: pure
  functions tested without a canvas, as the Mode 7 of OMNI KART, and no dependency.
- **The name is BUG HUNT,** chosen by the person over VERTUO HUNT and over ZERO BUG: the repository is
  public under AGPL-3.0 and its latest commits remove Vertuoza's names from what the arcade shows.
- **LV 6,** approved with the design: one level above PULSAR VOLLEY, as each game was above the last.
- **The voice's objection, accepted.** persona:B-E DEv objected: "A first-person shooter in a delivery
  tool is one more gadget: if it weighs on the arcade or on the loading of everything else, I do not
  want it." Settled `accepted`: the game is loaded on demand only, adds no dependency, and
  `hunt/guard.test.ts` fails when any file outside `arcade/hunt/` imports it at run time.
- **The view is 320×180 and 160×144, enlarged 2×** (decided while writing this spec): the same pixel
  size on both grids, a Game Boy screen on the tall one, and a column count a laptop can cast every
  frame.
- **The shortest path is recomputed every 0.25 s, not every frame** (decided while writing this spec):
  a breadth-first search over 576 cells is cheap, but a bug that turns on every frame trembles.
- **The wave size and the bugs' hits, speeds and points sit in one constants block** (decided while
  writing this spec), `hunt/rules.ts`, so a follow-up retunes the game without touching the engine, as
  PULSAR VOLLEY's.
- **A life lost gives 1.5 s of safety** (decided while writing this spec): without it, a bug that
  reaches the player takes the three lives in a third of a second.
- **No migration:** `submit_score()` already keeps a `points` game's best under its key once the game
  is unlocked, as it did for OMNI DUET and PULSAR VOLLEY.
- **No browser acceptance scenario:** `acceptance.enabled` is off in this repository; every criterion
  below is proven by ordinary tests, and the feel by a person.
- **No proof video:** the person said no.

## User stories

- As a player at LV 6, I open the sixth cabinet and walk into the maze with the arrows.
- As a player, I turn, aim at a bug with the crosshair, fire, and see it flash and die.
- As a player, I clear a wave, read `WAVE 1 CLEARED`, and face a bigger one with a new kind of bug.
- As a player, I lose my third life, see my score, and see it kept as my best when it beats it.
- As a player on a phone, I play with the Game Boy's pad, turning and firing with two fingers.
- As a colleague who never opens the cabinet, I download nothing more than before.

## Scope

In: everything under **Solution**. Out: everything under **Solution › Not in this PRD**, any
database migration, any change to the other five games or the play dock.

## Test seams

Tests live beside the code as `*.test.ts` and run with `pnpm test`. They never call Supabase or
GitHub and never need a canvas: everything below `art.ts` and the scene's drawing is pure.

- **The map** (`hunt/map.test.ts`): the map is 24×24, closed by walls on its four edges, every floor
  cell is reachable from the player's start, and the eight spawn cells are floors out of the start's
  line of sight.
- **The raycaster** (`hunt/cast.test.ts`): on a small fixed map, a ray gives the exact distance to a
  wall straight ahead, at 45°, along a wall and in a corner; two columns in front of a flat wall give
  the same perpendicular distance (no fish-eye); the wall's side picks the dark or the light shade; a
  ray never reads a cell outside the map.
- **The sprites** (`hunt/sprites.test.ts`): sprites are ordered from the farthest to the nearest, a
  sprite twice as far is half as big, a sprite behind a nearer wall is cut by it, and one behind the
  player is not drawn.
- **The match** (`hunt/match.test.ts`): the player slides along a wall and never enters one; a shot
  hits the first bug on the line and none behind a wall; a bug dies on its last hit and adds its
  points; a wave clears when its last bug dies and adds 25 × n; wave 1 has 4 bugs and each wave adds 2;
  a `BEETLE` appears from wave 2 and a `SPITTER` from wave 4; a touch or a ball costs one life, then
  1.5 s of safety; the third life lost ends the match; a bug's path leads to the player.
- **No death earns a point:** for 200 seeds, a match where the player is touched at a given moment
  never ends with a higher score than the same presses without the touch.
- **A wave can be cleared:** for 200 seeds, a player that always aims at the nearest bug and fires
  clears waves 1 to 5 without losing the third life.
- **Determinism:** the same seed and the same presses give the same match and score; the same presses
  stepped at 1/60 s and at 1/120 s give the same match and score.
- **The score is sent once** (`hunt/match.test.ts` and `scenes/hunt.test.ts`): on the move into
  `over`, whichever route led there, and never twice.
- **The room** (extends `games/room.test.ts`, and the rulebook tests that pin `xp.unlocks`:
  `game/rulebook.test.ts`, `game/experience.test.ts`, `packages/galaxy/src/galaxy.test.ts`): the sixth
  cabinet is BUG HUNT, refused with `REACH LV 6 TO PLAY` at LV 5 and open at LV 6; on the wide grid the
  window holds cabinets 4–6 with the cursor on 6.
- **The text layer** (`scenes/hunt.test.ts`, and `scenes/theme.test.ts` on both grids): loading, the
  failure line and A to retry, the HUD, `WAVE n CLEARED`, the pause, the game over screen, and the
  score's saving, NEW BEST, best and not saved states.
- **The pixels** (`hunt/art.test.ts`): a fixed small map and camera drawn into a buffer give the
  expected walls, floor, ceiling and a sprite, on both views.
- **Loaded on demand** (`hunt/guard.test.ts`): a test reads the static import graph of the arcade's
  entry and fails if any file outside `arcade/hunt/` imports from it at run time; type-only imports
  are allowed.
- **By a person, in the browser:** how walking, turning and firing feel with the keyboard and with the
  phone's handheld, how the three bug kinds and the waves feel over a few matches, and how the view
  looks on the wide and the tall grids.

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) with a new chunk loaded only when the BUG
  HUNT cabinet opens, and a rulebook change. The next `pnpm game:xp` run unlocks `hunt` for every
  player at LV 6 or above. No migration, no new permission asked of the browser.
- **Rollback:** revert the feature PR. A `hunt` key left in `player_xp.unlocked` and scores left in
  `arcade_scores` are harmless: the room draws only the games `GAMES` lists.
- **Frame rate on a weak phone:** the raycaster casts 320 columns, or 160 on the tall grid, every
  frame. The view's size sits in `hunt/rules.ts`, so a follow-up lowers it without touching the engine.
- **Balance:** the waves' size, the bugs' speeds, hits and points, the gun's delay and the safety time
  sit in one constants block in `hunt/rules.ts`; the wave-clearing test keeps every tuning winnable.
- **Motion:** the screen's shake and flash are dropped under `prefers-reduced-motion`.

## Acceptance criteria

1. With the rulebook at `hunt: 6`, a player at LV 5 sees the sixth cabinet, BUG HUNT, refused with
   `REACH LV 6 TO PLAY`, and at LV 6 the cabinet opens the game.
2. On the wide grid, moving the room's cursor to the sixth cabinet scrolls the row so cabinets 4–6
   show; the tall grid shows one cabinet a page.
3. A page that never opens the BUG HUNT cabinet never downloads `arcade/hunt/`, and the guard test
   proves it; a failed load shows `GAME DID NOT LOAD · A TO RETRY`, A retries, and B goes back to the
   room.
4. The player starts at the maze's centre facing north; ▲ ▼ walk, ◀ ▶ turn, B held with ◀ ▶ steps to
   the side, and the player slides along a wall and never enters one.
5. The maze is drawn in perspective: a wall straight ahead at twice the distance is half as tall, a
   wall facing one way is darker than one facing the other, and a flat wall shows no fish-eye.
6. A fires at the delay of a third of a second; a shot hits the first bug on the line of sight and no
   bug behind a wall; a hit bug flashes, and its last hit kills it and adds its points (`GNAT` 10,
   `BEETLE` 30, `SPITTER` 60).
7. Wave 1 has 4 bugs and each wave adds 2; a `BEETLE` appears from wave 2 and a `SPITTER` from wave 4;
   the last bug of a wave dying shows `WAVE n CLEARED`, adds 25 × n points and starts wave n+1.
8. A bug that touches the player, or a `SPITTER`'s ball that hits them, costs one life and gives 1.5
   seconds of safety; the third life lost ends the match; a life lost never changes the score.
9. START pauses and only START resumes; a blurred window, a hidden tab or leaving the scene pauses
   too; SELECT on the pause quits.
10. The third life lost or SELECT · QUIT on the pause ends the match and sends the score reached once
    under `hunt`, showing saving, then NEW BEST, best or not saved with a retry; A plays again and B
    goes back to the room.
11. The same seed and the same presses give the same match and score at 60 and at 120 frames a second,
    and no touch at any tested moment leaves a higher score than the same match without it.
12. For 200 seeds, a player that aims at the nearest bug and fires clears waves 1 to 5.
13. The HUD shows `SCORE n`, `WAVE n`, the lives and a crosshair on both grids, and under
    `prefers-reduced-motion` the screen does not shake or flash.
