---
prd: 1359
title: OMNI KART, a Mode 7 kart racer unlocked at LV 3
blocked-by: none
spec: file
proof: video
---

# OMNI KART, a Mode 7 kart racer unlocked at LV 3

**Date:** 2026-10-09 · **PRD:** #1359
**Touches:**
- `game/rulebook.ts` (`xp.unlocks` gets `kart: 3`)
- `apps/galaxy/src/arcade/games/index.ts` (the third `GAMES` row)
- `apps/galaxy/src/arcade/scenes/common.ts` (the `kart` scene name, the `kart` field of `FrameState`),
  `apps/galaxy/src/arcade/scenes/index.ts` (the new group and its case)
- `apps/galaxy/src/arcade/scenes/kart.ts`, `kart.tsx` and `kart.css` (new: the scene group, the
  canvas hand-off and the text layer)
- `apps/galaxy/src/arcade/kart/` (new: the circuit, the rules, the kart, the CPU, the items, the
  race, the Mode 7 projection, the art, the loader)
- `apps/galaxy/src/arcade/ArcadeApp.tsx` (the scene's loading, frame loop, presses, pauses and score)
- `apps/galaxy/src/arcade/onboarding.ts` (`kart` in `SIGNED_IN_ONLY`)
- `packages/design/src/sprites.ts` (new: the kart and the ORB)
- `apps/galaxy/README.md` (The game room: the third game)

## Problem

The arcade's game room stands three cabinets: ENTROPY INVADERS from LV 1, SUPER OMNI WORLD from
LV 2 (PRD 817), and a third that says `SOON`. A player who reaches LV 3 gets nothing new to play.

A colleague asked for a Super Mario Kart (SNES) game in the game room. A replica of Nintendo's
characters, karts, circuits, items, sprites or music cannot ship in this repository, which is
public. What they want is the feel: a flat circuit seen in perspective from behind the kart and
turning with it (Mode 7), a race against computer karts, and item boxes that change the race.

## Solution

**OMNI KART** is an original kart racer in the SNES Mode 7 style, unlocked at LV 3, played from the
game room's third cabinet.

### Unlock

- The rulebook's `xp.unlocks` becomes `{ invaders: 1, platformer: 2, kart: 3 }`. `GAMES` gets a
  third row: `{ id: 'kart', title: 'OMNI KART', scene: 'kart' }`.
- The room's third cabinet is OMNI KART, in place of the `SOON` cabinet: the room keeps its three
  cabinets. Below LV 3 it shows `REACH LV 3 TO PLAY`, the room's existing refusal. From LV 3 it
  opens. It shows the room's standard lit cabinet (crew top 5, `A · PLAY`).
- Unlocks already stick (`unlockedFor` in `game/experience.ts`). A player gets `kart` in
  `player_xp.unlocked` at the next `pnpm game:xp` run after the rulebook change is merged. Until then
  the cabinet stays locked for them, and the server refuses their score, as it does for any game not
  unlocked.

### Engine

- The game runs on **its own engine**, on the arcade's own canvas, as Entropy Invaders does. No new
  dependency.
- **The simulation** is pure: `newRace({ seed, grid, cast })`, `step(race, held, dt)` and
  `press(race, action)` return a new race and the events of that step. It has no DOM, no canvas and
  no clock of its own. The same seed and the same inputs give the same race.
- **The frame loop** is the arcade's existing `requestAnimationFrame` loop in `ArcadeApp.tsx`. On the
  `kart` scene it steps the race with the time since the last frame and the buttons held now, as it
  does for Invaders. `dt` is capped at 50 ms and played in fixed sub-steps, so a slow frame never
  carries a kart through a wall.
- **Mode 7:** each frame, the floor below the horizon is projected from the circuit's texture, one
  sample per screen pixel, into one reused pixel buffer drawn with `putImageData`. The camera sits
  behind and above the player's kart and turns with it. Above the horizon: the Omni sky (stars, a
  nebula and a planet, from `@omni/design`'s `draw.ts`), scrolling sideways as the kart turns. Then
  the sprites (karts, item boxes, BLOBs, ORBs) are drawn from the farthest to the nearest, each scaled
  by its distance.
- **Grids:** the race is drawn on the grid it is given, tall 320×288 or wide 640×360
  (`arcade/grid.ts`), and keeps the grid it started on, as SUPER OMNI WORLD does. `kart` is a tall
  scene, so the handheld plays it on the tall grid.
- **Loaded on demand:** everything under `arcade/kart/` is loaded with a dynamic `import()` when the
  cabinet opens, never before. The arcade's other scenes import only its types. While it loads the
  screen shows `LOADING…`. If the import fails (offline, or a chunk missing after a deploy), it shows
  `GAME DID NOT LOAD · A TO RETRY`: A retries the import, B goes back to the room, and the error is
  logged with `console.error`.
- **Colours** come from `@omni/design`'s ramps. Any colour equal to a theme token is read from
  `FrameState.theme` (ADR-0046).

### Controls

| button | what it does |
|---|---|
| ◀ ▶ | steer; a kart at rest does not turn, and a fast kart turns less |
| **A** held | accelerate |
| ▼ held | brake, then reverse once stopped |
| **B** | use the item held |
| **START** | pause; on the pause screen, **SELECT** quits to the room |

The keys come from the arcade's own input (`keyAction` in `arcade/keys.ts`, `createHeld()` in
`arcade/held.ts`, the handheld's D-pad), as for the other two games: `kart` joins `HELD_SCENES`.

### The circuit

- One circuit, **COMET RING**, raced over **3 laps**: a closed loop of about eight turns, a hairpin,
  and a long start straight.
- It is a text map in `kart/track.ts`, one character per 16px tile, about 64×64 tiles, with the full
  legend written above the map: `#` road, `.` grass, `X` wall, `r` kerb (road), `=` the start line,
  `?` an item box, `S` a starting place. The road is 4 to 6 tiles wide.
- **The racing line** is an ordered list of waypoints beside the map. The CPU drivers follow it, and
  laps and places are counted along it.
- **A lap** counts when a kart crosses the start line forwards after passing every waypoint in
  order. Crossing it backwards, or after a shortcut that skips a waypoint, counts nothing.
- **Grass** halves a kart's top speed. **A wall** stops the part of the speed going into it and
  bounces the kart off. A kerb is road.
- The circuit's texture is drawn once, when the race starts, from the map in `@omni/design` ramps.
- **The par time** is a constant beside the map: 150 seconds for the 3 laps.

### The karts

- **Six** on the grid: the player, on the last starting place, and five rivals.
- **The player** drives their own arcade hero (`heroLook`), in a kart tinted with the hero's suit.
  Without a hero, it is the default hero the arcade already uses.
- **The rivals** are the workspace's fleets other than the player's own, each driven by its mascot
  in its fleet's colour (`fleetSprite`). When the workspace has fewer than five other fleets, the
  remaining places take the next mascots of `MASCOTS` that no rival drives yet.
- **The kart** is a new sprite in `@omni/design`: seen from behind, leaning left and leaning right,
  two frames each, tinted per driver, with the driver's sprite in its seat. A rival is drawn with
  the view closest to the angle the camera sees it from.
- **Physics** (one constants block in `kart/rules.ts`, chosen by eye): acceleration up to a top
  speed, slowing down when A is released, braking and reversing, steering that falls off with speed.
  Two karts that touch push each other apart, as two circles.
- **A spin-out** (a BLOB driven over, or an ORB hit) lasts 1 second: the kart drops to 30% of its
  speed, turns on itself and takes no input. The race goes on around it. There are no lives.

### The items

- Two rows of four item boxes stand across the road. Driving through a box gives the kart one item
  when it holds none; the box disappears for 3 seconds, then comes back. A kart holds one item at a
  time, and the player's shows in the HUD.
- The item is drawn from the race's seed, weighted by place: the leaders draw more BLOBs, the karts
  behind more BOOSTs and ORBs.
- **BOOST:** 1.5 seconds at 1.4 times the top speed, grass included.
- **BLOB:** an Entropy blob (the existing sprite, `woundTint`) dropped behind the kart. The first
  kart to drive over it spins out, and it is gone. At most six lie on the circuit; a seventh removes
  the oldest.
- **ORB:** a glowing orb (a new 16×16 sprite) thrown straight ahead at twice the top speed. It
  bounces off walls, and is gone at its third bounce, after 4 seconds, or when it hits a kart, which
  spins out.

### The CPU drivers

- Each rival follows the racing line, off it by a small amount drawn from the seed, at its own
  skill: a top speed between 92% and 100% of the player's.
- A light rubber band keeps the race close: a rival's top speed moves by at most ±5%, up when it is
  behind the player and down when it is far ahead.
- Rivals take the item boxes on their line and use their items by plain rules: a BOOST at once on a
  straight, a BLOB when a kart is close behind, an ORB when a kart is ahead, in range and roughly in
  line.

### The race

The race is a phase machine:

1. **`ready`:** `COMET RING · 3 LAPS · PRESS START`. The player always chooses when the race starts.
2. **`countdown`:** 3 · 2 · 1 · GO, over 3 seconds. Accelerating before GO does nothing.
3. **`race`:** the text layer shows the place (1ST to 6TH), `LAP n/3`, the race time and the item
   held. A `FINAL LAP` banner shows when the third lap starts.
4. **`paused`:** START pauses. Leaving the scene, a blurred window or a hidden tab pause it too, and
   clear the buttons held. Only START resumes.
5. **`finish`:** when the player crosses the line at the end of lap 3. The results table lists the
   six places, each driver and their time. Rivals that have not finished are placed by how far
   along the circuit they are at that moment, with `--` for a time. From there, A races again (a new
   seed) and B goes back to the room.

The text layer (DOM over the canvas, like every arcade scene) draws the HUD, the ready, countdown,
pause and results screens, and the loading and failure lines, on both grids.

### Score

- At the finish, the score is the place points plus a time bonus:
  - place points: 1ST 1000, 2ND 700, 3RD 500, 4TH 350, 5TH 200, 6TH 100;
  - time bonus: 1 point per tenth of a second under the par time, and 0 at or over it.
- It is sent once, at the finish, through the account's `submitScore('kart', score)`. It shows the
  same saving, NEW BEST, best and not saved states with a retry that Invaders uses
  (`scenes/invaders-score.ts`).
- Quitting from the pause screen before the finish sends nothing: a race has no score before its
  finish line.
- No database change is needed: `arcade_scores.game` takes any key matching `^[a-z0-9-]{1,32}$`,
  scores are higher-is-better, and `submit_score()` checks the player's unlocks.

### Sound

None in this PRD, the same as SUPER OMNI WORLD.

## Decisions

- **Original, never a replica.** No Nintendo names, characters, karts, circuits, items or music.
  The game is OMNI KART, the circuit COMET RING, the items BOOST, BLOB and ORB, and the cast comes
  from `@omni/design` (the player's hero and the fleet mascots).
- **Its own engine over Phaser 4 or a WebGL shader.** The person chose it from three approaches.
  Phaser's arcade physics and tilemaps do nothing for a Mode 7 racer: the projected floor, the camera
  and the kart physics would be written by hand anyway, behind a 350 KB chunk. A WebGL floor would
  add a dependency or WebGL plumbing, be harder to test, and lose the pixel look. A per-pixel floor
  is cheap at 640×360 at most, and a pure simulation tests like Invaders' engine.
- **Loaded on demand.** The voice objected on the design: *"I already see omni-loop as a gimmick,
  fluff (persona:B-E DEv). A third game whose whole engine loads for everyone who opens the arcade,
  even without ever playing it, is exactly the fluff I mean (persona:B-E DEv)."* Settled
  **accepted**: `arcade/kart/` is imported only when the cabinet opens, with the loading and
  failure lines of PRD 817, and a guard test keeps it that way.
- **The score is points, higher is better.** The database and the room know only higher-is-better
  scores (`greatest(...)`, `best desc`, `isNewBest`, `withBest`). Place points with a time bonus
  rank like a race and need no migration; a raw race time would.
- **Arcade only, not the play dock.** A three-lap race plays badly paused at every question Claude
  asks, and the dock does not send SUPER OMNI WORLD's score either. The dock's picker is unchanged.
- **One circuit, three laps.** Mode 7, CPU drivers and items already make a full PRD. More circuits
  are a later PRD.
- **No lives, and a spin-out never stops the race.** P-PRODUCT-53 (play never resumes on its own
  after a setback) is about a life lost; a race has none. The ready screen and START still gate the
  start, and only START resumes a pause.
- **Quitting before the finish sends nothing.** P-PRODUCT-54 (every way a game can end saves the
  score reached) holds: no score is reached before the finish line.
- **The rivals are the workspace's own fleets**, so a race is against the crews the player knows.
- **The player starts last**, so the race is a climb.
- **Cut from this PRD:** drifting and hopping, a boosted start, more circuits, cups, time trial and
  ghosts, multiplayer, music and sounds, coins on the circuit, the play dock, a cabinet attract of its
  own, touch controls beyond the handheld's D-pad and buttons.

## User stories

1. As a player at LV 3 or above, I open the OMNI KART cabinet in the game room and race COMET RING
   with my own hero against five karts driven by my workspace's fleet mascots.
2. As a player below LV 3, I see the third cabinet locked with `REACH LV 3 TO PLAY`.
3. As a player, I take an item box, fire a BOOST, drop a BLOB on the kart behind me and hit the kart
   ahead with an ORB.
4. As a player, I finish the three laps, see where I placed among the six, and see my score saved.
5. As a player on a bad connection, I see `GAME DID NOT LOAD · A TO RETRY` rather than a blank
   screen.
6. As someone who opens the arcade and never plays OMNI KART, my browser never downloads its engine.

## Scope

In: everything under **Solution**. Out: everything under **Decisions › Cut**, any change to the XP
curve or levels, any database migration, any change to Entropy Invaders, SUPER OMNI WORLD or the
play dock.

## Test seams

Tests live beside the code as `*.test.ts` and run with `pnpm test`. They never call Supabase or
GitHub, and never need a canvas: everything below `art.ts` and the scene's drawing is pure.

- **The circuit** (`kart/track.test.ts`): the map parses, uses only legend characters, and has rows
  of equal length; an unknown character is refused with its row and column. Every waypoint is on the
  road, and the straight between two consecutive waypoints is road all along. There are exactly six
  starting places, behind the start line and on the road. The start line crosses the road from wall
  to wall. Every item box is on the road.
- **The kart** (`kart/kart.test.ts`): it accelerates up to its top speed, slows when A is released,
  brakes then reverses. It does not turn at rest and turns less when fast. Grass halves its top
  speed. A kart at top speed with a 50 ms step never ends up inside or beyond a wall. Two touching
  karts are pushed apart. A spin-out lasts 1 second and takes no input.
- **Mode 7** (`kart/mode7.test.ts`): nothing is drawn on the floor above the horizon. A point
  straight ahead lands on the centre column, higher on the screen the farther it is. A floor pixel
  maps back to its point on the circuit within a pixel. Turning the camera a quarter turn turns what
  it samples. A sprite behind the camera is not drawn, and a sprite's size is in inverse proportion
  to its distance.
- **The items** (`kart/items.test.ts`): a box gives an item only to a kart holding none, and comes
  back after 3 seconds. The draw follows the seed and is weighted by place. A BOOST lasts 1.5 seconds
  at 1.4 times the top speed, on grass too. A BLOB lands behind, spins out the first kart over it and
  is gone; a seventh removes the oldest. An ORB flies straight, and is gone at its third bounce,
  after 4 seconds, or on hitting a kart, which spins out.
- **The CPU** (`kart/cpu.test.ts`): a rival alone on COMET RING completes three laps within twice
  the par time, so the circuit is drivable and nobody gets stuck. Rivals keep their skill order. The
  rubber band never moves a top speed by more than 5%. Each item is used by its rule.
- **The race** (`kart/race.test.ts`): ready, then a 3-second countdown, then the race; A before GO
  does nothing. START pauses, an outside pause pauses, and only START resumes. A lap counts only
  after every waypoint in order, and never backwards. Places follow progress along the racing line.
  The finish at lap 3 places the unfinished rivals by progress. The score is the place points plus
  a point per tenth of a second under par, and is given once. Quitting before the finish gives none.
  The same seed and inputs give the same race.
- **The room** (extends `games/room.test.ts`, and the rulebook tests that pin `xp.unlocks`:
  `game/rulebook.test.ts`, `game/experience.test.ts`, `packages/galaxy/src/galaxy.test.ts`,
  `packages/galaxy/src/xp.test.ts`): the third cabinet is OMNI KART, refused with
  `REACH LV 3 TO PLAY` at LV 2 and open at LV 3.
- **The text layer** (`scenes/kart.test.ts`, and `scenes/theme.test.ts` on both grids): loading,
  the failure line and A to retry, ready, countdown, the HUD, `FINAL LAP`, the pause, the results
  table, and the score's saving, NEW BEST, best and not saved states.
- **Loaded on demand:** a test reads the static import graph of the arcade's entry and fails if any
  file outside `arcade/kart/` imports from it at run time; type-only imports are allowed.
- **By a person, in the browser:** how steering, speed and the rivals feel, and three laps raced to
  the end, on a computer (wide grid) and on a phone's handheld (tall grid), smooth at 60 frames a
  second.

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) with a new chunk loaded only when the OMNI
  KART cabinet opens, and a rulebook change. The next `pnpm game:xp` run unlocks `kart` for every
  player at LV 3 or above. No migration.
- **Rollback:** revert the feature PR. A `kart` key left in `player_xp.unlocked` and scores left in
  `arcade_scores` are harmless: the room draws only the games `GAMES` lists.
- **Frame rate on small phones:** the floor is one sample per pixel, at most 640×240 on the wide grid
  and 320×192 on the tall one, into one buffer allocated once. The person's browser check covers a
  phone.
- **Feel:** the physics, the rivals' skill and the item numbers are chosen by eye. They sit in one
  constants block in `kart/rules.ts`, so a follow-up can tune them without touching the engine.

## Acceptance criteria

1. With the rulebook at `kart: 3`, a player at LV 2 sees the third cabinet, OMNI KART, refused with
   `REACH LV 3 TO PLAY`, and at LV 3 the cabinet opens the game.
2. The race shows COMET RING in Mode 7 from behind the player's own hero, the floor turning with the
   kart, against five rivals driven by the workspace's fleet mascots, on the wide and the tall grid.
3. `COMET RING · 3 LAPS · PRESS START` waits for START, then 3 · 2 · 1 · GO runs, and nothing moves
   before GO.
4. A lap counts only after every waypoint in order, the HUD shows the place, `LAP n/3`, the time and
   the item held, and `FINAL LAP` shows on the third lap.
5. An item box gives one item to a kart holding none; BOOST, BLOB and ORB do what **The items**
   says, for the player and for the rivals.
6. Crossing the line at the end of lap 3 shows the results table with the six places, and the score
   (place points plus a point per tenth of a second under 150 seconds) is sent once under `kart`,
   showing saving, then NEW BEST, best or not saved with a retry.
7. START pauses and only START resumes; a blurred window, a hidden tab or leaving the scene pause the
   race too; SELECT on the pause screen goes back to the room and sends nothing.
8. A page that never opens the OMNI KART cabinet never downloads `arcade/kart/`, and the guard test
   proves it.
9. A failed load shows `GAME DID NOT LOAD · A TO RETRY`, A retries, and B goes back to the room.
10. COMET RING passes the circuit checks, and a rival alone completes three laps within twice the
    par time.
