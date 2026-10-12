# Plan: OMNI KART's circuit floats in the void

PRD #1447, specified in `spec.md` beside this plan. The feature branch `feat/kart-void` merges into
`main` through one feature PR (`Closes #1447`); each slice is a sub-PR from `feat/kart-void--<slice>`
into the feature branch (`Part of #1447`). One landing: nothing is stored differently, so the whole
PRD ships in one merge.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | COMET RING hangs over the void: the legend gains the void tile `~`, every `.` and `X` of COMET RING becomes `~`, the props stand on void tiles, `tileAt()` reads void past the map's edge, every point of the racing line lies over road, and the texture paints the void as space with stars, the neon edge on the void's side and `BEYOND` as the void's darkest tone | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/games/stills.test.ts` | — | 1 |
| s2 | a kart whose centre goes over the void falls for one second and comes back at rest on the racing line, at the nearest point of the segment it was on, facing the race and blinking, with its pace kept; rivals follow the same rule, a falling kart is out of the race's contacts, the race tells `fell` and the player's fall plays the `fall` sound, and a whole race of COMET RING proves every rival finishes with at most one fall | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart.` `apps/galaxy/src/arcade/sound.` | s1 | 2 |
| s3 | nothing off the road slows or bounces a kart any more: `.` and `X` leave the legend, the grass's slowdown, the walls' bounce, the `wall` event, the `scrape` cue and sound and the wall's sparks go, an ORB turns back at the road's edge, and OMNI KART's section of the README tells the void, the fall and the way back | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/scenes/kart.` `apps/galaxy/src/arcade/sound.` `apps/galaxy/README.md` | s2 | 3 |

**Shared ground.** `apps/galaxy/src/arcade/kart/` is declared by all three slices: the circuit's
modules and their tests are tightly bound (the map, the kart's physics, the race, the texture and
the drawing read one another), so each slice owns the whole folder rather than a list of files it
would outgrow. `apps/galaxy/src/arcade/scenes/kart.` and `apps/galaxy/src/arcade/sound.` are declared
by s2 (the `fall` cue and sound) and s3 (`scrape` goes). The slices build in waves 1, 2 and 3, each
after the one before it merged, so no two of them edit the same file at once. `apps/galaxy/README.md`
is s3's alone: it documents the void, the fall and the way back once all three are true, and
`games/stills.test.ts` is s1's alone (it reads `BEYOND` and `paintTrack()`).

## Per slice: done when

**s1, COMET RING hangs over the void**
- `track.test.ts`: COMET RING's map holds only road tiles (road, kerb, line, box, start) and void
  tiles; every prop stands on a void tile, at the place it had; `tileAt()` past the map's edge reads
  void; every point of the racing line, sampled along each segment, is over road.
- `texture.test.ts`: a void tile is painted in the void's colours and none of the road's, none of
  them equal to a theme token; the neon edge (cyan outside the circuit, magenta inside) is on the
  void's side of the road's edge; `BEYOND` is the void's darkest tone.
- The tests that drove a kart into COMET RING's walls (`art.test.ts`'s scrape frame, `race.test.ts`'s
  wall contact and slow-frame cases) run on a map drawn in the test that still has a wall, and pass
  unchanged in what they prove.
- The sky and the horizon are drawn as before: `art.test.ts`'s sky and horizon cases pass unchanged.
- `pnpm test`, `pnpm typecheck` and `pnpm lint` are green.

**s2, the fall and the way back**
- `kart.test.ts`, on a small map drawn in the test: a kart falls on the sub-step its centre goes
  over the void, not while only its body hangs over the edge; for `RULES.fallTime` (1 s) the pad
  does nothing and the kart does not move; its BOOST and any spin-out end; its item stays.
- `rivals.test.ts`: the way back is the nearest point of the segment `progressOf()` measures, on a
  straight and in a corner, never beyond that segment's ends (never past the next waypoint, never
  across the start line); the kart is at rest and faces the segment's direction; its `Pace` is the
  one it had when it fell.
- `race.test.ts`: a race in which the player falls tells `fell` once, its cue is `fall`, and the
  clock runs through the fall; a kart pushed over the edge by another falls; a falling kart is not
  pushed apart, not hit by a BLOB or an ORB, takes no box and uses no item; after the fall it blinks
  for `RULES.blinkTime` (0.5 s) and drives and can be hit while it blinks; the same seed and keys give
  the same race.
- **The whole race** (`race.test.ts`): COMET RING raced by `step()` at a fixed 1/60 s with the player
  standing still, until every rival is done or ten minutes of race clock pass: every rival finishes
  its three laps, and none falls more than once. Only if it fails, the rivals' corner cut is
  tightened, and nothing else of their driving.
- `art.test.ts`: a falling kart is drawn smaller and lower as its fall goes on, down to nothing; a
  blinking kart is drawn every other blink frame.
- `scenes/kart.test.ts` and `sound.test.ts`: the `fall` cue plays the `fall` sound; a rival's fall
  makes no cue.
- `pnpm test`, `pnpm typecheck` and `pnpm lint` are green.

**s3, nothing off the road slows or bounces**
- `track.test.ts`: the legend has no verge and no wall; `trackProblems()` refuses a map that holds
  `.` or `X`. Every map drawn in a test uses `~` off the road.
- `topSpeedAt()`, `bounceOff()`, `RULES.grassFactor`, `RULES.bounce`, the `wall` event, the race's
  `touching`, the `scrape` cue and sound and the `spark` particle are gone, with their tests; no code
  reads them (`pnpm typecheck` and `pnpm fallow:audit` green).
- `items.test.ts`: an ORB flying off the road turns back at its edge and is gone at its third bounce
  or after four seconds; BLOB's tests pass unchanged.
- `apps/galaxy/README.md`'s OMNI KART section tells the void, the fall, the way back and the ORB's
  bounce, and no longer tells the verge, the walls, the scrape or the sparks.
- `pnpm test`, `pnpm typecheck` and `pnpm lint` are green.
