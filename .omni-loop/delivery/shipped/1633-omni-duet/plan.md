# Plan: OMNI DUET, a two-orb dodge game unlocked at LV 4

PRD #1633, specified in [`spec.md`](./spec.md) beside this plan. The feature branch `feat/omni-duet`
merges into `main` through the feature PR (`Closes #1633`). Each slice is a sub-PR from
`feat/omni-duet--<slice>` into the feature branch (`Part of #1633`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The game room stands a fourth cabinet, OMNI DUET, locked below LV 4, and the wide grid shows a window of three cabinets that scrolls with the cursor | `game/rulebook.ts` `game/rulebook.test.ts` `game/experience.test.ts` `packages/galaxy/src/galaxy.test.ts` `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/scenes/games*` `apps/galaxy/src/arcade/scenes/menu.test.ts` `apps/galaxy/src/arcade/levelup.test.ts` `apps/galaxy/src/arcade/measure.guard.test.ts` | — | 1 |
| s2 | OMNI DUET's cabinet opens at LV 4, loads the game on demand, and the two orbs turn around the Omni Loop crest with ◀ ▶ from the ready screen, in fixed steps, on both grids | `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/scenes/common.ts` `apps/galaxy/src/arcade/scenes/index*` `apps/galaxy/src/arcade/scenes/duet*` `apps/galaxy/src/arcade/scenes/theme.test.ts` `apps/galaxy/src/arcade/onboarding*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/duet/` | s1 | 2 |
| s3 | Waves of Entropy blocks fall through chapters I to IV: blocks still, sliding and turning, every wave passable, +10 a wave, and a hit costs a life, restarts the chapter with its starting score and goes back to the ready screen | `apps/galaxy/src/arcade/duet/` `apps/galaxy/src/arcade/scenes/duet*` | s2 | 3 |
| s4 | Endless mode at +20 a wave after chapter IV, the pause, every way a game ends sending the score reached once, the game over screen, the no-death-earns-a-point test, and the README's fourth game | `apps/galaxy/src/arcade/duet/` `apps/galaxy/src/arcade/scenes/duet*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` | s3 | 4 |

**Shared ground.** The slices build one game, so they share ground and run one after another:

- `apps/galaxy/src/arcade/games/` (`index.ts` and `room.test.ts`): s1 (the fourth row with no scene
  yet, the scrolling window and its test) and s2 (the row's `scene: 'duet'`, and the cabinet opening
  at LV 4). Waves 1 and 2.
- `apps/galaxy/src/arcade/duet/` and `apps/galaxy/src/arcade/scenes/duet*`: s2, s3 and s4. One slice
  per wave keeps them apart.
- `apps/galaxy/src/arcade/ArcadeApp.tsx`: s2 (the scene's loading, frame loop, presses, `HELD_SCENES`)
  and s4 (the outside pause and the score sent once). Waves 2 and 4.
- The tests that pin the registry and the unlocks (`game/rulebook.test.ts`, `game/experience.test.ts`,
  `packages/galaxy/src/galaxy.test.ts`, `scenes/games.test.ts`, `scenes/menu.test.ts`,
  `levelup.test.ts`, `measure.guard.test.ts`) belong to s1 alone: s1 adds the row and the unlock, so
  every test that counts games or unlocks is updated once.

## Per slice: done when

### s1: the fourth cabinet and the scrolling window

- The rulebook's `xp.unlocks` is `{ invaders: 1, platformer: 2, kart: 3, duet: 4 }`, and every test
  that pins it says so.
- `GAMES` lists `{ id: 'duet', title: 'OMNI DUET', scene: null, measure: 'points' }` fourth. At LV 3
  the fourth cabinet refuses with `REACH LV 4 TO PLAY`; at LV 4 it refuses with
  `OMNI DUET · COMING SOON` (the room's existing line for a game with no scene yet).
- On the wide grid the room shows three cabinets: cabinets 1–3 with the cursor on 1 to 3, cabinets
  2–4 with it on 4, at today's size; a test pins the window for every cursor position. The tall grid
  still shows one cabinet a page, and ◀ ▶ still reach all four.
- `measure.guard.test.ts` still passes: `duet` is points, so the SQL list of lowest-wins games is
  unchanged.

### s2: the cabinet opens and the orbs turn

- `GAMES`' fourth row has `scene: 'duet'`; at LV 4, A on the cabinet opens the `duet` scene.
- `duet` is a scene name, a signed-in-only scene and a held-buttons scene. A signed-out player is
  bounced as from the other games.
- Opening the cabinet imports `arcade/duet/` with a dynamic `import()`, showing `LOADING…` meanwhile.
  A failed import shows `GAME DID NOT LOAD · A TO RETRY`: A retries, B goes back to the room, and the
  error is logged with `console.error`.
- A guard test reads the arcade's static import graph and fails when a file outside `arcade/duet/`
  imports from it at run time. Type-only imports pass.
- `duet/rules.ts` holds the constants block (circle radius 56, orb radius 6, 1.75 turns a second).
  ◀ held turns the pair anticlockwise, ▶ clockwise, both or neither hold still, and the orbs stay
  opposite.
- `step(run, held, dt)` plays fixed 1/60 s sub-steps, carries the remainder, caps `dt` at 50 ms; the
  same inputs stepped at 1/60 s and at 1/120 s give the same orb angle.
- The ready screen shows `CHAPTER I · DRIFT · LIVES ×3 · PRESS START`; START starts play, B goes back
  to the room. The 320×288 playfield fills the tall grid and sits centred on the wide grid with the
  Omni sky on its sides; `scenes/theme.test.ts` covers both grids.

### s3: the chapters, the hits and the score

- `duet/collide.ts`: a circle and a rectangle overlap or not at the edges and the corners; a turned
  block is tested in its own frame; a graze that does not overlap is no hit.
- `duet/waves.ts` holds chapters I · DRIFT, II · SLIDE, III · SPIN and IV · STORM, about ten waves
  each, as text with the legend above them. An unknown character is refused with its chapter, wave
  and position. `waveProblems` passes every chapter wave and names a deliberately impassable one.
- Blocks fall at the wave's speed; sliding blocks move between their bounds; turning blocks spin. A
  wave passed (its last block below the circle, untouched) adds 10, once.
- A hit costs a life, restarts the chapter from its first wave, sets the score back to its value when
  the chapter began, and shows the ready screen with the chapter and the lives left; nothing moves
  until START.
- Passing a chapter's last wave shows its next chapter's banner for 2 seconds, during which nothing
  falls.
- The HUD shows the score, `CH n · w/10` and the lives left, on both grids.

### s4: endless mode, the end of a game and the score

- Passing chapter IV's last wave shows `ENDLESS · ×2` and starts endless mode: waves drawn from
  `ENDLESS_SEED`, each passed wave adding 20; `waveProblems` passes the first 200 endless waves.
- A hit in endless mode costs a life, restarts the wave hit and sets the score back to its value when
  that wave began; the ready screen shows `ENDLESS ×2` and the lives left.
- For every wave of the four chapters and the first 50 endless waves, a run hit at that wave never
  ends with a higher score than the same inputs without the hit.
- START pauses, a blurred window, a hidden tab or leaving the scene pause too and clear the buttons
  held; only START resumes.
- The last life lost, SELECT on the pause screen, and B on a ready screen once play has started each
  end the game; B on the first ready screen leaves with no score. On the move into `over` the score
  reached is sent once under `duet`, whichever route led there, never twice.
- The game over screen shows the score, the waves passed, the chapter or endless wave reached and the
  send state (saving, NEW BEST, best, not saved with a retry); A plays again from chapter I with three
  lives and score 0, B goes back to the room.
- `apps/galaxy/README.md` names OMNI DUET from LV 4 in its game room section.
