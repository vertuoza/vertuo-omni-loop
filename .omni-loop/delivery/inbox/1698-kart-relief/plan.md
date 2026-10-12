# Plan: OMNI KART's circuit gets hills, a thick deck, more boxes, tipping karts and a minimap

PRD #1698, specified in `spec.md` beside this plan. The feature branch `feat/kart-relief` merges into
`main` through one feature PR (`Closes #1698`); each slice is a sub-PR from `feat/kart-relief--<slice>`
into the feature branch (`Part of #1698`). One landing: no migration, no data, the arcade's code
ships in one merge.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | COMET RING rises and falls along its racing line, every corner level, its relief spanning 26 at most and checked like its map; the camera rides 28 over the ground; the race's floor is drawn in relief, the deck's side 12 deep and its magenta glow under every edge facing the camera, and a sprite behind a crest is hidden; uphill the top speed falls and downhill it rises, 0.67 to 1.33 of the flat one, for the player and the rivals; the floor never takes more than 600 samples a column | `apps/galaxy/src/arcade/kart/relief.` `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/mode7.` `apps/galaxy/src/arcade/kart/texture.` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/rules.` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/kart/rivals.` `apps/galaxy/src/arcade/kart/art.` | — | 1 |
| s2 | OMNI KART's section of `apps/galaxy/README.md` says how the race is now: COMET RING's relief and slopes, the deck, ten lines of boxes, the four wheels, the lean and the tip-over, and the minimap | `apps/galaxy/README.md` | — | 1 |
| s3 | a kart stands on four wheels; a side with more wheels over the void leans it and slides it towards the void at 16 a second, and the player can steer back; both wheels of one side over the void tip it over into today's fall and way back, and a centre 7 past the edge still falls; a leaning kart is drawn rolled and a falling one rolls over, with no shadow; rivals look a quarter of a second ahead, brake and turn in 64 before a corner, and finish three laps without falling on seeds 1, 7 and 42 | `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/rules.` `apps/galaxy/src/arcade/kart/rivals.` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/kart/art.` | s1 | 2 |
| s4 | ten lines of four item boxes stand across the road, one on every straight, 40 in all, each drawn 20 wide over a pool of its light that pulses with it (still with reduced motion); the cabinet's still is drawn again with them, its floor flat | `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/items.test.ts` `apps/galaxy/src/arcade/kart/art.` `apps/galaxy/src/arcade/games/stills.` | s1 | 3 |
| s5 | the minimap stands in the top right corner under the item panel on both grids, one game pixel a tile, the road shaded by height over a dark cyan-framed panel; it shows the boxes there to take, a dot per kart on the road (none for a falling one), every other player in MULTI, and the player's yellow dot with its heading, blinking while the player falls (not with reduced motion) | `apps/galaxy/src/arcade/kart/art.` | s1 | 4 |

**Shared ground.** OMNI KART's engine and drawing are a few files every feature of this PRD passes
through, so the slices that touch them run one wave after another, each on top of the one before:

- `apps/galaxy/src/arcade/kart/art.` (`art.ts` and `art.test.ts`): s1 (the floor in relief, the
  camera over the ground, the crest hiding sprites), s3 (the rolled kart), s4 (the bigger boxes and
  their pool), s5 (the minimap). Waves 1, 2, 3 and 4: s4 and s5 are blocked by s1 alone, and are
  raised to waves 3 and 4 by this file.
- `apps/galaxy/src/arcade/kart/kart.`, `kart/rules.`, `kart/rivals.` and `kart/race.` (each with its
  tests, `race.` covering `race.test.ts` and `race.multi.test.ts`): s1 (the slope on the top speed)
  and s3 (the wheels, the tip-over, the rivals' look-ahead). Waves 1 and 2.
- `apps/galaxy/src/arcade/kart/track.` (`track.ts` and `track.test.ts`): s1 (COMET RING's relief and
  its checks) and s4 (the eight new lines of boxes). Waves 1 and 3.
- `apps/galaxy/src/arcade/games/stills.` (`stills.ts`, drawn again by `stills.test.ts -u`) is s4's
  alone: the still keeps the flat floor, and only the boxes change it.
- s2's territory (the galaxy README) is shared with no slice, so it builds in wave 1 beside s1.

## Per slice: done when

**s1, hills, the deck and the cost guard**
- `kart/relief.test.ts`: the ground is flat on a circuit with no relief; on COMET RING it is a
  waypoint's height at that waypoint, level for 2.5 tiles at both ends of a leg, and the bump at a
  leg's middle; the slope is zero on the flat, positive climbing, negative going down, and changes
  sign with the heading; the range is the lowest and highest ground.
- `kart/track.test.ts`: COMET RING's relief passes its checks and spans 26 at most; a relief with a
  height or a bump missing, not a number, or spanning more than 26 is refused, naming why.
- `kart/kart.test.ts`: the top speed is lower uphill and higher downhill, never under 0.67 nor over
  1.33 of the flat one; rivals obey the same rule (`kart/rivals.test.ts` or `race.test.ts`).
- `kart/mode7.test.ts`: a hill is drawn higher on the screen than the flat road behind it; under an
  edge facing the camera, the deck's side is drawn, then the glow over what was there; each road
  pixel's depth is its distance; a sprite on raised ground projects higher; at every waypoint of
  COMET RING facing the next one, on the wide and the tall grid, the floor takes at most 600
  samples a column, as the renderer reports.
- `kart/art.test.ts`: the camera's eye is 28 over the ground under the player's kart; a box behind a
  crest is not drawn; the arch over the start line stays on top.
- The cabinet's still is unchanged (`games/stills.test.ts` green without `-u`), and
  `kart/guard.test.ts` stays green.

**s2, the README**
- OMNI KART's section of `apps/galaxy/README.md` names the relief (heights and bumps on the racing
  line, level corners, the 26 cap), the slopes on the top speed, the deck's side and glow, the ten
  lines of boxes, the four wheels with the lean, the slide and the tip-over, and the minimap's place
  and dots, in the section's own words; "Mode 7 floor" is replaced where it no longer holds.

**s3, tipping over the edge**
- `kart/kart.test.ts`: the wheels over the void on each side; one side out leans the kart and slides
  it towards the void at 16 a second; both wheels of one side out tip it over; a kart driving
  straight off an edge falls once its rear wheels pass it; a centre 7 past the edge still falls.
- `kart/race.test.ts`: the fall and push tests follow the new edge; on seeds 1, 7 and 42 with no
  player input, the five rivals finish three laps without falling.
- `kart/art.test.ts`: a leaning kart is drawn rolled towards the void, a falling one rolls further,
  and a falling kart casts no shadow.

**s4, more item boxes**
- `kart/track.test.ts` and `kart/items.test.ts`: 40 boxes stand in ten lines of four across the
  road, one line on every straight; a box still gives one item to a kart holding none and is back
  after 3 seconds.
- `kart/art.test.ts`: a box is drawn 20 world units wide over its pool of light, and the pool stands
  still with reduced motion.
- `games/stills.test.ts` green after `-u`, the still checked by eye: the new boxes, the flat floor.

**s5, the minimap**
- `kart/art.test.ts`: on the wide and the tall grid, the minimap stands in the top right corner,
  8 game pixels in from the right edge and under the item panel, over the sky; it shows the
  player's dot, a dot per rival on the road and none for a falling rival, and a gold pixel per box
  there to take; the player's dot blinks while falling, and stays lit with reduced motion.
- `kart/race.multi.test.ts` or `kart/live.test.ts` stays green, and a MULTI race draws a dot per
  other player.
