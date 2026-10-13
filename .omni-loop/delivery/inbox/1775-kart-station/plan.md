# Plan: OMNI KART gets a space-station tunnel, jumps, boost pads, shortcuts and a livelier decor, and tips over less easily

PRD #1775, its spec beside this plan (`spec.md`). The feature branch `feat/kart-station` merges into
`main` with `Closes #1775`; each slice is a sub-PR from `feat/kart-station--<slice>` into the feature
branch, with `Part of #1775`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A softer edge: both wheels of one side over the void tip the kart over only after 0.5 s in a row, the kart leans fully and rocks while the count runs, and a wheel over the void pulls at 8 | `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/kart/rivals` `apps/galaxy/src/arcade/kart/art.` | — | 1 |
| s2 | The circuit's new pieces: boost pad, ramp, roofed road and walkway tiles in the legend, painted (chevrons, stripes, arrows, station plating, grating), and a circuit's stands and shortcuts in its data and its checks; COMET RING itself unchanged | `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/texture` | — | 1 |
| s3 | The new sprites: neon lamp, antenna dish, docking crane, cargo container and the convoys' ship | `packages/design/src/sprites` | — | 1 |
| s4 | Boost pads and jumps: a pad gives the BOOST and keeps the item; a ramp launches a kart, which flies under gravity, steers at 0.3, takes no box or pad, passes over BLOBs and ORBs and lands by the ordinary rules; the camera and the sprite follow its height, with a shadow; MULTI carries the height | `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/kart/rivals` `apps/galaxy/src/arcade/kart/items` `apps/galaxy/src/arcade/kart/net` `apps/galaxy/src/arcade/kart/index` `apps/galaxy/src/arcade/kart/live.test.ts` `apps/galaxy/src/arcade/kart/hub.finish.test.ts` `apps/galaxy/src/arcade/kart/art.` | s1, s2 | 2 |
| s5 | The tunnel: over roofed road, a roof 44 units up, a ceiling with strips of light, walls with portholes, a lit portal at each end, the roof seen from above, what is behind a wall hidden, within 600 samples a column | `apps/galaxy/src/arcade/kart/mode7` | s2 | 2 |
| s6 | Shortcuts count: a gate credits the two waypoints its shortcut skips, each shortcut is a leg of its own in the relief, and rivals drive over the gap ahead of a ramp without steering away and never cross a gate | `apps/galaxy/src/arcade/kart/relief` `apps/galaxy/src/arcade/kart/rivals` | s2, s4 | 3 |
| s7 | A livelier decor: the stands show the fleets' ships, four new props, convoys, an asteroid belt and a big planet in the sky, and the tunnel on the minimap | `apps/galaxy/src/arcade/kart/art.` `apps/galaxy/src/arcade/kart/track.` | s2, s3, s4 | 3 |
| s8 | COMET RING laid out: the gap jump, the bump jump, the pads, the hidden ramp and its spur, the walkway, the gates, the tunnel, the twelve stands and the new props on the circuit, the boxes moved where needed, the cabinet's still and OMNI KART's section of the README | `apps/galaxy/src/arcade/kart/` `apps/galaxy/src/arcade/games/stills` `apps/galaxy/README.md` | s5, s6, s7 | 4 |

**Shared ground.** The kart's files meet in a few modules, so the waves keep each of them in one slice
at a time:

- `apps/galaxy/src/arcade/kart/kart.`, `kart/rules.ts` and `kart/race.` belong to s1 and s4: s4 is
  blocked by s1, so wave 2 follows wave 1.
- `apps/galaxy/src/arcade/kart/rivals` belongs to s1, s4 and s6: s6 waits for s4 in wave 3.
- `apps/galaxy/src/arcade/kart/art.` belongs to s1, s4 and s7: s7 waits for s4 in wave 3.
- `apps/galaxy/src/arcade/kart/track.` belongs to s2 and s7: wave 1, then wave 3.
- s8 takes the whole `apps/galaxy/src/arcade/kart/` folder, alone in wave 4: laying COMET RING out
  moves tiles that tests across the folder read (`kart.test.ts`, `art.test.ts`, `items.test.ts`,
  `mode7.test.ts`, `race.test.ts`, `race.multi.test.ts`, `relief.test.ts`, `rivals.test.ts`,
  `texture.test.ts`, `track.test.ts` all import the circuit).

Wave 1 runs three slices side by side because their territories never meet: the edge's rules
(s1), the circuit's data and texture (s2), and the sprite library (s3). Wave 2 runs the flight
(s4) beside the tunnel's drawing (s5), which only touches `mode7`. Wave 3 runs the shortcuts' rules
(s6, in `relief` and `rivals`) beside the decor's drawing (s7, in `art` and `track`).

Tests outside a slice's territory read what it changes, and must stay green without being edited:

- `kart/guard.test.ts` imports `ArcadeApp`, `scenes/kart`, `kart/art` and `kart/track`.
- `kart/fx.test.ts` imports `kart/rules` and `kart/race`; `kart/grid.test.ts` and `kart/hub.test.ts`
  import `kart/net`: the height is optional, so their messages stay valid.
- `scenes/kart.test.ts` imports `LAPS` from `kart/track`, which no slice changes.
- `games/stills.test.ts` imports `kart/art`, `kart/mode7`, `kart/race`, `kart/texture` and
  `kart/track`. Until s8 COMET RING is unchanged, so the still does not move; s8 owns it.

`apps/omni-app/api/` is built partly from `packages/design/`. It is a generated path, so it is never
listed here.

## Per slice: done when

### s1: a softer edge

- A kart's `fx` carries how long both wheels of one side have been over the void. `RULES.tipGrace`
  is 0.5 and `RULES.tipPull` is 8.
- `kart.test.ts`: both wheels of one side over the void and held there, no fall at 0.49 s, a fall at
  0.5 s; one wheel back over the road before then resets the count to 0, and a later count starts
  from 0; a kart whose centre is 7 units past the edge falls at once; the pull is 8 a second.
- The fall after a push (`race.ts`, after `pushApart`) obeys the same grace.
- `race.test.ts`: the invariant that no kart stays tipped over without falling now reads: no kart
  stays tipped over for longer than the grace without falling.
- `art.test.ts`: while the count runs, the kart is drawn fully leaned and rocking; with reduced
  motion it is leaned and still.
- Rivals obey the same rules (they step through the same `stepFx`).

### s2: the circuit's new pieces

- The legend gains four tiles, each road to the wheels (`isRoad`): `+` boost pad, `^` ramp, `T`
  roofed road, `w` walkway. The circuit's checks accept them.
- `TrackSource` and `Track` gain optional `stands` (tile coordinates) and `shortcuts`, each with the
  leg it drives (from the corner it leaves to the point where it rejoins the racing line, in tile
  coordinates), its gate (a line across it, in tile coordinates) and the index of the first of the
  two waypoints it skips. The checks refuse a stand on a tile that is not void, a shortcut whose
  skipped waypoints do not exist, a leg whose ends are not on road, and a gate that crosses no road.
- `texture.ts` paints: a pad cyan with chevrons pointing the way of the race (the direction of the
  nearest leg); a ramp striped yellow and black; yellow arrows on the two road tiles before each
  ramp, along the race; roofed road, and the road within three tiles of a roofed tile, as station
  plating; a walkway as a dark grating with magenta edges where it meets the void.
- `track.test.ts` and `texture.test.ts` hold each check and each colour on small fixture maps.
- COMET RING's map is unchanged: every existing test stays green as it is.

### s3: the new sprites

- `packages/design/src/sprites.ts` gains `prop-lamp` (two frames: lit, dim), `prop-dish` (two frames:
  turned left, turned right), `prop-crane`, `prop-container` and `sky-convoy` (a small ship).
- `sprites.test.ts` holds their sizes and frames like every other sprite's.

### s4: boost pads and jumps

- `RULES.launch` is 0.9, `RULES.gravity` 400 and `RULES.airSteer` 0.3.
- `kart.test.ts`, on fixture maps:
  - a kart on the ground over a pad gets `fx.boost = RULES.boostTime`, started again on every pad,
    and keeps the item it holds; a kart in the air over a pad gets nothing;
  - a kart that leaves a ramp tile forwards onto a tile that is not a ramp takes off with a vertical
    speed of 0.9 × its speed, and gravity 400 brings it down: the faster, the higher and farther;
  - in the air its speed holds, it steers at 0.3 of its turn rate, and it never tips over;
  - landing on road, it drives on with its speed; landing with both wheels of one side over the void,
    the grace counts; landing with its centre over the void, it falls by today's fall.
- `items.test.ts`: a kart in the air takes no box, and a BLOB or an ORB on the ground passes under it.
- `rivals.test.ts`: a kart on the ground does not push a kart in the air.
- `net.test.ts`: the state message carries the kart's height over the ground; a message without one
  reads as 0. A player's remote kart is drawn at the height its messages carry.
- `art.test.ts`: the camera's eye stays 28 units over the player's kart, in the air too; a kart in
  the air is drawn at its height with a dark oval shadow on the ground under it.
- Rivals cross a pad and a ramp on a fixture circuit by the same rules (they step through `stepFx`).

### s5: the tunnel

- Over every roofed tile, a roof 44 units over the ground (`ROOF` in `mode7.ts`); a wall on every edge
  between a roofed tile and a void tile, from the ground to the roof.
- `mode7.test.ts`, on a fixture map with a roofed stretch:
  - with the camera inside, the top of the frame is ceiling (metal panels and strips of light), not
    sky; the walls show portholes on the starfield; the road is station plating;
  - from outside, a lit portal frames each end; seen from an eye above the roof, the roof's top shows;
  - a sprite behind a wall, on the far side from the camera, is hidden (the depth buffer says so);
  - the floor takes at most 600 samples a column at points inside the tunnel and around it, on both
    grids, and still at every waypoint of COMET RING.
- Everything is drawn by `renderTerrain` into the floor's frame and depth: no change outside
  `mode7`.

### s6: shortcuts count

- `rivals.test.ts`, on a fixture circuit with a shortcut:
  - crossing a gate forwards credits its two waypoints only when the first of them is the next to
    pass, and the lap then counts at the line; crossing it backwards, or with another waypoint next,
    credits nothing;
  - a lap that leaves the racing line anywhere but a shortcut gets no waypoint;
  - a rival never takes a shortcut and never crosses a gate;
  - a rival's look-ahead does not steer it away from the gap ahead of a ramp it is driving at.
- `relief.test.ts`: each shortcut's leg eases from the ground at the corner it leaves to the ground
  where it rejoins the racing line; along it, the ground never moves more than 1 unit in 1 unit of
  distance; the ground of every point of the racing line is the same as without the shortcut.

### s7: a livelier decor

- `PROP_KINDS` gains `lamp`, `dish`, `crane` and `container`, each with its sprite (s3) and world
  size in `PROP_ART`; lamps pulse and dishes turn, and both stand still with reduced motion.
- The stands: each shows a fleet's ship, the fleet's mascot and colour, the active fleets (not retired)
  in order, starting again from the first when there are fewer fleets than stands; with no fleet,
  the neutral ship; each bobs gently over the void, and stands still with reduced motion.
- The sky: three convoys of `sky-convoy` ships cross the panorama slowly (still with reduced motion),
  an asteroid belt runs across it behind the planets, and a big planet rises at the horizon.
- The minimap: roofed road in a lighter tint; walkway and spur as road.
- `art.test.ts` and `track.test.ts` hold each of these on fixture tracks (stands and props on
  void tiles; fleet looks cycling; the neutral ship with no fleet; reduced motion).

### s8: COMET RING laid out

- COMET RING's map, relief data, props, stands and shortcuts carry, per the spec:
  - the gap jump on `[56, 28]` → `[56, 8]`: a pad, a ramp on the hump's crest, 3 tiles of void across
    the road;
  - the bump jump on `[8, 8]` → `[8, 40]`: a pad and a ramp over road;
  - pads out of the corners `[18, 56]`, `[44, 28]` and `[8, 40]`;
  - the hidden ramp at `[54, 40]`: a spur north, a ramp with no pad, 5 tiles of void, landing on
    `[44, 28]` → `[56, 28]`, with its gate;
  - the walkway at `[36, 8]`, 2 tiles wide, west to `[20, 8]`, with its gate;
  - the tunnel, 13 tiles of roofed road on `[56, 8]` → `[36, 8]`;
  - twelve stands (eight along the start straight, four beside the gap jump) and the new props on
    void tiles near the road, more around the station;
  - a line of boxes moved along its straight wherever a pad, a ramp or the gap takes its place.
- `track.test.ts`: the circuit passes its checks; the walkway is 2 tiles wide; every prop and stand
  is on a void tile; a straight run stepped from the gap jump's pad clears it, at top speed with no
  BOOST it clears it, at 0.8 × top speed it falls in; at top speed with no BOOST the hidden ramp's
  gap is not cleared, with the item's BOOST it lands on `[44, 28]` → `[56, 28]`.
- `race.test.ts`: on seeds 1, 7 and 42 the five rivals finish three laps without falling and never
  cross a gate; a lap through the hidden ramp, through the walkway and through both counts.
- `mode7.test.ts`: the 600-sample cap holds at points inside COMET RING's tunnel, on both grids.
- Every test under `apps/galaxy/src/arcade/kart/` is green, the ones that read the circuit's tiles
  updated to the new map.
- `games/stills.ts` is drawn again only if the circuit changed in the still's view, and
  `stills.test.ts` is green.
- `apps/galaxy/README.md`: OMNI KART's section names the pads, the jumps, the shortcuts, the tunnel,
  the stands and the softer edge.
- In a browser (`pnpm galaxy:dev`), a race on the desktop grid and on the handheld grid through the
  tunnel, both jumps and both shortcuts.
