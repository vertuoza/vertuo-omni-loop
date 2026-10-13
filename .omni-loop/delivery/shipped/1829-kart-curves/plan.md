# Plan: OMNI KART: COMET RING drives in curves, through a vaulted tunnel in a bend, with a harder walkway

PRD #1829, its spec beside this plan (`spec.md`). The feature branch `feat/kart-curves` merges into
`main` with `Closes #1829`; each slice is a sub-PR from `feat/kart-curves--<slice>` into the feature
branch, with `Part of #1829`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The centre line's geometry: from waypoints that each carry a radius, a width, gaps and pieces, whether a pixel is road, the distance along and across the line, its tangent, the racing line sampled every half tile along the arcs, each waypoint's gate at the middle of its arc, and a span's road; a pure module nothing in the race reads yet | `apps/galaxy/src/arcade/kart/line.` | — | 1 |
| s2 | The engine reads the void through `roadAt`: `parseTrack` bakes the road and the roof at the pixel from today's rows, and the tip-over, the wheels, the pull, the items off the road, the rivals' look-ahead, the way back and the tunnel's roof read them instead of a tile; COMET RING and everything a player sees unchanged | `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/items.` `apps/galaxy/src/arcade/kart/rivals.` `apps/galaxy/src/arcade/kart/mode7.` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/games/stills.test.ts` | — | 1 |
| s3 | COMET RING in curves: the circuit drawn from its centre line on 72×72 tiles with the radii of the spec's table, the rows keeping the features only, the racing line, the rivals, the progress, the waypoints and the way back along the arcs, the ground level over each arc, the neon edge, the kerbs, the minimap, the stands and the props on the round road, the tunnel's span and the walkway as a piece, and the three guards of the objection | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/games/stills` | s1, s2 | 2 |
| s4 | The tunnel in the bend, vaulted: walls on the road's edges that follow the curve, a ceiling at `ROOF` over the centre line falling to `ROOF − RULES.vault` at the walls, portals square to the line, the exit hidden from the entry, within 600 samples a column | `apps/galaxy/src/arcade/kart/mode7.` `apps/galaxy/src/arcade/kart/rules.ts` | s3 | 3 |
| s5 | The walkway made hard: one tile wide, leaving the middle of the curve of waypoint 6 about 1.8 tiles off the top straight's axis, opening from the arc's outer edge with no rail, a ramp then a gap in its middle, cleared flat out on its line without a BOOST and missed at 0.9 × the top speed | `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/texture.test.ts` | s3 | 3 |
| s6 | OMNI KART's section of the README tells COMET RING as it now drives: 72×72 tiles, a curve at every corner and its radius, the tunnel vaulted in the bend after the gap jump, the walkway one tile wide with its gap | `apps/galaxy/README.md` | s3, s4, s5 | 4 |

**Shared ground.** The kart's modules all read the circuit, so the waves keep each file in one slice
at a time:

- `apps/galaxy/src/arcade/kart/line.` belongs to s1 (which writes it) and to s3 (the folder, which
  may extend it while COMET RING moves onto it): wave 1, then wave 2.
- `kart/track.`, `kart/kart.`, `kart/items.`, `kart/rivals.`, `kart/mode7.` and `kart/race.` belong to
  s2 and to s3 (the folder): wave 1, then wave 2. s1 and s2 share wave 1 because s1 only creates
  `kart/line.*`, which s2 does not touch.
- s3 takes the whole `apps/galaxy/src/arcade/kart/` folder, alone in wave 2: redrawing COMET RING
  moves every place, box, waypoint and tile that tests across the folder read (`art.test.ts`,
  `items.test.ts`, `kart.test.ts`, `mode7.test.ts`, `race.test.ts`, `race.multi.test.ts`,
  `relief.test.ts`, `rivals.test.ts`, `texture.test.ts`, `track.test.ts` all import the circuit),
  and the cabinet's still (`games/stills.ts`, the file snapshot `games/stills.test.ts` writes) is
  drawn from its start straight.
- `games/stills.test.ts` belongs to s2 (a call site, if a renderer's arguments change; the still
  itself must not move) and to s3 (the folder `games/stills`): wave 1, then wave 2.
- `kart/mode7.` belongs to s2, s3 and s4, and `kart/rules.ts` to s3 and s4; `kart/track.` belongs
  to s2, s3 and s5, and `kart/texture.test.ts` to s3 and s5: waves 1, 2, then 3. s4 and s5 share
  wave 3 because their territories never meet: the tunnel is drawn in `mode7` from the span s3
  declares, the walkway is shaped in `track`.
- `apps/galaxy/README.md` belongs to s6 alone, in wave 4, once what it describes is built.

Tests outside a slice's territory read what it changes, and must stay green without being edited:

- `kart/guard.test.ts` imports `ArcadeApp`, `scenes/kart`, `kart/art` and `kart/track`.
- `kart/fx.test.ts` imports `kart/rules` and `kart/race`; `kart/grid.test.ts`, `kart/hub.test.ts`,
  `kart/hub.finish.test.ts`, `kart/net.test.ts` and `kart/live.test.ts` race through `kart/race`:
  MULTI's messages do not change, so they stay valid.
- `scenes/kart.test.ts` imports `LAPS` from `kart/track`, which no slice changes.
- s4 and s5 run beside each other: s4 must not change what `mode7.test.ts`'s mid-arc guard (s3)
  asks of the bend, only meet it with the vault; s5 must keep `track.test.ts`'s racing-line guard
  green, the walkway lying off the racing line.

No generated path (`kit/dist/`, `apps/omni-app/api/`) is built from these files.

## Per slice: done when

### s1: the centre line's geometry

- `kart/line.ts` takes a closed centre line (points in tiles, each with its own corner radius, every
  leg straight), a width, gaps (a span of the line that is void across the road) and pieces (straight
  centre lines of their own width and gaps, added to the road).
- `line.test.ts`, on small circuits of its own: on a straight, a pixel is road within half the width
  of the line and void beyond; across an arc, the same against the outer and the inner quarter
  circle; a pixel inside a gap is void; a piece's pixels are road and a piece's gap is void.
- The distance along the line and across it, and the tangent, at a point on a straight and on an
  arc; the length of a closed line of known shape (a square of side `a` with corners of radius `r`
  is `4(a − 2r) + 2πr`).
- The racing line's samples lie on the centre line, half a tile apart, arcs included; each
  waypoint's gate is the line normal to the centre line at the middle of its arc, as wide as the
  road.
- A span (a start and a length along the line) covers the road within it and nothing beyond.
- Nothing outside `kart/line.*` imports it yet; the race and its tests are untouched.

### s2: the engine reads the void through `roadAt`

- `parseTrack` bakes `roadAt(track, x, y)` and the roof at the pixel from today's rows, each read in
  constant time.
- The tip-over, the wheels over the void and the pull towards the edge (`kart.ts`), the items off
  the road (`items.ts`), the rivals' look-ahead for the edge and the way back (`rivals.ts`) and the
  tunnel's roof (`mode7.ts`) read them instead of a tile; `race.ts` hands them the track.
- `track.test.ts`: on COMET RING, `roadAt` agrees with today's tiles at every pixel of the map, and
  the roof with the `T` tiles.
- Nothing a player sees changes: COMET RING's rows are untouched; the kart, items, rivals, mode7 and
  race tests pass with only their call sites changed; bug 1820's way back and its guard pass as they
  are; the cabinet's still (`games/stills.ts`) does not change by a byte.

### s3: COMET RING in curves

- COMET RING is 72×72 tiles; its 14 waypoints and their radii are the spec's table; its road, the
  gap jump's gap, the hidden ramp's spur and the walkway (a piece leaving the middle of the curve of
  waypoint 6, still 2 tiles wide and without a gap until s5) come from the centre line, width 5;
  the tunnel's span starts where the curve of waypoint 5 starts and runs 13 tiles along the line,
  drawn by today's tunnel until s4. The rows hold only `+`, `^`, `?`, `S` and `=` on `.`; the legend
  has no `~`, `#`, `r`, `T` or `w`. (Acceptance criterion 1.)
- `trackProblems` checks every pad, ramp, box, place and the start line against `roadAt` (on road),
  and every stand and prop (on void, clear of the edge); `track.test.ts`: 40 boxes, 6 places, 12
  stands, 2 shortcuts with `skips` 2 and 7, a lap of about 249 tiles on the centre line. The four
  boxes that stood before the corner `[56, 8]` stand on the straight after the tunnel's exit.
- **The guards of the objection:** `track.test.ts`, every point of the racing line, every 4 units
  along the arcs and the straights, is road except the gap jump's gap, and `rivals.test.ts`, the way
  back from each of those points is road (criterion 2); `race.test.ts`, on seeds 1, 7 and 42, at
  easy, normal and hard, the five rivals finish their three laps without a single fall (criterion
  3); `mode7.test.ts`, at the middle of every arc, with the chase camera on the racing line, the
  middle of the screen from the horizon down is more than half road, and a column costs at most 600
  samples there and in the tunnel (criterion 4).
- `kart.test.ts`: a kart tips over past the round edge of an arc as past a straight edge; a wheel
  beyond an arc's edge counts (criterion 5).
- `rivals.test.ts`: a waypoint is passed at the middle of its arc; the progress grows along an arc; a
  rival on an arc aims along it. A curve of radius 5 or more is driven flat out on the centre line
  without leaving the road, a hairpin of 3 is not (criterion 7).
- `relief.test.ts`: the ground is level across each arc and never jumps more than 1 unit in 1 unit
  of distance along the centre line.
- `texture.test.ts`: the neon edge lies on the round edge of an arc, the kerbs follow it, the travel
  direction on an arc is its tangent; the walkway's grating is as wide as the walkway's piece, read
  from the circuit; `art.test.ts`: the minimap shows the curved circuit (criterion 6).
- The gap jump, on its moved leg, still clears from its pad and at the top speed, falls in at 0.8 ×
  the top speed, and a kart that falls in comes back before its ramp (criterion 10).
- The cabinet's still is drawn again from the new start straight (`games/stills.ts`).
- Nothing under `supabase/` changes: the best times stay (criterion 11).

### s4: the tunnel in the bend, vaulted

- `RULES.vault` holds the vault's depth; the ceiling is `ROOF` over the centre line and falls along
  an arc to `ROOF − RULES.vault` at the walls, still above the eye.
- `mode7.test.ts`: with the camera inside the span, in the bend, the top of the frame is ceiling; the
  ceiling over the road's edge is lower than over its centre; from the entry portal the exit portal
  is not in the frame (criterion 8).
- The walls stand on the road's two edges and follow the curve; the portals stand across the road at
  both ends of the span, square to the centre line; from inside, the road stays in sight (bug 1813's
  test passes as it is).
- At most 600 samples a column in the tunnel, in the curve and on its straight, and s3's mid-arc
  guard still green (criterion 4).

### s5: the walkway made hard

- The walkway is one tile wide, leaves the middle of the curve of waypoint 6 about 1.8 tiles south of
  the top straight's axis, opens from the arc's outer edge with no straight and no rail leading to
  it, and has a ramp then a gap in its middle (criterion 9).
- `track.test.ts`: a run on its centre line at the top speed without a BOOST clears the gap and
  lands on it; at 0.9 × the top speed it falls in; a kart half a tile off its centre line tips over;
  its gate credits waypoints 7 and 8 to a kart that crossed it forwards only (criterion 9).
- A kart that falls from the walkway comes back on the racing line, in the U-loop.
- s3's guards stay green: the racing line, which never takes the walkway, is road except the gap
  jump's gap.

### s6: OMNI KART's section of the README

- `apps/galaxy/README.md`, OMNI KART's section: COMET RING on 72×72 tiles, drawn from its centre
  line; a curve at every corner with its radius (wide curves flat out, hairpins to lift for); the
  tunnel of 13 tiles in the bend after the gap jump, under a vault; the walkway one tile wide, off the
  top straight's axis, with a ramp and a gap; the best times kept. Every coordinate it gives is one
  of the new map, and nothing it says contradicts the spec.
