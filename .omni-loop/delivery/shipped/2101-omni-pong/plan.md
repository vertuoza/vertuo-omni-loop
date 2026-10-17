# Plan: OMNI PONG, a voice-controlled Pong unlocked at LV 5

PRD #2101, specified in [`spec.md`](./spec.md) beside this plan. The feature branch `feat/omni-pong`
merges into `main` through the feature PR (`Closes #2101`). Each slice is a sub-PR from
`feat/omni-pong--<slice>` into the feature branch (`Part of #2101`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The game room stands a fifth cabinet, OMNI PONG, locked below LV 5, and the wide grid's window shows cabinets 3–5 with the cursor on the fifth | `game/rulebook.ts` `game/rulebook.test.ts` `game/experience.test.ts` `packages/galaxy/src/galaxy.test.ts` `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/scenes/games*` `apps/galaxy/src/arcade/scenes/menu.test.ts` `apps/galaxy/src/arcade/levelup.test.ts` `apps/galaxy/src/arcade/measure.guard.test.ts` | — | 1 |
| s2 | The voice is read: `pitchOf` turns samples into a pitch or null, `steerOf` turns a pitch and a limit into up, down or still with its ±10 Hz band, and the LOW / MID / HIGH limit is kept in the browser | `apps/galaxy/src/arcade/pong/pitch*` `apps/galaxy/src/arcade/pong/steer*` `apps/galaxy/src/arcade/pong/options*` `apps/galaxy/src/arcade/pong/rules*` | — | 1 |
| s3 | The match against the AI, pure and seeded: bounces, the speed-up to its cap, the AI's delay and top speed, a point per AI miss, three conceded end it, no conceded point ever adds, the same match at 60 and 120 frames a second | `apps/galaxy/src/arcade/pong/match*` `apps/galaxy/src/arcade/pong/rules*` | s2 | 2 |
| s4 | OMNI PONG's cabinet opens at LV 5, loads the game on demand, and the ready screen sets the limit, turns on the microphone, shows the pitch meter live, or reads MIC REQUIRED with its reason | `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/scenes/common.ts` `apps/galaxy/src/arcade/scenes/index*` `apps/galaxy/src/arcade/scenes/pong*` `apps/galaxy/src/arcade/scenes/theme.test.ts` `apps/galaxy/src/arcade/onboarding*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/pong/mic*` `apps/galaxy/src/arcade/pong/index*` `apps/galaxy/src/arcade/pong/art*` `apps/galaxy/src/arcade/pong/guard*` | s1, s2 | 2 |
| s5 | The match is played in the scene: the voice steers the paddle, the HUD and the steering sign, the pause and MIC LOST with the microphone stopped, the game over screen and the score sent once, the microphone policy pinned, and the README's fifth game | `apps/galaxy/src/arcade/pong/` `apps/galaxy/src/arcade/scenes/pong*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` | s3, s4 | 3 |

**Shared ground.** The slices build one game, so most of them share ground and run one after another:

- `apps/galaxy/src/arcade/games/` (`index.ts` and `room.test.ts`): s1 (the fifth row with no scene
  yet, and the window's test on five cabinets) and s4 (the row's `scene: 'pong'`, and the cabinet
  opening at LV 5). Waves 1 and 2.
- `apps/galaxy/src/arcade/pong/rules*`: s2 (the three limits and the band) and s3 (the ball, the
  paddles and the AI). Waves 1 and 2.
- `apps/galaxy/src/arcade/pong/` and `apps/galaxy/src/arcade/scenes/pong*`: s2 and s3 own their own
  files in wave 1 and 2, s4 its own files and the scene in wave 2, and s5 the whole folder and the
  scene in wave 3. s3 and s4 name disjoint files of the folder, so they share wave 2.
- `apps/galaxy/src/arcade/ArcadeApp.tsx`: s4 (the scene's loading, frame loop, presses,
  `HELD_SCENES`) and s5 (the outside pause, the microphone stopped, the score sent once). Waves 2
  and 3.
- The tests that pin the registry and the unlocks (`game/rulebook.test.ts`, `game/experience.test.ts`,
  `packages/galaxy/src/galaxy.test.ts`, `scenes/games.test.ts`, `scenes/menu.test.ts`,
  `levelup.test.ts`, `measure.guard.test.ts`) belong to s1 alone: s1 adds the row and the unlock, so
  every test that counts games or unlocks is updated once.

## Per slice: done when

**s1** (`ui: yes`)
- The rulebook's `xp.unlocks` is `{ invaders: 1, platformer: 2, kart: 3, duet: 4, pong: 5 }`, and
  every test that pins it says so.
- `GAMES` lists `{ id: 'pong', title: 'OMNI PONG', scene: null, measure: 'points' }` fifth. At LV 4
  the fifth cabinet refuses with `REACH LV 5 TO PLAY`; at LV 5 it refuses with the room's existing
  line for a game with no scene yet.
- On the wide grid the window shows cabinets 3–5 with the cursor on the fifth; a test pins the
  window for every cursor position on five cabinets. The tall grid still shows one cabinet a page.
- `measure.guard.test.ts` still passes: `pong` is points.

**s2** (`ui: yes`)
- `pitchOf(samples, sampleRate)` reads synthesised sines at 110, 165, 220, 330 and 660 Hz, at 44.1
  and 48 kHz, within 2 %; a sine with harmonics reads its fundamental; silence, a sine under the
  loudness floor and white noise read `null`. It looks between 70 and 1000 Hz.
- `steerOf(hz, limit)`: for each of 160, 220 and 300 Hz, 11 Hz above is `up`, 11 Hz below is `down`,
  the limit and ±9 Hz are `still`, `null` is `still`.
- `options.ts`: `MID` by default; ◀ ▶ step through `LOW`, `MID`, `HIGH` and stop at the ends; the
  choice is read back from `omni-loop:pong-options`; missing, broken or refusing storage gives `MID`.
- The limits and the band sit in `pong/rules.ts`.

**s3** (`ui: yes`)
- `match.ts` is pure and seeded: the ball bounces off the walls and both paddles; each return speeds
  it up by the factor, up to the cap; the AI's paddle never moves faster than its top speed and
  follows the ball with its delay.
- An AI miss adds one point; a point conceded costs a life and never changes the score; the third
  conceded moves the match to `over`; after each point the ball is served from the centre after one
  second, toward the side that conceded.
- For 200 seeds, a match where the player concedes at a given rally never ends higher than the same
  steering without the miss; with a player that returns every ball, the AI misses before the ball
  reaches its cap.
- The same seed and steering give the same match and score stepped at 1/60 s and at 1/120 s.

**s4** (`ui: yes`)
- `GAMES`' fifth row has `scene: 'pong'`; at LV 5, A on the cabinet opens the `pong` scene. `pong` is
  a scene name, a signed-in-only scene and a held-buttons scene.
- Opening the cabinet imports `arcade/pong/` with a dynamic `import()`, `LOADING…` meanwhile; a
  failed import shows `GAME DID NOT LOAD · A TO RETRY`, A retries, B goes back to the room. A guard
  test fails when a file outside `arcade/pong/` imports from it at run time; type-only imports pass.
- `mic.ts` is the one file that calls `getUserMedia` (echo cancellation, noise suppression and auto
  gain off) and Web Audio, behind a `PitchSource` port with a fake for tests.
- The ready screen reads `OMNI PONG`, `◀ PITCH · MID ▶`, `HIGH ▲ · LOW ▼` and `A · TURN ON MIC`; ◀ ▶
  change the limit, kept after a reload. Granted, the pitch meter shows ▲, · or ▼ live and the screen
  reads `START · PLAY`. Refused, missing or insecure, it reads `MIC REQUIRED` with
  `MIC BLOCKED IN THE BROWSER` or `NO MIC FOUND`, A asks again, B goes back, and START starts
  nothing.
- Leaving the scene stops the microphone's track. `theme.test.ts` passes on both grids.

**s5** (`ui: yes`)
- START on the ready screen starts the match: a sound above the band moves the player's paddle up,
  one below moves it down, silence holds it still, at one speed; the HUD shows the score and the
  lives, and the steering sign sits beside the paddle.
- START pauses and only START resumes; a blurred window, a hidden tab or leaving the scene pauses
  too; the microphone is stopped while paused and asked for again on resume.
- A microphone track that ends during a match pauses it with `MIC LOST · A TO RETRY`.
- The third point conceded or SELECT · QUIT on the pause sends `submitScore('pong', points)` once,
  whichever route, and the game over screen shows saving, then NEW BEST, the best, or
  `SCORE NOT SAVED · A TO RETRY`; A plays again with the microphone kept, B goes back to the room.
- A test pins that `apps/galaxy/next.config.ts` and `apps/galaxy/vercel.json` send no
  `Permissions-Policy` that blocks the microphone on `/play`.
- `apps/galaxy/README.md`'s game room names the fifth game, OMNI PONG, opened at LV 5.
