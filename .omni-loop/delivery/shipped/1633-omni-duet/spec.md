---
prd: 1633
title: OMNI DUET, a two-orb dodge game unlocked at LV 4
blocked-by: none
spec: file
---

# OMNI DUET, a two-orb dodge game unlocked at LV 4

**Date:** 2026-10-11 · **PRD:** #1633
**Touches:**
- `game/rulebook.ts` (`xp.unlocks` gets `duet: 4`)
- `apps/galaxy/src/arcade/games/index.ts` (the fourth `GAMES` row)
- `apps/galaxy/src/arcade/games/room.ts` and `scenes/games.ts` (the wide grid's window of three
  cabinets that follows the cursor)
- `apps/galaxy/src/arcade/scenes/common.ts` (the `duet` scene name and its `FrameState` field),
  `apps/galaxy/src/arcade/scenes/index.ts` (the new group and its case)
- `apps/galaxy/src/arcade/scenes/duet.ts`, `duet.tsx` and `duet.css` (new: the scene group, the
  canvas hand-off and the text layer)
- `apps/galaxy/src/arcade/duet/` (new: the rules, the waves, the run, the collisions, the art, the
  loader)
- `apps/galaxy/src/arcade/ArcadeApp.tsx` (the scene's loading, frame loop, presses, pauses and
  score; `duet` in `HELD_SCENES`)
- `apps/galaxy/src/arcade/onboarding.ts` (`duet` in `SIGNED_IN_ONLY`)
- `apps/galaxy/README.md` (The game room: the fourth game)

## Problem

The arcade's game room stands three cabinets: ENTROPY INVADERS from LV 1, SUPER OMNI WORLD from
LV 2 and OMNI KART from LV 3. A player who reaches LV 4 gets nothing new to play.

The room also has no dodge-and-rhythm game: one shooter, one platformer, one racer. A colleague
asked for a game in the spirit of *Duet* (Kumobius, 2013): two orbs on one circle, turned together,
threaded through falling obstacles. A replica of its name, art, levels or music cannot ship in this
repository, which is public. What they want is the feel: one thumb, two orbs, and waves that ask for
a precise turn at the right moment.

SUPER OMNI WORLD taught one more lesson: there, a life lost keeps the score and puts the stage's
coins and blobs back, so dying on purpose farms points. A new game must never let a death earn a
point.

## Solution

**OMNI DUET** is an original two-orb dodge game, unlocked at LV 4, played from the game room's
fourth cabinet.

### Unlock and the room

- The rulebook's `xp.unlocks` becomes `{ invaders: 1, platformer: 2, kart: 3, duet: 4 }`. `GAMES`
  gets a fourth row: `{ id: 'duet', title: 'OMNI DUET', scene: 'duet', measure: 'points' }`.
- The room stands four cabinets. On the tall grid it already shows one cabinet a page, and ◀ ▶
  already move one cursor over every cabinet (`turnPage` over `cabinets()`), so nothing changes
  there. On the wide grid it shows a **window of three cabinets** that scrolls by one so the cabinet
  under the cursor is always in it: cabinets 1–3 while the cursor is on 1 to 3, cabinets 2–4 on 4.
  The cabinets keep today's size. `ROOM_CABINETS` stays the room's minimum, 3.
- Below LV 4 the fourth cabinet shows `REACH LV 4 TO PLAY`, the room's existing refusal. From LV 4
  it shows the room's standard lit cabinet (crew top 5, `A · PLAY`).
- Unlocks already stick (`unlockedFor` in `game/experience.ts`). A player gets `duet` in
  `player_xp.unlocked` at the next `pnpm game:xp` run after the rulebook change is merged.

### Engine

- The game runs on **its own engine**, on the arcade's own canvas, as ENTROPY INVADERS and OMNI KART
  do. No new dependency.
- **The simulation** is pure: `newRun({ seed })`, `step(run, held, dt)` and `press(run, action)`
  return a new run and the events of that step. It has no DOM, no canvas and no clock of its own.
- **Fixed steps:** `step` plays `dt` in fixed sub-steps of 1/60 s, carrying the remainder to the
  next call, with `dt` capped at 50 ms. The same inputs give the same run whether the screen draws
  60 or 120 frames a second.
- **The frame loop** is the arcade's existing `requestAnimationFrame` loop in `ArcadeApp.tsx`. On the
  `duet` scene it steps the run with the time since the last frame and the buttons held now. `duet`
  joins `HELD_SCENES`.
- **One playfield on both grids:** the game is played in one playfield of 320×288 game pixels. The
  tall grid draws it as the whole screen; the wide grid (640×360) draws it centred, scaled to its
  height, with the Omni sky filling the sides. The geometry, the speeds and so the scores are the
  same on both grids.
- **Loaded on demand:** everything under `arcade/duet/` is loaded with a dynamic `import()` when the
  cabinet opens, never before. The arcade's other scenes import only its types. While it loads the
  screen shows `LOADING…`. If the import fails it shows `GAME DID NOT LOAD · A TO RETRY`: A retries
  the import, B goes back to the room, and the error is logged with `console.error`.
- **Colours** come from `@omni/design`'s ramps. Any colour equal to a theme token is read from
  `FrameState.theme` (ADR-0046).

### The orbs and the controls

- The Omni Loop crest sits in the lower third of the playfield. Around it, a circle of radius 56 game
  pixels carries **two orbs**, 6 pixels in radius, always opposite each other: one in the warm ramp,
  one in the cool ramp. Each leaves a short trail.
- ◀ held turns the pair anticlockwise, ▶ held clockwise, at a constant 1.75 turns per second (a half
  turn in about 0.29 s); both or neither hold it still. These numbers sit in one constants block in
  `duet/rules.ts`, chosen by eye.

| button | what it does |
|---|---|
| ◀ / ▶ held | turn the orbs |
| **START** | start a chapter from its ready screen; pause and resume |
| **SELECT** | on the pause screen: quit to the room (the score reached is sent) |
| **A** | on the game over screen: play again |
| **B** | on the ready and game over screens: back to the room (once play has started, the score reached is sent) |

The keys come from the arcade's own input (`keyAction`, `createHeld()`, the handheld's D-pad), as
for the other games. No new control.

### The blocks and the waves

- **A block** is an axis-aligned rectangle in the Entropy look (the blob's ramp and spikes along its
  edges), falling straight down at the wave's speed. A block may also **slide** (moving left and
  right between two bounds) or **turn** (spinning about its centre at a constant rate).
- **A wave** is a set of blocks that enter together from the top. A wave is **passed** when its last
  block has fallen entirely below the circle without touching an orb. Waves follow each other with a
  gap set per wave.
- **A hit** is any overlap between an orb's circle and a block's rectangle (turned blocks tested in
  the block's own frame). A hit costs a life.
- **Four chapters**, each about ten waves, written by hand in `duet/waves.ts` as text, one wave per
  entry, with the legend above them:
  - **I · DRIFT**: still blocks, the speed rising wave after wave;
  - **II · SLIDE**: sliding blocks join;
  - **III · SPIN**: turning blocks join;
  - **IV · STORM**: all three, faster.
- **Every wave is passable:** for every chapter wave, and for the endless waves of the seed, a check
  proves at least one way of turning the orbs, at their turning speed and starting from where the
  previous wave can leave them, gets through it. `waveProblems` names any wave that fails, and
  `waves.test.ts` runs it on every chapter wave and on the first 200 endless waves of the seed.
- **Endless:** once chapter IV's last wave is passed, the run enters **endless mode**: waves drawn
  from a fixed seed (`ENDLESS_SEED`, one constant, the same for every player), at chapter IV's
  speed or above, rising slowly, and never ending.

### Lives and the score

- **Three lives.** A hit in a chapter costs a life and restarts **that chapter from its first wave**;
  the score goes back to **what it was when the chapter began**. A hit in endless mode costs a life
  and restarts endless mode at the wave that was hit; the score goes back to what it was when that
  wave began.
- **The invariant:** no sequence of hits can leave a score higher than the same run without them. A
  life lost only ever takes points away or leaves them as they were.
- **Score:** **+10 for each wave passed** in a chapter, **+20 for each wave passed** in endless mode.
  Nothing else scores.
- **The game ends** at the last life lost, when the player quits from the pause screen, or when B
  leaves a ready screen once play has started. Every way, the score reached is sent **once**, through the account's `submitScore('duet', score)`, with
  the same saving, NEW BEST, best and not saved states with a retry that ENTROPY INVADERS uses
  (`scenes/invaders-score.ts`).
- No database change: `arcade_scores.game` takes any key matching `^[a-z0-9-]{1,32}$`, scores are
  higher-is-better, and `submit_score()` checks the player's unlocks.

### The run

The run is a phase machine:

1. **`ready`:** `CHAPTER I · DRIFT · LIVES ×3 · PRESS START`. It shows at the start of the game and
   after every life lost (with the chapter, or `ENDLESS ×2`, and the lives left). Only START starts
   play.
2. **`play`:** the text layer shows the score, `CH II · 4/10` (or `ENDLESS ×2 · WAVE n`), and the
   lives left.
3. **`chapter`:** passing a chapter's last wave shows `CHAPTER III · SPIN` for 2 seconds, during which
   nothing falls, then play goes on. After chapter IV it shows `ENDLESS · ×2`.
4. **`paused`:** START pauses. Leaving the scene, a blurred window or a hidden tab pause too, and
   clear the buttons held. Only START resumes.
5. **`over`:** the score, the waves passed, the chapter or endless wave reached, and the score's send
   state. A plays again (from chapter I, three lives, score 0); B goes back to the room.

The text layer (DOM over the canvas, like every arcade scene) draws the HUD, the ready, chapter,
pause and game over screens, and the loading and failure lines, on both grids.

### Sound

None in this PRD, the same as the other games.

## Decisions

- **Original, never a replica.** No *Duet* name, art, levels, chapter names or music. The game is
  OMNI DUET, the obstacles are Entropy blocks, the centre is the Omni Loop crest, and the chapters
  are DRIFT, SLIDE, SPIN and STORM.
- **Its own engine over Phaser or the DOM.** The person chose it from three approaches. The geometry
  is two circles and a few rectangles: Phaser's physics would do nothing for it behind a 350 KB
  chunk, and its variable step makes determinism harder. DOM blocks would collide imprecisely and
  stutter on phones. A pure simulation tests like ENTROPY INVADERS' and OMNI KART's engines.
- **Fixed sub-steps.** SUPER OMNI WORLD showed that a screen at 120 frames a second changes how a
  game plays when timing follows frames. Fixed 1/60 s steps make the run the same at any frame rate,
  and a test pins it.
- **Three lives, chapters, then endless ×2.** The person's choice: four chapters played one after
  another, then endless mode at a high difficulty where each wave is worth double.
- **A life lost restarts the chapter and restores its score.** The person chose it over keeping the
  score: replaying never earns more, which closes the farming route SUPER OMNI WORLD left open. In
  endless mode, which has no chapter, the wave that was hit is the restart point, with the same rule.
- **Waves only score.** The person chose it over a graze bonus and a chapter bonus: +10 a wave, +20
  in endless mode. One rule, easy to read, nothing to farm.
- **Four chapters of about ten waves**, the person's choice: endless mode arrives after about four
  minutes of play.
- **The wide grid shows a scrolling window of three cabinets**, the person's choice over four
  smaller cabinets or a 2×2 grid: no cabinet shrinks, and later games fit the same way.
- **One playfield on both grids**, so a score means the same on a phone and a computer.
- **A life lost goes back to a ready screen.** P-PRODUCT-53: play never resumes on its own after a
  setback. The design first resumed after 1 second; it was changed to the ready screen.
- **Quitting from the pause sends the score reached.** P-PRODUCT-54: every way a game can end saves
  the score reached. The design first sent nothing on quitting; it was changed.
- **The voice objected on the design:** *"I already see omni-loop as a gimmick, fluff (persona:B-E
  DEv). A fourth game is more team time on the arcade rather than the tool, and it should at least
  weigh nothing for the people who never play it (persona:B-E DEv)."* Settled **none**: the person
  approved the design without answering it. The design already loads `arcade/duet/` only when the
  cabinet opens, as OMNI KART does.
- **No proof video:** the person said no.
- **Cut from this PRD:** a graze bonus, chapter bonuses, sound and music, a level editor, daily seeds,
  more than four chapters, a practice mode or chapter select, touch controls beyond the handheld's
  D-pad and buttons, the play dock, a cabinet attract of its own.

## User stories

1. As a player at LV 4 or above, I open the OMNI DUET cabinet and play chapter I with two orbs
   around the Omni Loop crest, turning them with ◀ ▶ through falling Entropy blocks.
2. As a player below LV 4, I see the fourth cabinet locked with `REACH LV 4 TO PLAY`.
3. As a player on a computer, I move the room's cursor to the fourth cabinet and the row of cabinets
   scrolls to show it.
4. As a player, I lose a life in chapter III, my score goes back to what it was when chapter III
   began, and I start chapter III again when I press START.
5. As a player, I clear chapter IV, enter endless mode, and every wave I pass is worth 20.
6. As a player, I lose my last life, quit from the pause, or leave after a life lost, and see my
   score saved.
7. As a player on a phone, my run plays exactly like it would on a computer.
8. As someone who opens the arcade and never plays OMNI DUET, my browser never downloads its engine.

## Scope

In: everything under **Solution**. Out: everything under **Decisions › Cut**, any change to the XP
curve or levels, any database migration, any change to ENTROPY INVADERS, SUPER OMNI WORLD, OMNI
KART or the play dock.

## Test seams

Tests live beside the code as `*.test.ts` and run with `pnpm test`. They never call Supabase or
GitHub, and never need a canvas: everything below `art.ts` and the scene's drawing is pure.

- **The orbs** (`duet/rules.test.ts`): ◀ turns anticlockwise and ▶ clockwise at the constant speed;
  both or neither hold still; the orbs stay opposite on the circle.
- **Collisions** (`duet/collide.test.ts`): a circle and a rectangle overlap or not, at the edges and
  the corners; a turned block is tested in its own frame; an orb that grazes a block without
  overlapping it is no hit.
- **The waves** (`duet/waves.test.ts`): the wave texts parse and use only legend characters, and an
  unknown character is refused with its chapter, wave and position. Each chapter has about ten
  waves. `waveProblems` passes every chapter wave and the first 200 endless waves of `ENDLESS_SEED`,
  and names a deliberately impassable wave.
- **The run** (`duet/run.test.ts`): ready, then play only on START. A wave passed scores 10 in a
  chapter and 20 in endless mode, once. A hit costs a life, restarts the chapter, restores the
  chapter's starting score and shows the ready screen; play waits for START. In endless mode a hit
  restarts the wave hit and restores that wave's starting score. Chapter IV's last wave leads to
  endless mode. The last life lost ends the game. START pauses, an outside pause pauses, and only
  START resumes. Quitting from the pause ends the game, and so does B on a ready screen once play has started; B on
  the first ready screen leaves with no score.
- **No death earns a point:** for every wave of the four chapters and the first 50 endless waves, a
  run that is hit at that wave never ends with a higher score than the same inputs without the hit.
- **Determinism:** the same seed and inputs give the same run; the same inputs stepped at 1/60 s and
  at 1/120 s give the same run and the same score.
- **The score is sent once** (`duet/run.test.ts` and `scenes/duet.test.ts`): on the move into
  `over`, whichever route led there, and never twice.
- **The room** (extends `games/room.test.ts`, and the rulebook tests that pin `xp.unlocks`:
  `game/rulebook.test.ts`, `game/experience.test.ts`, `packages/galaxy/src/galaxy.test.ts`): the
  fourth cabinet is OMNI DUET, refused with `REACH LV 4 TO PLAY` at LV 3 and open at LV 4; on the
  wide grid the window holds cabinets 1–3 with the cursor on 1 to 3 and 2–4 with it on 4.
- **The text layer** (`scenes/duet.test.ts`, and `scenes/theme.test.ts` on both grids): loading, the
  failure line and A to retry, the ready screen with chapter and lives, the HUD, the chapter and
  endless banners, the pause, the game over screen, and the score's saving, NEW BEST, best and not
  saved states.
- **Loaded on demand:** a test reads the static import graph of the arcade's entry and fails if any
  file outside `arcade/duet/` imports from it at run time; type-only imports are allowed.
- **By a person, in the browser:** how the turning speed and the waves feel, all four chapters
  played into endless mode, on a computer (wide grid) and on a phone's handheld (tall grid).

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) with a new chunk loaded only when the OMNI
  DUET cabinet opens, the room's scrolling window on the wide grid, and a rulebook change. The next
  `pnpm game:xp` run unlocks `duet` for every player at LV 4 or above. No migration.
- **Rollback:** revert the feature PR. A `duet` key left in `player_xp.unlocked` and scores left in
  `arcade_scores` are harmless: the room draws only the games `GAMES` lists.
- **Balance:** waves too hard or too easy. The turning speed, the orb size and the speeds sit in one
  constants block in `duet/rules.ts` and the waves in one text file, so a follow-up tunes them
  without touching the engine; `waveProblems` keeps every wave passable whatever the tuning.
- **The room on the wide grid:** the scrolling window changes a screen every player sees. Its test
  pins which cabinets show for each cursor position.

## Acceptance criteria

1. With the rulebook at `duet: 4`, a player at LV 3 sees the fourth cabinet, OMNI DUET, refused with
   `REACH LV 4 TO PLAY`, and at LV 4 the cabinet opens the game.
2. On the wide grid, moving the room's cursor to the fourth cabinet scrolls the row so cabinets 2–4
   show; moving it back to the first shows cabinets 1–3. The tall grid still shows one cabinet a page.
3. `CHAPTER I · DRIFT · LIVES ×3 · PRESS START` waits for START; then ◀ and ▶ held turn the two
   opposite orbs around the Omni Loop crest, on the wide and the tall grid.
4. Each wave passed adds 10 in chapters I to IV and 20 in endless mode, and the HUD shows the score,
   the chapter and wave (or `ENDLESS ×2 · WAVE n`) and the lives left.
5. A block touching an orb costs a life, the score goes back to its value at the start of the
   chapter (or, in endless mode, of the wave hit), and the ready screen waits for START.
6. Passing chapter IV's last wave shows `ENDLESS · ×2` and starts endless mode.
7. Losing the last life, SELECT on the pause screen, or B on a ready screen once play has started
   ends the game and sends the score reached once under `duet`, showing saving, then NEW BEST, best or not saved with a retry.
8. START pauses and only START resumes; a blurred window, a hidden tab or leaving the scene pause the
   game too.
9. Every chapter wave and the first 200 endless waves pass `waveProblems`, and no hit at any tested
   wave leaves a higher score than the same run without it.
10. The same inputs give the same run and score at 60 and at 120 frames a second.
11. A page that never opens the OMNI DUET cabinet never downloads `arcade/duet/`, and the guard test
    proves it; a failed load shows `GAME DID NOT LOAD · A TO RETRY`, A retries, and B goes back to
    the room.
