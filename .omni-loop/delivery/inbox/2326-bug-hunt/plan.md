# Plan: BUG HUNT, a first-person bug shooter unlocked at LV 6

PRD #2326, specified in [`spec.md`](./spec.md) beside this plan. The feature branch `feat/bug-hunt`
merges into `main` through the feature PR (`Closes #2326`). Each slice is a sub-PR from
`feat/bug-hunt--<slice>` into the feature branch (`Part of #2326`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The game room stands a sixth cabinet, BUG HUNT, locked below LV 6, and the wide grid's window shows cabinets 4–6 with the cursor on the sixth | `game/rulebook.ts` `game/rulebook.test.ts` `game/experience.test.ts` `packages/galaxy/src/galaxy.test.ts` `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/scenes/games*` `apps/galaxy/src/arcade/scenes/menu.test.ts` `apps/galaxy/src/arcade/levelup.test.ts` `apps/galaxy/src/arcade/measure.guard.test.ts` `apps/galaxy/src/data/arcade.test.ts` `apps/galaxy/src/data/scores.test.ts` | — | 1 |
| s2 | The maze is seen in perspective: the 24×24 map and its zones, the raycaster's distance, side and column height per ray, and the view's size on both grids | `apps/galaxy/src/arcade/hunt/map*` `apps/galaxy/src/arcade/hunt/cast*` `apps/galaxy/src/arcade/hunt/rules*` | — | 1 |
| s3 | The bugs are seen in the maze: sprites ordered from the farthest to the nearest, scaled by distance and cut by the walls in front of them | `apps/galaxy/src/arcade/hunt/sprites*` | s2 | 2 |
| s4 | The hunt, pure and seeded: the player walks and slides along walls, a shot hits the first bug on the line, bugs walk the shortest path, waves grow, a touch costs a life, no lost life ever adds, the same hunt at 60 and 120 frames a second | `apps/galaxy/src/arcade/hunt/match*` `apps/galaxy/src/arcade/hunt/rules*` | s2 | 2 |
| s5 | The hunt is drawn: the cast walls, the ceiling and the floor, and the sprites enlarged 2× into a canvas on both grids, with the shake and flash dropped under reduced motion | `apps/galaxy/src/arcade/hunt/art*` | s3, s4 | 3 |
| s6 | BUG HUNT's cabinet opens at LV 6, loads the game on demand, and the hunt is played in the scene: the pad walks, turns and fires, with the HUD, WAVE n CLEARED and the crosshair | `apps/galaxy/src/arcade/games/` `apps/galaxy/src/arcade/hunt/index*` `apps/galaxy/src/arcade/hunt/guard*` `apps/galaxy/src/arcade/scenes/common.ts` `apps/galaxy/src/arcade/scenes/index*` `apps/galaxy/src/arcade/scenes/hunt*` `apps/galaxy/src/arcade/scenes/theme.test.ts` `apps/galaxy/src/arcade/grid.ts` `apps/galaxy/src/arcade/grid.test.ts` `apps/galaxy/src/arcade/onboarding*` `apps/galaxy/src/arcade/ArcadeApp.tsx` | s1, s5 | 4 |
| s7 | The hunt ends well: the pause, the game over screen and the score sent once, the sixth game in the README and the design drafts | `apps/galaxy/src/arcade/hunt/` `apps/galaxy/src/arcade/scenes/hunt*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` `.omni-loop/knowledge/design/screens/hunt-match*` `.omni-loop/knowledge/design/screens/game-room*` | s6 | 5 |

**Shared ground.** The slices build one game, so most of them share ground and run one after another:

- `apps/galaxy/src/arcade/games/` (`index.ts`, `stills.ts` and their tests): s1 (the sixth row with
  no scene yet, its still, and the window's test on six cabinets) and s6 (the row's `scene: 'hunt'`,
  and the cabinet opening at LV 6). Waves 1 and 4.
- `apps/galaxy/src/arcade/hunt/rules*`: s2 (the view's size on both grids) and s4 (the waves, the
  bugs, the player and the gun). Waves 1 and 2.
- `apps/galaxy/src/arcade/hunt/`: s2, s3, s4 and s5 own their own files of the folder in waves 1 to
  3 (s3 and s4 name disjoint files, so they share wave 2); s6 owns `index*` and `guard*` in wave 4,
  and s7 the whole folder in wave 5.
- `apps/galaxy/src/arcade/scenes/hunt*`: s6 (the scene group, its text layer and its HUD) and s7 (the
  pause and the game over layers). Waves 4 and 5.
- `apps/galaxy/src/arcade/ArcadeApp.tsx`: s6 (the scene's loading, frame loop, presses,
  `HELD_SCENES`) and s7 (the outside pause, the score sent once). Waves 4 and 5.
- The tests that pin the registry and the unlocks (`game/rulebook.test.ts`, `game/experience.test.ts`,
  `packages/galaxy/src/galaxy.test.ts`, `scenes/games*.test.ts`, `scenes/menu.test.ts`,
  `levelup.test.ts`, `measure.guard.test.ts`, `data/arcade.test.ts`, `data/scores.test.ts`) belong to
  s1 alone: s1 adds the row and the unlock, so every test that counts games, unlocks or score keys is
  updated once. The tests that pin the scenes and the grids (`scenes/index.test.ts`, `grid.test.ts`,
  `onboarding.test.ts`) belong to s6 alone.

## Per slice: done when

**s1** (`ui: yes`)
- The rulebook's `xp.unlocks` is `{ invaders: 1, platformer: 2, kart: 3, duet: 4, pong: 5, hunt: 6 }`,
  and every test that pins it says so.
- `GAMES` lists `{ id: 'hunt', title: 'BUG HUNT', scene: null, measure: 'points' }` sixth, with a
  still on its cabinet's screen. At LV 5 the sixth cabinet refuses with `REACH LV 6 TO PLAY`; at LV 6
  it refuses with the room's existing line for a game with no scene yet.
- On the wide grid the window shows cabinets 4–6 with the cursor on the sixth; a test pins the window
  for every cursor position on six cabinets. The tall grid still shows one cabinet a page.
- `measure.guard.test.ts` still passes: `hunt` is points. The score keys the arcade reads include
  `hunt`, and the tests that list them say so.

**s2** (`ui: no`)
- `map.ts` holds the 24×24 map: closed by walls on its four edges, every floor cell reachable from
  the player's start at the centre facing north, eight spawn cells that are floors out of the start's
  line of sight, and every wall cell in one of the four zones `CORE`, `API`, `UI`, `DB`.
- `cast.ts` returns, for each column of a view, the distance to the first wall: exact straight ahead,
  at 45°, along a wall and in a corner; two columns in front of a flat wall give the same
  perpendicular distance (no fish-eye); the wall's side picks the dark or the light shade; the column's
  height is the inverse of the distance; a ray never reads a cell outside the map.
- `rules.ts` holds the view's size: 320×180 on the wide grid and 160×144 on the tall one, enlarged 2×.

**s3** (`ui: no`)
- `sprites.ts` orders sprites from the farthest to the nearest; a sprite twice as far is half as big;
  a sprite behind a nearer wall (by the cast's depth per column) is cut by it, column by column; a
  sprite behind the player is not drawn.

**s4** (`ui: no`)
- `match.ts` is pure and seeded: the player starts at the centre facing north, ▲ ▼ walk, ◀ ▶ turn, B
  held steps to the side, and the player slides along a wall and never enters a wall cell.
- A shot, at most every third of a second, hits the first bug on the line of sight and none behind a
  wall; a `GNAT` dies in 1 hit for 10, a `BEETLE` in 3 for 30 and a `SPITTER` in 6 for 60.
- Wave 1 has 4 bugs and each wave adds 2; a `BEETLE` appears from wave 2 and a `SPITTER` from wave 4;
  the last bug of a wave dying adds 25 × n, shows the wave cleared for two seconds and starts wave n+1.
- A bug walks the shortest path to the player, recomputed every quarter of a second; a touch or a
  `SPITTER`'s ball costs one life and gives 1.5 s of safety; the third life lost moves the match to
  `over`.
- For 200 seeds, a match where the player is touched at a given moment never ends higher than the
  same presses without the touch; a player that always aims at the nearest bug and fires clears waves
  1 to 5.
- The same seed and presses give the same match and score stepped at 1/60 s and at 1/120 s.

**s5** (`ui: yes`)
- `art.ts` draws a match into a buffer: ceiling and floor in two theme colours, the walls from `cast`
  shaded by distance and side, the sprites from `sprites`, enlarged 2× without smoothing to 640×360
  and 320×288. A fixed small map and camera give the expected pixels on both views.
- Colours are read from the frame's theme; the shake and the flash are dropped under
  `prefers-reduced-motion`. `scenes/theme.test.ts` is not touched yet.

**s6** (`ui: yes`)
- `GAMES`' sixth row has `scene: 'hunt'`; at LV 6, A on the cabinet opens the `hunt` scene. `hunt` is
  a scene name, a signed-in-only scene and a held-buttons scene, and `grid.ts` knows its group.
- Opening the cabinet imports `arcade/hunt/` with a dynamic `import()`, `LOADING…` meanwhile; a failed
  import shows `GAME DID NOT LOAD · A TO RETRY`, A retries, B goes back to the room. A guard test
  fails when a file outside `arcade/hunt/` imports from it at run time; type-only imports pass.
- The hunt is played: ▲ ▼ walk, ◀ ▶ turn, B held steps to the side, A fires and, held, fires at each
  delay, with several fingers at once on the Game Boy bodies. The HUD shows `SCORE n`, `WAVE n`, the
  lives and a crosshair on both grids, and `WAVE n CLEARED` shows between waves. `theme.test.ts`
  passes on both grids.

**s7** (`ui: yes`)
- START pauses and only START resumes; a blurred window, a hidden tab or leaving the scene pauses
  too; the pause reads `PAUSED`, `START · RESUME`, `SELECT · QUIT`.
- The third life lost or SELECT · QUIT on the pause sends `submitScore('hunt', points)` once,
  whichever route, and the game over screen shows `GAME OVER`, the score, then saving, NEW BEST, the
  best, or `SCORE NOT SAVED · A TO RETRY`; A plays again, B goes back to the room.
- `apps/galaxy/README.md`'s game room names the sixth game, BUG HUNT, opened at LV 6. The design
  draft `hunt-match` exists with the `game-room` draft's Source naming this PRD.
