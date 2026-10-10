# Plan: OMNI KART, a Mode 7 kart racer unlocked at LV 3

PRD #1359, specified in [`spec.md`](./spec.md) beside this plan. The feature branch `feat/omni-kart`
merges into `main` through the feature PR (`Closes #1359`). Each slice is a sub-PR from
`feat/omni-kart--<slice>` into the feature branch (`Part of #1359`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | OMNI KART's cabinet opens at LV 3, loads the game on demand, and shows COMET RING in Mode 7 on the ready screen | `game/rulebook.ts` `game/rulebook.test.ts` `game/experience.test.ts` `packages/galaxy/src/galaxy.test.ts` `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/scenes/common.ts` `apps/galaxy/src/arcade/scenes/index*` `apps/galaxy/src/arcade/scenes/kart*` `apps/galaxy/src/arcade/scenes/games.test.ts` `apps/galaxy/src/arcade/scenes/menu.test.ts` `apps/galaxy/src/arcade/scenes/theme.test.ts` `apps/galaxy/src/arcade/onboarding*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/kart/` | — | 1 |
| s2 | The player's kart drives COMET RING: the countdown, steering, speed, grass, walls, the camera behind the kart, and the pause | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `packages/design/src/sprites*` | s1 | 2 |
| s3 | Five rivals race: the workspace's fleets follow the racing line, karts push each other apart, laps count along the line, and the HUD shows the place, `LAP n/3`, the time and `FINAL LAP` | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart*` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s2 | 3 |
| s4 | The finish: crossing the line at the end of lap 3 shows the results table, and the score is sent once under `kart` | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart*` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s3 | 4 |
| s5 | Item boxes: BOOST, BLOB and ORB, taken and used by the player and the rivals, the item held in the HUD, and the README's third game | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart*` `packages/design/src/sprites*` `apps/galaxy/README.md` | s3 | 5 |

**Shared ground.** Every slice builds the same game, so they share ground and run one after another:

- `apps/galaxy/src/arcade/kart/` and `apps/galaxy/src/arcade/scenes/kart*`: all five slices. One
  slice per wave keeps them apart.
- `apps/galaxy/src/arcade/ArcadeApp.tsx`: s1 (the scene's loading, frame loop and presses), s2 (the
  pause from blur, hidden tab and leaving), s3 (the cast read from the workspace's fleets) and s4
  (the score sent once). Waves 1 to 4.
- `packages/design/src/sprites*` (`sprites.ts` and the forged digests in `sprites.test.ts`): s2
  (the kart) and s5 (the ORB). Waves 2 and 5.
- s5 is blocked only by s3 (rivals use items), and waits for wave 5 because its territory meets
  s4's.
- `apps/omni-app/api/` is built from `packages/design/`, so s2 and s5 rebuild it only to test and
  commit none of it.

## Per slice: done when

### s1: the cabinet opens and COMET RING shows in Mode 7

- The rulebook's `xp.unlocks` is `{ invaders: 1, platformer: 2, kart: 3 }`, and every test that pins
  it says so.
- `GAMES` lists `{ id: 'kart', title: 'OMNI KART', scene: 'kart' }` third. At LV 2 the third cabinet
  is OMNI KART and refuses with `REACH LV 3 TO PLAY`. At LV 3, A on it opens the `kart` scene. The
  room still stands three cabinets, and none says `SOON`.
- `kart` is a scene name, a signed-in-only scene, a held-buttons scene and a tall scene. A signed-out
  player is bounced as from the other games.
- Opening the cabinet imports `arcade/kart/` with a dynamic `import()`, showing `LOADING…` meanwhile.
  A failed import shows `GAME DID NOT LOAD · A TO RETRY`: A retries, B goes back to the room, and the
  error is logged with `console.error`.
- A guard test (`arcade/kart/`) reads the arcade's static import graph and fails when a file outside
  `arcade/kart/` imports from it at run time. Type-only imports pass.
- COMET RING is a text map in `kart/track.ts` with its legend, waypoints and par time (150 s).
  `trackProblems()` passes it, and refuses each broken case with the row and column:
  - an unknown character, or rows of unequal length;
  - a waypoint off the road, or two consecutive waypoints not joined by road;
  - not exactly six starting places behind the line;
  - a start line that does not cross the road from wall to wall;
  - an item box off the road.
- `kart/mode7.ts` passes its tests:
  - nothing is drawn on the floor above the horizon;
  - a point straight ahead lands on the centre column, higher the farther it is;
  - a floor pixel maps back to its point within a pixel;
  - a quarter turn turns the sampling;
  - a sprite behind the camera is not drawn, and a sprite's size is in inverse proportion to its
    distance.
- On the wide and the tall grid, the ready screen shows `COMET RING · 3 LAPS · PRESS START` over the
  circuit in Mode 7 seen from the player's starting place, under the Omni sky. The circuit's
  texture is drawn once, from `@omni/design` ramps.
- `scenes/theme.test.ts` passes on both grids (ADR-0046).

### s2: the player's kart drives

- START on the ready screen runs `3 · 2 · 1 · GO` over 3 seconds, and A before GO moves nothing.
- With A held, the kart accelerates up to its top speed. Released, it slows. ▼ brakes, then
  reverses once stopped.
- ◀ ▶ do not turn a kart at rest, and turn a fast kart less than a slow one. Grass halves the top
  speed.
- A wall stops the speed going into it and bounces the kart off. A kart at top speed stepped 50 ms
  at a time never ends up inside or beyond a wall. `dt` is capped at 50 ms and played in fixed
  sub-steps.
- The camera follows behind the player's kart and the floor turns with it. The sky scrolls
  sideways as the kart turns.
- The kart is a new `@omni/design` sprite: seen from behind, leaning left and leaning right, two
  frames each. Its forged digest is recorded in `sprites.test.ts`. The player drives their own
  hero in a kart tinted with the hero's suit.
- START pauses, and only START resumes. A blurred window, a hidden tab or leaving the scene pause
  the race and clear the buttons held. SELECT on the pause screen goes back to the room and sends
  nothing.
- The same seed and inputs give the same race.

### s3: five rivals, laps and places

- Six karts stand on the grid, the player on the last starting place.
- The rivals are the workspace's fleets other than the player's, each driven by its mascot in its
  fleet's colour (`fleetSprite`). With fewer than five other fleets, the next unused mascots of
  `MASCOTS` fill the places.
- A rival is drawn with the kart view closest to the angle the camera sees it from.
- Each rival follows the racing line, off it by a seeded amount. Its top speed is between 92% and
  100% of the player's, and the rubber band never moves it by more than 5%.
- A rival alone on COMET RING completes three laps within twice the par time.
- Two touching karts are pushed apart, as two circles.
- **Laps:** a lap counts when a kart crosses the start line forwards after every waypoint in order.
  Backwards, or after skipping a waypoint, it counts nothing.
- **Places** follow progress along the racing line.
- **The HUD** shows the place (1ST to 6TH), `LAP n/3` and the race time, and `FINAL LAP` when the
  third lap starts.

### s4: the finish and the score

- Crossing the line at the end of lap 3 ends the race on the results table: six places, each
  driver and their time. Rivals still racing are placed by progress, with `--` for a time.
- The score is the place points (1000, 700, 500, 350, 200, 100) plus 1 point per tenth of a second
  under 150 seconds, and 0 bonus at or over it.
- It is sent once through `submitScore('kart', score)`. The text layer shows SAVING SCORE…, then
  NEW BEST, YOUR BEST n or SCORE NOT SAVED, and A retries a failed send once (`invaders-score.ts`).
- From the results, A races again with a new seed, and B goes back to the room.
- Quitting from the pause screen before the finish sends nothing.
- `scenes/kart.test.ts` covers the results table and every send state.

### s5: items, and the README

- Two rows of four item boxes stand across the road. A box gives one item to a kart holding none,
  then disappears for 3 seconds. The draw follows the seed and is weighted by place: leaders get
  more BLOBs, the karts behind more BOOSTs and ORBs.
- **BOOST:** 1.5 seconds at 1.4 times the top speed, on grass too.
- **BLOB:** an Entropy blob dropped behind. The first kart over it spins out and the BLOB is gone.
  A seventh removes the oldest.
- **ORB:** a new 16×16 `@omni/design` sprite, with its forged digest. It is thrown straight ahead
  at twice the top speed and bounces off walls. It is gone at its third bounce, after 4 seconds, or
  on hitting a kart, which spins out.
- **A spin-out** lasts 1 second at 30% of the speed, takes no input, and never stops the race.
- B uses the player's item. The HUD shows the item held.
- **Rivals** use their items by rule:
  - a BOOST at once on a straight;
  - a BLOB when a kart is close behind;
  - an ORB when a kart is ahead, in range and roughly in line.
- `apps/galaxy/README.md` › The game room describes OMNI KART, and its LV 1 / LV 2 summary names
  LV 3.
