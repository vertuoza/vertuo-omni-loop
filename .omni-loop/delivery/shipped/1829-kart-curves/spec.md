---
prd: 1829
title: "OMNI KART: COMET RING drives in curves, through a vaulted tunnel in a bend, with a harder walkway"
blocked-by: none
spec: file
---

# OMNI KART: COMET RING drives in curves, through a vaulted tunnel in a bend, with a harder walkway

**Date:** 2026-10-13 · **PRD:** #1829
**Touches:**
- `apps/galaxy/src/arcade/kart/track.ts` (the circuit's centre line: each corner's radius, the road's width, the gaps, the
  shortcuts' pieces and the tunnel's span; COMET RING redrawn on 72×72 tiles; `roadAt`, baked by `parseTrack`; the checks of
  `trackProblems`; `cornersOf`)
- `apps/galaxy/src/arcade/kart/kart.ts` (the tip-over, the wheels over the void and the pull towards the edge read `roadAt`)
- `apps/galaxy/src/arcade/kart/rivals.ts` (the racing line along the arcs, the rivals' aim, the progress, a waypoint passed,
  the way back), `kart/race.ts` (through them)
- `apps/galaxy/src/arcade/kart/relief.ts` (the ground along the centre line, level over each arc)
- `apps/galaxy/src/arcade/kart/texture.ts` (the plating, the neon edge, the kerbs, the travel direction, the chevrons, the ramp
  arrows and the walkway's grating, all by distance to the centre line)
- `apps/galaxy/src/arcade/kart/mode7.ts` (the roof from the tunnel's span, the walls along the curve, the vault)
- `apps/galaxy/src/arcade/kart/art.ts` (the minimap from the road; the stands and the props), `kart/items.ts` (off the road)
- `apps/galaxy/src/arcade/kart/rules.ts` (the vault's depth), and the tests beside each

## Problem

COMET RING turns at right angles. Each of its 14 corners is a square block of 5×5 road tiles, its racing line is a broken
line, and every edge of the road runs north-south or east-west: the circuit drives like a grid. The tunnel of PRD 1775 is a
straight box with a flat ceiling. And the walkway, the shortcut over the void between the corners `[36, 8]` and `[20, 8]`,
is 2 tiles wide, straight across, and plain road to the wheels: it skips the whole U-loop with no risk at all.

The request, as it came: « le racourci sur 2 cases est très facile et j'aimerais que les tournants soient en arrondis et le
tunnel aussi ».

## Solution

### The centre line: the circuit's shape

COMET RING's road is drawn from a **centre line**: the 14 waypoints in driving order, each corner a circular arc of its
own **radius** tangent to its two legs, and the road's **width**, 5 tiles. Every point within half the width of the centre
line is road, except a **gap** declared on it; every other point is void. A corner's arc replaces the square block: its outer
edge is a quarter circle, its inner edge a tighter one.

The **shortcuts** are **pieces** of their own, each a straight centre line with its own width and its own gaps: the hidden
ramp's spur (5 tiles wide, as today) and the walkway (below). Their road is added to the main road.

The **tunnel** is a **span** of the centre line: from where it starts, a length along the line. Every point of the road within
that span is under the roof.

`parseTrack` bakes the road into one query, `roadAt(track, x, y)`, a mask of the whole map at the pixel, read in constant time.
Every test of the engine that today asks whether a tile is void asks `roadAt` instead: the kart's tip-over, its wheels and the
pull towards the edge, the items off the road, the texture, the minimap, the stands and the props.

**The rows keep the features only.** The map's rows still place, at their tiles, the boost pads `+`, the ramps `^`, the item
boxes `?`, the starting places `S` and the start line `=`, on a background of `.`. The characters `~` (void), `#` (road),
`r` (kerb), `T` (roofed) and `w` (walkway) leave the legend: the road, the kerbs, the roof and the walkway come from the
centre line. `trackProblems` checks every feature against `roadAt`: a pad, a ramp, a box, a place and the start line lie on
road; a stand and a prop lie on void, clear of the road's edge.

### COMET RING, redrawn on 72×72 tiles

The map grows from 64×64 to 72×72 tiles, so every curve fits without crowding a pad, a ramp, a box or the start line. The
layout keeps its order and its shape; its short legs grow (the leg `[54, 40]` → `[44, 40]` from 10 tiles to 13, the leg
`[8, 40]` → `[18, 40]` from 10 to 13, the U-loop's sides from 12 to 16, the U-loop's floor from 16 to 18), and the whole is
centred on the new map. The waypoints, in tile coordinates, with each corner's radius in tiles:

| # | waypoint | was | radius | the corner |
|---|---|---|---|---|
| 0 | `[62, 62]` | `[54, 56]` | 8 | the end of the start straight, turning north: a wide curve, taken flat out |
| 1 | `[62, 46]` | `[54, 40]` | 3 | into the chicane, the hidden ramp's spur carrying straight on north: a hairpin |
| 2 | `[49, 46]` | `[44, 40]` | 3 | the chicane: a hairpin |
| 3 | `[49, 34]` | `[44, 28]` | 3 | the chicane: a hairpin |
| 4 | `[64, 34]` | `[56, 28]` | 3 | onto the gap jump's descent: a hairpin, the run-up pad on the straight after it |
| 5 | `[64, 10]` | `[56, 8]` | 5 | after the gap jump, turning west **inside the tunnel**: a fast blind curve |
| 6 | `[41, 10]` | `[36, 8]` | 6 | into the U-loop, **the walkway leaving from its middle**: a wide curve |
| 7 | `[41, 26]` | `[36, 20]` | 4 | the U-loop |
| 8 | `[23, 26]` | `[20, 20]` | 4 | the U-loop |
| 9 | `[23, 10]` | `[20, 8]` | 4 | out of the U-loop, where the walkway rejoins |
| 10 | `[8, 10]` | `[8, 8]` | 6 | onto the long west side: a wide curve |
| 11 | `[8, 46]` | `[8, 40]` | 4 | back east |
| 12 | `[21, 46]` | `[18, 40]` | 3 | a hairpin south |
| 13 | `[21, 62]` | `[18, 56]` | 3 | a hairpin onto the start straight |

At the top speed a kart turns on a circle of about 4.4 tiles (`RULES.steer` × `RULES.steerAtTop`, 1.56 radians a second, at
110 a second): a curve of 5 tiles or more is taken flat out, a hairpin of 3 asks to lift, to about 0.78 of the top speed on
the centre line, and a curve of 4 to about 0.85.

**The features keep their sizes and their order on their leg**, moved with it: the gap jump's pad, ramp and gap of 3 tiles
keep the spacing PRD 1775 calibrated, and the descent's extra length goes before the pad; the landing keeps at least 3 tiles
of straight before the curve of waypoint 5. The four item boxes that stood between the landing and the corner `[56, 8]` move
to the straight after the tunnel's exit. The 40 boxes, the 6 places, the 12 stands and the props stay as many.

The lap on the centre line is about 249 tiles, against 236 on today's broken line: about 5 % longer.

### Driving the curves

- **The road's edge is round.** A kart tips over once no road lies within `RULES.overhang` of its centre, and a wheel is over
  the void where `roadAt` says so: the rules of PRD 1447 and PRD 1775, against the round edge.
- **The racing line follows the arcs.** It is the centre line, each arc sampled every half tile. The rivals aim along it, at a
  point their look-ahead ahead, with their offset across it; the progress that ranks the places is the distance along it.
- **The 14 waypoints stay the checkpoints.** `Pace` counts them as today; a waypoint is passed where a kart crosses the line
  normal to the centre line at the middle of its arc. The shortcuts' gates and their `skips` keep their meaning.
- **The way back** after a fall is the nearest point of the racing line between the last waypoint passed and the next, and,
  where that point is over a gap, behind the gap by `RULES.runUp` (bug 1820).
- **The ground** follows the centre line: each waypoint's height and each leg's bump as today, and the road level over the
  whole of each arc, so a curve never twists.

### The tunnel in the bend

The tunnel's span starts where the curve of waypoint 5 starts, right after the landing, and runs 13 tiles along the centre
line: the quarter circle of the curve (about 8 tiles), then about 5 tiles of the straight west. A kart lands from the gap jump
and drives straight into it, and the curve's outer wall hides the exit until the kart is in the bend.

- **The walls** stand on the road's two edges and follow the curve.
- **The vault:** the ceiling is `ROOF` (44) over the centre line and falls along an arc to `ROOF − RULES.vault` at the walls,
  where it meets them; the panels and the light strips of PRD 1775 follow the vault.
- **The portals** stand across the road at both ends of the span, square to the centre line, framed as PRD 1775 and bug 1813
  draw them; from inside, the road stays in sight, as bug 1813 requires.
- **The station plating** covers the road within 3 tiles of the span, as today.
- The frame's cost holds: at most 600 samples a column, in the curve and on its straight.

### The walkway, made hard

The walkway leaves the curve of waypoint 6 at its middle, over the void, heads west, and meets the road of waypoint 9's
corner. It is:

- **one tile wide** (16 for a kart 14 wide, as drawn): a kart that drifts half a tile off it tips over;
- **offset:** leaving from the middle of the arc, its axis lies about 1.8 tiles south of the top straight's, so a kart cannot
  line it up on the straight; it is taken out of the curve, with a flick of the wheel;
- **broken by a gap:** a ramp, then a gap across it, in its middle;
- **over the void at its start:** no straight and no rail lead to it, it opens from the arc's outer edge.

Calibrated as PRD 1775 calibrated its jumps: a kart at the top speed, without a BOOST, on the walkway's centre line, clears
the gap and lands on the walkway; at 0.9 × the top speed it falls in. A kart that falls from the walkway comes back by the
way back, on the racing line, in the U-loop: the walkway missed costs the U-loop and a fall. Its gate keeps its place where
it rejoins, and still credits waypoints 7 and 8 (its `skips`) only to a kart that crossed it forwards.

The hidden ramp's spur keeps its tiles, its ramp, its gap of 5 tiles and its rule, moved with its corners.

### What stays as it is

The times: the best times set on today's circuit are kept, no row is deleted. The rules of the race, the items, MULTI's
messages, the grid, the sounds, the HUD and the controls do not change.

## Decisions

- **A centre line with the road at the pixel,** chosen by the person over a grid 4 times finer (the map no longer written by
  hand, walls still in steps, a broken line for the rivals) and over rounding the drawing only (the road drawn would no longer
  be the road driven).
- **A mix of curves,** chosen by the person over wide curves everywhere and over softened square corners: wide curves where
  the legs leave room, hairpins in the chicane, the radii of the table above.
- **The map grows to 72×72,** offered by the person (« hésite pas à la rendre un peu plus grande si il faut ») so the
  U-loop's corners get a radius of 4 rather than 3, and no feature has to be pushed aside.
- **The tunnel is vaulted and turns,** both, chosen by the person; it turns in the bend right after the gap jump, chosen over
  moving it to a fast curve elsewhere.
- **One PRD for the three asks,** chosen by the person over the corners first, or the walkway first.
- **The walkway gets all four hardenings** (one tile wide, a gap, an offset entry, opening from a curve over the void),
  chosen by the person, and stays doable **flat out on the right line without a BOOST**, chosen over a BOOST only and over a
  margin with a BOOST.
- **The objection of persona:F-E Developer, accepted:** « Refaire d'un coup la géométrie que lisent la physique, les rivaux,
  le rendu et la minimap, c'est exactement le gros changement qui laisse passer des bugs en prod, et le kart en a eu deux
  cette semaine (#1813, #1820). Je veux qu'un test prouve, avant le merge, que chaque point de la ligne de course est sur la
  route sauf les trous déclarés, que les rivaux finissent leurs 3 tours sans tomber, et qu'une vue est vérifiée dans chaque
  virage. » The three guards are in **Test seams** and **Acceptance criteria**.
- **The best times are kept,** chosen by the person over starting them over as PRD 1698 did: no migration, and a revert
  brings the circuit back whole.
- **No proof video,** chosen by the person.

## User stories

- As a player, I take COMET RING's wide curves flat out, holding the wheel, and lift for its hairpins.
- As a player, I land from the gap jump straight into a tunnel that bends away under a vault, and I do not see its exit
  until I am in the bend.
- As a player, I can take the walkway only at the top speed, on its line, out of the curve; if I miss it, I lose the U-loop
  and a fall.
- As a player, I see a road with round edges, a neon edge and kerbs that follow the curves, and a minimap of the same shape.
- As a player racing rivals, they drive the curves and finish their laps without falling, at every level.

## Scope

**In:** COMET RING's centre line, radii, width, gaps, pieces and tunnel span; `roadAt` and every engine read of the void
moved to it; the map redrawn on 72×72 tiles; the racing line, the rivals' aim, the progress, the waypoints passed and the way
back along the arcs; the ground along the centre line; the texture, the tunnel's walls and vault, the minimap, the stands and
the props on the new road; the walkway's four hardenings; the guards and the tests below.

**Out:** another circuit; a curve inside a shortcut; a version of the circuit in MULTI's messages; starting the best times
over; a new item, sound or control; the touch controls.

## Test seams

Pure modules, tested beside them as today (`omni kb show testing`): no browser, no network, every race stepped from a seed.

- **The guards (the objection):**
  - `kart/track.test.ts`: every point of COMET RING's racing line, every 4 units along the arcs and the straights, is road,
    except the gap jump's declared gap; and `kart/rivals.test.ts`: the way back from each of those points is road (bug
    1820's guard, along the arcs).
  - `kart/race.test.ts`: on seeds 1, 7 and 42, at the levels easy, normal and hard, the five rivals finish their three laps
    without a single fall.
  - `kart/mode7.test.ts`: at the middle of every arc, with the chase camera on the racing line, the middle of the screen
    from the horizon down is more than half road; and at most 600 samples a column there and in the tunnel.
- `kart/track.test.ts`: the map is 72×72; the 14 waypoints and radii of the table; `roadAt` true within half the width of
  the centre line and false beyond, on a straight and across an arc; the gap and the pieces; every feature on road, every stand
  and prop on void; the 40 boxes, 6 places, 12 stands and 2 shortcuts with `skips` 2 and 7; a lap of about 249 tiles on the
  centre line; the legend without `~ # r T w`.
- `kart/kart.test.ts`: a kart tips over past the round edge of an arc as past a straight edge; a wheel over the void beyond
  an arc's edge counts.
- `kart/rivals.test.ts`: a waypoint is passed at the middle of its arc; the progress grows along an arc; a rival on an arc
  aims along it.
- `kart/relief.test.ts`: the ground is level across each arc, and never jumps more than 1 unit in 1 unit of distance along
  the centre line.
- `kart/texture.test.ts`: the neon edge lies on the round edge of an arc; the travel direction on an arc is its tangent.
- The walkway, in `kart/track.test.ts`: a run on its centre line at the top speed without a BOOST clears its gap and lands
  on it; at 0.9 × the top speed it falls in; a kart half a tile off its centre line tips over; its gate credits 7 and 8.
- The tunnel, in `kart/mode7.test.ts`: with the camera inside the span, in the bend, the top of the frame is ceiling; the
  ceiling over the road's edge is lower than over its centre; from the entry portal the exit portal is not in the frame.
- The gap jump's calibration (PRD 1775) and the way back over it (bug 1820) hold, on the moved leg.

## Risks

- **A wide change.** Every module of the engine moves from the tile to `roadAt`: the three guards and the race's own tests
  hold it, and the plan lands it in slices that keep the race green at each step.
- **MULTI across a release.** A player still on a tab opened before the release sees the others' karts on the new circuit
  drawn over the old one until the tab reloads: the karts' positions are exchanged as they are, with no version of the circuit.
- **The frame's cost.** The tunnel's curved walls and vault are drawn per column; the cost guard holds 600 samples.
- **The best times.** Set on a lap about 5 % shorter, they may stay out of reach a while; kept, as decided.
- **What merging publishes:** the galaxy app's arcade, at the next release (`omni kb show releasing`). Rolled back by
  reverting the feature PR: no data changes.

## Acceptance criteria

1. COMET RING is 72×72 tiles and its 14 waypoints and radii are those of the table.
2. Every point of the racing line is road, except the gap jump's gap; the way back from any of them is road.
3. On seeds 1, 7 and 42, at every level, the five rivals finish three laps without a single fall.
4. At the middle of every arc, the chase camera sees the road in the middle of the screen, and a column costs at most 600
   samples, there and in the tunnel.
5. A kart tips over past the round edge of a curve as it does past a straight edge.
6. The neon edge and the kerbs follow the curves; the minimap shows the same curved circuit.
7. A curve of radius 5 or more is driven flat out on the centre line without leaving the road; a hairpin of 3 is not.
8. The tunnel starts where the curve after the gap jump starts and runs 13 tiles along the line; inside, the top of the
   frame is ceiling, lower at the walls than over the centre; from its entry its exit is hidden.
9. The walkway is one tile wide, leaves the middle of the curve of waypoint 6 about 1.8 tiles off the top straight's axis,
   and has a ramp and a gap; at the top speed without a BOOST on its line a kart clears it, at 0.9 × it falls in, half a tile
   off its line it tips over; its gate credits waypoints 7 and 8.
10. The gap jump still clears from its pad and at the top speed, and falls in at 0.8 × the top speed; a kart that falls in
    comes back before its ramp.
11. The best times stay as they are; no migration ships.
