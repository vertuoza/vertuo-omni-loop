---
prd: 817
title: Super Omni World, a SNES-style platformer unlocked at LV 2
blocked-by: none
spec: file
---

# Super Omni World, a SNES-style platformer unlocked at LV 2

**Date:** 2026-09-30 · **PRD:** #817
**Touches:**
- `game/rulebook.mjs` (`xp.unlocks` gets `platformer: 2`)
- `apps/galaxy/package.json` (the `phaser` dependency, 4.x)
- `apps/galaxy/src/arcade/games/index.ts` (the `GAMES` row), `apps/galaxy/src/arcade/scenes/common.ts`
  (the `platformer` scene name), `apps/galaxy/src/arcade/scenes/index.ts` (its case)
- `apps/galaxy/src/arcade/platformer/` (new: rules, stages, the Phaser scene, `PlatformerScreen`)
- `apps/galaxy/src/arcade/scenes/platformer.tsx` and `.css` (new: the arcade's text layer over it)
- `packages/design/src/sprites.mjs` (new 16px tile sprites, one palette per stage)
- `apps/galaxy/src/play-dock/` (`dock.ts`, `DockGame.tsx`, `PlayDock.tsx`, `send.ts`: the picker and
  the second game)
- `apps/galaxy/README.md` (The game room: the second game)

## Problem

The arcade's game room has one game, Entropy Invaders, open from LV 1, and two SOON cabinets. The
corner Game Boy dock (PRD 757) plays only Invaders: `DockGame.tsx` is hardwired to it and
`DOCK_GAME` is `'invaders'`. A player who reaches LV 2 gets nothing new to play.

A colleague asked for a Super Mario World (SNES) replica to play once they reach LV 2. A replica of
Nintendo's characters, stages, sprites or music cannot ship in this repository, which is public.
What they want is the feel: run, jump, stomp, coins, a flag at the end, and more than one stage.

## Solution

**SUPER OMNI WORLD** is an original side-scrolling platformer in the SNES style, unlocked at LV 2,
playable from a cabinet in the arcade room and from a game picker in the play dock.

### Unlock

- The rulebook's `xp.unlocks` becomes `{ invaders: 1, platformer: 2 }`. `GAMES` gets a second row:
  `{ id: 'platformer', title: 'SUPER OMNI WORLD', scene: 'platformer' }`.
- The room's second cabinet is SUPER OMNI WORLD. Below LV 2 it shows `REACH LV 2 TO PLAY`, the room's
  existing refusal. From LV 2 it opens. The third cabinet stays SOON.
- Unlocks already stick (`unlockedFor` in `game/experience.mjs`). A player gets `platformer` in
  `player_xp.unlocked` at the next `pnpm game:xp` run after the rulebook change is merged. Until then
  the cabinet stays locked for them, and the server refuses their score, as it does for any game not
  unlocked.

### Engine

- The game runs on **Phaser 4** (MIT, the most used open-source web game engine: about 40k GitHub
  stars and 470k npm downloads a week, v4.2.1 from July 2026). It uses Phaser's arcade physics and
  its tilemaps.
- Phaser is loaded with a dynamic `import('phaser')` only when the platformer opens. The arcade's
  other scenes and the dock's Invaders never load it.
- **`PlatformerScreen`** (React) is the one way in. It starts a `Phaser.Game` in pixel-art mode
  inside its own box, on the grid it is given (tall 320×288 or wide 640×360, `arcade/grid.ts`). It
  pauses and resumes when told, and destroys the game on unmount, which removes its canvas and every
  listener. The arcade's `platformer` scene and the dock both mount it.
- Phaser does not read the keyboard or touch. Actions come from the arcade's own input
  (`keyAction` in `arcade/keys.ts`, `createHeld()` in `arcade/held.ts`, the handheld's D-pad) and
  are handed to the scene each frame. So the dock's rules keep holding: keys typed into page inputs
  are ignored, Esc folds the dock, and a hidden tab pauses the game.

### The game

- **Controls:** left and right move, **A** jumps, **B** held runs, **START** pauses. On the pause
  screen, **SELECT** quits to the room (in the arcade) or folds the dock (in the dock).
- **Jump:** holding A longer jumps higher, up to a cap. The arc cannot be changed in mid-air except
  by steering left or right, and a jump can only start from the ground.
- **Stages:** three, played in order: **1-1** grass, **1-2** underground, **1-3** castle. Each is a
  text tile map in `platformer/stages.ts`, one character per 16px tile, `.` for empty and `#` for
  ground, with the full legend written above the maps. The tiles are ground, brick, `?` block, pipe,
  castle stone, coin, enemy, the start, and the flag. A pit is a column with no ground. Stages are
  18 tiles high, the height of the tall grid, and up to 220 tiles long. The camera follows the hero
  to the right and never scrolls back past the left edge of the screen.
- **Hero:** the player's own arcade hero, the 32×48 OmniMan body in their colours (`heroLook`), about
  3 tiles tall. Without a hero it is the default hero the dock already uses. It has two frames for
  running and one for jumping, taken from the existing poses (`omni-run`).
- **Enemies:** the existing Entropy blob (24×24), tinted per stage with `woundTint`. It walks and
  turns around at walls and ledges. Landing on it from above kills it and bounces the hero.
  Touching it any other way costs a life.
- **Blocks:** hitting a `?` block from below gives one coin, and the block then turns empty.
  Bricks are solid and do not break.
- **Lives:** 3. Losing a life (an enemy, a pit, or the stage timer reaching 0) restarts the current
  stage from its start, with the score kept. At 0 lives the game is over.
- **Timer:** each stage has 300 seconds. Reaching the flag ends the stage and adds 10 points per
  second left.
- **Score:** a coin is 10, a stomp is 50, plus the time bonus. The game ends at 0 lives, or after
  1-3's flag with a `WORLD CLEAR` screen.
- **The text layer** (DOM over the canvas, like every arcade scene) shows the score, coins, lives,
  stage and time. It also shows the ready screen (`1-1 · PRESS START`), the pause screen, the game
  over and `WORLD CLEAR`.
- **Sound:** none in this PRD, the same as the dock.

### Score

At the end of a game (game over or `WORLD CLEAR`) the score is sent once through the account's
`submitScore('platformer', score)`. It shows the same saving, NEW BEST, best and not saved states
with a retry that Invaders uses (`scenes/invaders-score.ts`). `send.ts` takes the game's key as an
argument instead of the `DOCK_GAME` constant. No database change is needed: `arcade_scores.game`
takes any key matching `^[a-z0-9-]{1,32}$`, and `submit_score()` checks the player's unlocks.

### The dock

- `dockDoor` decides which games the player may play: Invaders from LV 1, SUPER OMNI WORLD from LV 2,
  the same cabinet rules as the room.
- When only Invaders is open, the dock opens straight into Invaders, as it does today.
- When both are open, the dock opens on a picker: two lines, `ENTROPY INVADERS` and
  `SUPER OMNI WORLD`, chosen with up and down and opened with A. B on the picker folds the dock. B
  from a game's ready, pause or game-over screen goes back to the picker.
- The dock's other rules apply to both games. A question on the page pauses the game at once and
  only START resumes it. When Claude is done, the game goes on to its end. It is silent.
- The picker remembers the last game chosen for the tab's session, in the same sessionStorage
  entry as the dock's open state (`DOCK_KEY`). Storage that throws is ignored, as `readOpen` does.

### When Phaser does not load

If `import('phaser')` fails (offline, or a chunk missing after a deploy), the screen shows
`GAME DID NOT LOAD · A TO RETRY`. A retries the import and B goes back (to the room, or to the
picker in the dock). The error is logged with `console.error`.

## Decisions

- **Original, never a replica.** No Nintendo names, characters, sprites, stages or music. The
  stages are drawn for this game, and the cast comes from `@omni/design`.
- **Phaser 4 over our own engine.** The person asked for a popular, maintained open-source engine.
  Phaser was chosen over melonJS, Excalibur and KAPLAY on use and upkeep.
- **Game rules outside Phaser.** Scoring, lives, the timer, stage order, stage parsing and jump
  timing are pure modules with no Phaser import. Phaser does only the physics, the collisions and
  the drawing, and reports events (`coin`, `stomp`, `hurt`, `pit`, `flag`) to those rules.
- **Stages as text in code**, not Tiled JSON files. They can be read in a diff and checked by a
  test, and need no editor.
- **Cut from this PRD:** power-ups, breaking bricks, music and sounds, secret areas, a world map,
  saving progress between sessions (every game starts at 1-1), touch-only controls beyond what the
  handheld's D-pad and buttons already give.

## User stories

1. As a player at LV 2 or above, I open the SUPER OMNI WORLD cabinet in the arcade room and play
   1-1 with my own hero.
2. As a player below LV 2, I see the cabinet locked with `REACH LV 2 TO PLAY`.
3. As a player at LV 2 or above with Claude working, I open the dock, pick SUPER OMNI WORLD, and
   the game pauses by itself when Claude asks me a question.
4. As a player below LV 2, the dock opens straight into Invaders, as before.
5. As a player, I stomp entropy, collect coins, reach the flag, clear 1-3 and see my score saved.
6. As a player on a bad connection, I see `GAME DID NOT LOAD · A TO RETRY` rather than a blank
   screen.

## Scope

In: everything under **Solution**. Out: everything under **Decisions › Cut**, any change to the XP
curve or levels, any database migration, any change to Invaders' play.

## Test seams

Tests live beside the code as `*.test.ts` and run with `pnpm test`. They never call Supabase or
GitHub, and never load Phaser.

- **Rules** (`platformer/rules.test.ts`): scoring (coin, stomp, time bonus), lives and restart of
  the current stage, the timer running out, stage order 1-1 → 1-2 → 1-3 → `WORLD CLEAR`, game over
  at 0 lives, and the jump height growing with how long A is held, up to the cap.
- **Stages as data** (`platformer/stages.test.ts`): every stage parses. Each has exactly one start
  and one flag, only legend characters, 18 rows of equal length, and ground under the start. No pit
  is wider than the longest run-jump the rules allow. An unknown character is refused with its row
  and column.
- **Screen** (`platformer/PlatformerScreen.test.ts`, Phaser replaced by a stub module): it starts
  the game on mount with the given grid and pixel-art mode, passes pause and resume through, and
  destroys the game on unmount. A failed import shows the retry line, and A retries.
- **Room** (extends `games/room.test.ts`): the second cabinet is SUPER OMNI WORLD, refused with
  `REACH LV 2 TO PLAY` at LV 1 and open at LV 2.
- **Dock** (extends `play-dock/dock.test.ts` and `PlayDock.test.ts`): below LV 2 it opens straight
  into Invaders, and at LV 2 it opens on the picker. A and B on the picker, the remembered choice,
  and storage that throws are covered. `send.test.ts` sends under the game's key.
- **Lazy loading guard:** a test reads the import graph of `play-dock/DockGame.tsx` and the arcade's
  Invaders scene, and fails if `phaser` is imported statically anywhere but `platformer/`.
- **By a person, in the browser:** how the jump and the run feel, and the three stages played to
  the end, in the arcade on desktop (wide) and in the dock (tall).

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) with a new Phaser chunk loaded on demand,
  and a rulebook change. The next `pnpm game:xp` run unlocks `platformer` for every player at LV 2
  or above. No migration.
- **Rollback:** revert the feature PR. A `platformer` key left in `player_xp.unlocked` and scores
  left in `arcade_scores` are harmless: the room draws only the games `GAMES` lists.
- **Bundle:** Phaser is about 350 KB gzipped. The lazy loading guard keeps it off every page until
  someone opens the game.
- **Feel:** the physics numbers are chosen by eye. They sit in one constants block in the rules, so
  a follow-up can tune them without touching the scene.

## Acceptance criteria

1. With the rulebook at `platformer: 2`, a player at LV 1 sees the SUPER OMNI WORLD cabinet refused
   with `REACH LV 2 TO PLAY`, and at LV 2 the cabinet opens the game.
2. In the arcade, SUPER OMNI WORLD plays 1-1, 1-2 and 1-3 in order with the player's hero. It
   shows score, coins, lives, stage and time, and ends on `WORLD CLEAR` or on the game over.
3. A coin adds 10, a stomp adds 50, and the flag adds 10 per second left. A life lost restarts the
   current stage with the score kept, and 0 lives ends the game.
4. At the end of a game the score is sent once under `platformer` and shows saving, then NEW BEST,
   best or not saved with a retry.
5. In the dock, a player below LV 2 goes straight into Invaders. A player at LV 2 or above gets the
   picker and can play either game, and B goes back to the picker.
6. In the dock, a question on the page pauses SUPER OMNI WORLD at once, and only START resumes it.
7. A page that never opens the platformer never downloads Phaser, and the lazy loading guard test
   proves it.
8. A failed Phaser load shows `GAME DID NOT LOAD · A TO RETRY`, and A retries.
9. Every stage passes the stage checks: one start, one flag, 18 equal rows, known characters, and
   no pit wider than a run-jump.
10. Leaving the game (unmount) leaves no Phaser canvas and no listener behind.
