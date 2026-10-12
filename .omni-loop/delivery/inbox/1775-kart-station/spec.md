---
prd: 1775
title: OMNI KART gets a space-station tunnel, jumps, boost pads, shortcuts and a livelier decor, and tips over less easily
blocked-by: none
spec: file
---

# OMNI KART gets a space-station tunnel, jumps, boost pads, shortcuts and a livelier decor, and tips over less easily

**Date:** 2026-10-12 · **PRD:** #1775
**Touches:**
- `apps/galaxy/src/arcade/kart/rules.ts` (the tip-over's grace and pull; the jump's launch, gravity
  and steering in the air; the tunnel's roof)
- `apps/galaxy/src/arcade/kart/kart.ts` (the grace before a kart tips over; boost pads; a kart's
  height over the ground, its take-off, flight and landing)
- `apps/galaxy/src/arcade/kart/track.ts` (COMET RING's pads, ramps, gap, walkway, ramp spur, tunnel,
  shortcuts, stands and new props; the tile legend and the circuit's checks for all of them)
- `apps/galaxy/src/arcade/kart/relief.ts` (the shortcuts' own legs in the ground's height)
- `apps/galaxy/src/arcade/kart/rivals.ts`, `kart/race.ts` (shortcut gates in the lap count; rivals
  that drive the main line's jumps and never a shortcut; karts in the air)
- `apps/galaxy/src/arcade/kart/net.ts` (a kart's height in MULTI's state message)
- `apps/galaxy/src/arcade/kart/mode7.ts` (the tunnel's ceiling, walls and portals; the camera's eye
  over a kart in the air)
- `apps/galaxy/src/arcade/kart/texture.ts` (pads, ramps, arrows, station plating, the walkway's
  grating)
- `apps/galaxy/src/arcade/kart/art.ts` (karts in the air and their shadow; the stands' ships; the
  new props; the sky's convoys, asteroid belt and big planet; the minimap's tunnel)
- `packages/design/src/sprites.ts` (the new props' sprites and the convoys' ships)
- `apps/galaxy/README.md` (OMNI KART's section)

## Problem

COMET RING is the same ride from the first lap to the last. Its speed only changes with the slopes
and with a BOOST picked from a box, the kart never leaves the ground, there is one way around, and
apart from pylons, beacons and a few wrecks floating in the void, nothing happens beside the road.
And the edge is unforgiving: a kart tips over as soon as both wheels of one side are over the void,
which happens when its centre is only 3 units past the edge (the kart is 14 wide), while a wheel
over the void already draws it towards the edge at 16 units a second. Grazing the edge on a slanted
line is enough to fall.

## Solution

### A softer edge

- **Half a second of grace.** A kart with both wheels of one side over the void starts to count. It
  tips over and falls, by today's fall and way back (PRD 1447), once both have stayed out for
  `RULES.tipGrace` = 0.5 s in a row. The count starts again from zero as soon as one of them is
  back over the road.
- **A warning.** While the count runs, the kart leans fully over the void and its sprite rocks; it
  leans without rocking when motion is reduced.
- **A gentler pull.** A wheel over the void draws the kart towards the edge at `RULES.tipPull` = 8
  units a second (16 today). The player can still steer it back.
- **The centre rule stays.** A kart whose centre is `RULES.overhang` = 7 units past the edge still
  falls at once.
- Rivals obey the same rules.

### Boost pads

- **A new tile, the boost pad.** A kart on the ground over a pad gets the BOOST, the item's own:
  ×1.4 top speed for 1.5 s (`RULES.boostFactor`, `RULES.boostTime`), started again from 1.5 s on
  every pad. The item the kart holds stays in its hand. Rivals get it too.
- **Where:** one pad just before each ramp of the main line, and one out of each of the corners
  `[18, 56]`, `[44, 28]` and `[8, 40]`.

### Jumps

- **A kart has a height over the ground,** 0 on the road, and a vertical speed.
- **A new tile, the ramp.** A kart that leaves a ramp tile forwards, onto any tile that is not a
  ramp, takes off with a vertical speed of `RULES.launch` = 0.9 × its speed; `RULES.gravity` = 400
  units a second² brings it down. The faster it goes, the higher and farther it flies.
- **In the air:** its speed holds (no throttle, no brake, no drag), it steers at `RULES.airSteer` =
  0.3 of its turn rate, it takes no box and no pad, it cannot tip over, and a kart on the ground does
  not push it. BLOBs and ORBs on the ground pass under it.
- **Landing.** When its height over the ground comes back to 0, it lands with its speed, and the
  ordinary rules apply where it lands: on the road it drives on; with both wheels of one side over
  the void the grace counts; with its centre over the void it falls.
- **The camera rides with the player's kart:** its eye stays 28 units over the kart's own height,
  on the ground or in the air.
- **A kart in the air** is drawn at its height, with a dark oval shadow on the ground under it.
- **The gap jump,** on the main line, in the long descent `[56, 28]` → `[56, 8]`: a pad, a ramp on
  the hump's crest, a gap of 3 tiles of void across the whole road, and the road again in the
  descent. Driven straight from the pad, a kart clears it; at top speed without a BOOST it clears it
  just; under 80 % of the top speed it falls in.
- **The bump jump,** on the main line, in the long west leg `[8, 8]` → `[8, 40]`: a pad, a ramp,
  and road under the whole flight. Air time, no gap, no risk.

### Shortcuts

Both shortcuts are hard to reach and leave the main line where it turns; rivals never take them.

- **The hidden ramp,** at the corner `[54, 40]`: instead of turning west, a short spur of road
  carries straight on north to a ramp with no pad before it, then a gap of 5 tiles of void, and the
  kart lands on the leg `[44, 28]` → `[56, 28]`, on ground 8 units higher than the corner it left. At top speed
  without a BOOST a kart falls in; with the BOOST of an item it clears it.
- **The walkway,** at the corner `[36, 8]`: instead of turning south, a walkway 2 tiles wide carries
  straight on west over the void to the corner `[20, 8]`. It is 32 units wide for a kart 14 wide.
- **Shortcut gates.** A lap counts only when every waypoint is passed in order (PRD 1359), and each
  shortcut skips two of them: the hidden ramp skips `[44, 40]` and `[44, 28]`, the walkway skips
  `[36, 20]` and `[20, 20]`. Each shortcut has a gate, a line across it after its hard part. A kart
  that crosses a gate forwards while the next waypoint it must pass is the first one that shortcut
  skips is credited with both, and its lap counts as if it had driven them. A kart that leaves the
  main line anywhere else gets nothing. While a kart is on a shortcut before its gate, its place in
  the race may lag; it catches up at the gate.
- **The shortcuts' ground.** Each shortcut is a leg of its own in the relief: its ground eases from
  the height of the corner it leaves to the height of the point where it rejoins the main line, so the walkway climbs from 4 to
  12 with no step, and the ground of the main line does not change anywhere.
- A kart that falls from a shortcut comes back by today's way back, on the racing line.

### The tunnel

- **A new tile, roofed road.** It is road to the wheels. Over every roofed tile stands a roof
  `RULES.roof` = 44 units over the ground, and a wall stands on every edge between a roofed tile and
  a void tile, from the ground up to the roof.
- **Where:** on the top leg `[56, 8]` → `[36, 8]`, 13 tiles long, between the corners `[56, 8]` and `[36, 8]`, right after the gap jump.
  Coming out of it, the walkway shows straight ahead and the main line turns south.
- **Inside,** the top of the screen shows the ceiling, not the sky: metal panels crossed by strips
  of light, which pass over the player as the kart drives. The walls are metal panels with portholes
  that show the starfield. The road is station plating.
- **From outside,** the tunnel is a station block: its outer walls, its roof when the camera looks
  down on it from a hill, and at both ends a portal, a lit frame around the opening.
- **What is behind a wall is hidden:** a kart, a box, a prop, a BLOB or an ORB behind a wall, on the
  far side from the camera, is not drawn there.
- **The cost of drawing it.** The floor never takes more than 600 samples a column (PRD 1698),
  inside the tunnel and out, and the test that holds it at every waypoint of COMET RING also holds
  it at points inside the tunnel.

### A livelier decor

- **The fleets watch the race.** Twelve stands float over the void: eight along the start straight
  (four on each side) and four beside the gap jump. Each shows a fleet's ship, drawn with that
  fleet's mascot and colour: the active fleets (not retired) in their order, starting again from the
  first when there are fewer fleets than stands. With no fleet at all, every stand shows the neutral
  ship. The ships bob gently over the void, and stand still when motion is reduced.
- **The roadside lives.** Four new props, on void tiles near the road and more of them around the
  station: neon lamps that pulse, antenna dishes that turn, docking cranes and cargo containers.
  Every prop stays on a void tile, never on the road, the walkway, the spur or the tunnel; the
  lamps and dishes stand still when motion is reduced.
- **The sky lives.** Three convoys of small ships cross the sky's panorama slowly, an asteroid belt
  runs across it behind the planets, and a big planet rises at the horizon. The convoys stand still
  when motion is reduced.
- **The road reads.** Pads glow with cyan chevrons pointing the way of the race. Two tiles before
  each ramp, yellow arrows on the road. The ramps are striped yellow and black. The tunnel's road
  and three tiles before each portal are station plating. The walkway is a dark metal grating with
  magenta neon edges.
- **The minimap** shows the walkway and the spur as road, and the tunnel in a lighter tint.

### MULTI

- **A kart's height travels with its state.** MULTI's state message carries the kart's height over
  the ground, so every player sees the others fly over the gap. The field is optional and reads as 0
  when it is missing, so a player still on the previous build during a deploy does not break the
  race.

### What stays

- COMET RING keeps its waypoints, its relief, its start straight and its boxes (a line of boxes
  moves along its straight where a pad, a ramp or the gap takes its place); the gap, the pads,
  the ramps, the tunnel, the spur and the walkway are tiles of the same 64 × 64 map.
- The best times stay: nothing changes in the database.
- The cabinet's still (`apps/galaxy/src/arcade/games/stills.ts`) stays as it is.

## Decisions

- **One PRD for the whole idea,** chosen by the person over two PRDs (the gameplay first, then the
  decor and the tunnel) and over the decor first.
- **COMET RING is reworked and its best times are kept,** chosen by the person over deleting them
  (irreversible) and over a second circuit (a circuit choice in the menu, in MULTI and per best
  time: much more). The shortcuts make the old times easier to beat; nothing breaks.
- **Half a second of grace and half the pull,** chosen by the person over falling only once the
  centre is over the void (very forgiving, missed jumps included) and over only removing the pull
  (still sharp).
- **Both kinds of jump, a gap and a bump,** chosen by the person over the gap alone and the bump
  alone.
- **Both kinds of shortcut, the hidden ramp and the walkway,** chosen by the person over either one.
- **A real tunnel drawn by the renderer,** chosen by the person over a corridor of lit rings (no
  continuous ceiling: the sky shows between them) and over a frame laid on the screen (it does not
  follow the perspective and looks wrong in a turn).
- **The roadside, the sky and the road all livelier, and the fleets' ships watching the race,** chosen
  by the person; the stands are the person's own addition.
- **No proof video,** chosen by the person.
- **Jumps with a real height and gravity,** decided while designing: a scripted arc always lands,
  and the person wants a kart that is too slow to fall in.
- **Shortcut gates,** decided while designing: the lap rule wants every waypoint in order, so a
  shortcut without a gate would never count a lap.
- **The shortcuts' own legs in the relief,** decided while designing: the ground is the height of
  the nearest leg, so without them the walkway would have a step where the nearest leg changes.
- **Rivals never take a shortcut,** shown to the person as an assumption and approved with the design:
  a shortcut stays the player's reward.
- **The height in MULTI is optional,** decided while designing, so mixed builds during a deploy
  still race.
- **Pads are painted once with the floor,** decided while designing: the floor's texture is painted
  once per circuit (PRD 1427), so the pads glow without animating.
- **The voice's objection, not answered.** persona:B-E DEv objected: "I already see the tool as a
  gimmick and avoid using it. A PRD that adds a tunnel, spectator ships and jumps to a mini-game
  confirms to me that it is fluff." Settled `none`: the person approved the design without answering
  it.

## User stories

- As a player, I can graze the edge on a slanted line and steer back before I fall.
- As a player, I hit a glowing pad and get a BOOST without spending my item.
- As a player, I fly over a gap in the road, and I fall in when I come to it too slowly.
- As a player who knows the circuit, I can take a hard shortcut, with an item BOOST or a steady hand,
  and gain time when I make it.
- As a player, I drive through a space station, under its lit ceiling, between walls with
  portholes on the stars.
- As a player of a fleet, I see my fleet's ship watching the race from beside the start straight.
- As a MULTI player, I see the others fly over the gap.

## Scope

**In:**
- the grace before tipping over, and the gentler pull;
- boost pads, ramps, a kart's height, its flight and landing;
- COMET RING's gap jump, bump jump, pads, hidden ramp with its spur, walkway, shortcut gates and
  tunnel;
- the shortcuts' legs in the relief;
- the tunnel's drawing (ceiling, walls, portals, hiding what is behind a wall) within the floor's cost;
- the stands with the fleets' ships, the four new props, the sky's convoys, belt and big planet, the
  road's pads, arrows, ramps, plating and grating, the minimap's tunnel;
- the height in MULTI's state message;
- OMNI KART's section of `apps/galaxy/README.md`.

**Out:**
- a second circuit, or a circuit choice;
- deleting or resetting best times, or any database change;
- rivals taking shortcuts;
- drift boosts, new items, or a change to the items' own rules;
- new sounds;
- jumps or ramps inside the tunnel;
- the cabinet's still.

## Test seams

Every test is a vitest test beside the code it tests, on pure functions and seeded races; none calls
GitHub or Supabase (`omni kb show testing`).

- `kart/kart.test.ts`:
  - both wheels of one side over the void: no fall at 0.49 s, a fall at 0.5 s; the count back to 0
    when one wheel returns; the pull at 8; the centre 7 past the edge falls at once;
  - a pad starts the BOOST at 1.5 s and keeps the held item; a kart in the air takes no pad;
  - leaving a ramp forwards takes off at 0.9 × the speed; the flight under gravity 400; speed held,
    steering at 0.3, no tip in the air; landing on the road drives on, landing over the void falls.
- `kart/track.test.ts`:
  - the legend and the checks for pads, ramps, roofed road, the gates (a gate's skipped waypoints
    exist and follow each other) and the stands (on void tiles);
  - every prop and stand on a void tile, none on the road, the walkway, the spur or the tunnel;
  - the walkway 2 tiles wide;
  - a straight run stepped from the gap jump's pad clears it; at top speed with no BOOST it clears
    it; at 0.8 × top speed it falls in;
  - a straight run at top speed with no BOOST falls in the hidden ramp's gap; with the item's BOOST
    it lands on the leg `[44, 28]` → `[56, 28]`.
- `kart/relief.test.ts`: the ground along each shortcut, step by step, never jumps more than 1 unit
  in 1 unit of distance; the ground of every point of the racing line is unchanged.
- `kart/rivals.test.ts`: crossing a gate forwards credits its two waypoints only when the first is
  the next to pass; the rivals' look-ahead does not steer them away from the gap ahead of a ramp.
- `kart/race.test.ts`: on seeds 1, 7 and 42, the five rivals finish three laps without falling and
  never cross a gate; a lap through each shortcut, and through both, counts.
- `kart/net.test.ts`: a state message with a height reads it; one without reads 0.
- `kart/mode7.test.ts`: with the camera inside the tunnel, the top of the frame is ceiling, not sky;
  a wall hides a sprite behind it; from outside, a portal shows; the sample count stays at or under
  600 a column at every waypoint and at points inside the tunnel, on both grids.
- `kart/art.test.ts`: a kart in the air drawn at its height with its shadow; the stands' ships in
  their fleets' looks, cycling, and the neutral ship with no fleet; the stands, lamps, dishes and
  convoys still when motion is reduced.
- `kart/texture.test.ts`: the pads', ramps', arrows', plating's and grating's colours.
- `packages/design/src/sprites.test.ts`: the new sprites.
- In a browser: `pnpm galaxy:dev`, a race on the desktop grid and on the handheld grid, through the
  tunnel, both jumps and both shortcuts.

## Risks

- **What merging publishes** (`omni kb show releasing`): the new OMNI KART, for every player of the
  arcade at `/play`. Nothing changes in the database, and the kit is untouched.
- **The cost of a frame.** The tunnel adds work to the renderer; only the columns whose ray reaches a
  roofed tile pay it, and the floor's cap of 600 samples a column holds. The handheld grid (phones)
  is checked in the browser.
- **Balance.** A gap may turn out too hard or too easy; its length, `RULES.launch` and
  `RULES.gravity` tune it, and the run tests say when a change breaks a criterion.
- **Mixed builds in MULTI.** During a deploy, players on two builds may meet; the optional height
  keeps their messages readable both ways.
- **Rollback:** revert the feature PR's merge commit. No data to restore.

## Acceptance criteria

1. A kart with both wheels of one side over the void falls only once both have stayed out for 0.5 s
   in a row; it does not fall when one of them comes back over the road before then, and the count
   starts again.
2. While that count runs, the kart leans fully and rocks (it leans without rocking when motion is
   reduced).
3. A wheel over the void draws the kart towards the edge at 8 units a second, and the player can
   steer it back.
4. A kart whose centre is 7 units past the edge still falls at once.
5. A kart on the ground over a boost pad gets the BOOST, ×1.4 top speed for 1.5 s, and keeps the item
   it holds; rivals get it too.
6. A kart that leaves a ramp forwards takes off, higher and farther the faster it goes; in the air its
   speed holds, it steers at 0.3 of its turn rate, it takes no box and no pad, and it cannot tip over.
7. A kart that lands on the road drives on; one that lands with its centre over the void falls, by
   today's fall and way back.
8. The camera's eye stays 28 units over the player's kart, in the air too, and a kart in the air is
   drawn at its height with a shadow on the ground under it.
9. On the descent `[56, 28]` → `[56, 8]`, a pad, a ramp and a gap of 3 tiles: driven straight from
   the pad a kart clears it; at top speed with no BOOST it clears it; under 80 % of the top speed it
   falls in.
10. On the west leg `[8, 8]` → `[8, 40]`, a pad and a ramp give air time over the road, with no gap.
11. Pads stand before each ramp of the main line and out of the corners `[18, 56]`, `[44, 28]` and
    `[8, 40]`.
12. At the corner `[54, 40]`, a spur leads to a ramp with no pad and a gap of 5 tiles: at top speed
    with no BOOST a kart falls in; with an item's BOOST it lands on the leg `[44, 28]` → `[56, 28]`.
13. At the corner `[36, 8]`, a walkway 2 tiles wide carries on west over the void to `[20, 8]`, its
    ground climbing with no step.
14. A lap through the hidden ramp, the walkway or both counts; leaving the main line anywhere else
    gives no waypoint.
15. Rivals never take a shortcut, and on seeds 1, 7 and 42 the five rivals finish three laps without
    falling.
16. On the top leg, a tunnel 13 tiles long: inside, the top of the screen shows a ceiling with
    strips of light and the walls show portholes on the stars; from outside, a station block with a
    lit portal at each end; anything behind a wall is hidden.
17. The floor never takes more than 600 samples a column, inside the tunnel and out, on both grids.
18. Twelve stands over the void, eight along the start straight and four beside the gap jump, show
    the active fleets' ships in their looks, in order and cycling, or the neutral ship when there is
    no fleet; they bob, and stand still when motion is reduced.
19. Neon lamps, antenna dishes, docking cranes and cargo containers stand on void tiles near the road,
    more of them around the station; none stands on the road, the walkway, the spur or the tunnel.
20. Convoys of ships cross the sky, an asteroid belt runs across it and a big planet rises at the
    horizon; the convoys stand still when motion is reduced.
21. Pads glow with cyan chevrons, yellow arrows mark the two tiles before each ramp, ramps are striped
    yellow and black, the tunnel's road and its approaches are station plating, and the walkway is a
    grating with magenta edges.
22. The minimap shows the walkway and the spur as road, and the tunnel in a lighter tint.
23. In MULTI, every player sees the others' karts at their height over the gap; a state message
    without a height reads as a kart on the ground.
24. The best times are kept, and nothing changes in the database.
