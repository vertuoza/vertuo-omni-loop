---
prd: 1447
title: OMNI KART's circuit floats in the void
blocked-by: none
spec: file
---

# OMNI KART's circuit floats in the void

**Date:** 2026-10-10 · **PRD:** #1447
**Touches:**
- `apps/galaxy/src/arcade/kart/track.ts` (the void tile in the legend, COMET RING's map with the
  verge and the walls turned to void, the props standing on void tiles)
- `apps/galaxy/src/arcade/kart/kart.ts`, `kart/rules.ts` (the fall; the grass's slowdown and the
  walls' bounce go)
- `apps/galaxy/src/arcade/kart/rivals.ts` (the point a kart comes back at), `kart/race.ts` (the
  fall in the race, the `fell` event; the `wall` event goes), `kart/items.ts` (an ORB turns back at
  the road's edge), `kart/fx.ts` (the wall's sparks go)
- `apps/galaxy/src/arcade/kart/texture.ts`, `kart/art.ts` (the void painted as space, the kart
  falling and blinking, the props floating)
- `apps/galaxy/src/arcade/scenes/kart.ts`, `apps/galaxy/src/arcade/sound.ts` (the `fall` cue and
  sound; `scrape` goes)
- `apps/galaxy/README.md` (OMNI KART's section)

## Problem

COMET RING is drawn as a circuit in space (PRD 1427), but its edges behave like a race track on the
ground. Two tiles of pale lunar verge line the road and halve the top speed, and past them a metal
wall stops the kart and bounces it back. A racer who misses a corner slows down, scrapes a wall and
drives on: in space, where the road should hang over nothing, going off it costs little and looks
like nothing at all.

## Solution

Everything off the road becomes **the void**. The road floats over a starfield, its neon edge is
the edge of the void, and the pylons, beacons, asteroids, satellites and wrecks stay where they
are, floating around it.

A kart whose centre goes over the void **falls**: for one second it takes no input, stays where it
went over the edge, and shrinks as it sinks under the road. Then it **comes back** at rest in the
middle of the road, on the racing line, at the point nearest where it fell, facing the way of the
race, and blinks for half a second. The race clock runs throughout: with the restart from rest, a
fall costs about a second and a half. The lap and the waypoints it had passed are kept as they
were, so a fall never gains or loses a lap. Rivals fall and come back by the same rule.

### The void on the map

- The legend gains one tile, **void**, written `~`. The verge (`.`) and the wall (`X`) leave the
  legend, so `trackProblems()` refuses a map that still holds one of them.
- COMET RING's map keeps its road, kerbs, line, boxes and starting places where they are, and every
  `.` and `X` becomes `~`. Past the map's edge, `tileAt()` reads void.
- The props stand on void tiles (they stood on wall tiles); their places do not change.
- With no grass and no wall left, the grass's slowdown (`RULES.grassFactor`, `topSpeedAt()`) and
  the walls' bounce (`bounceOff()`, `RULES.bounce`) leave the kart's physics, and with them the
  `wall` event, the `scrape` cue and sound and the wall's sparks.

### The fall

- **When:** the tile under the kart's centre is void at the end of a sub-step, or once the karts
  are pushed apart. Its body may hang over the edge without falling.
- **What is on it:** a new `fall` on `Fx`, the seconds of falling left, beside `spin`. It starts at
  `RULES.fallTime`, one second. The kart's speed and its BOOST drop to zero; the item it holds is
  kept. A spin-out in progress ends.
- **During it:** the pad does nothing and the kart does not move on the map. A falling kart is out
  of the race's contacts: it is not pushed apart, no BLOB or ORB hits it, it takes no box and it
  uses no item.
- **The look:** the kart is drawn smaller and lower as the fall goes on, down to nothing at its
  end.
- **The sound:** the player's fall plays a new `fall` sound once, as its own cue; a rival's fall is
  silent, as a rival's wall contact was.

### The way back

- **Where:** the point of the racing line nearest the kart, on the segment `progressOf()` measures
  it along (from the last point it passed to the next one it must pass), and never beyond that
  segment's ends. A kart never comes back past the next waypoint, nor across the start line.
- **How:** at rest (speed 0, steer 0), facing the segment's direction, with `fall` at zero and a
  new `blink` on `Fx` at `RULES.blinkTime`, half a second. The blink is drawn only: the kart drives,
  and can be hit, as soon as it is back.
- **The pace:** the kart's `Pace` (laps, waypoints passed) is the one it had when it fell. The jump
  from the fall to the way back is never passed to `advance()`, which could otherwise count a
  waypoint or a line crossing.
- Every point of COMET RING's racing line lies over road, so the way back is never over the void.

### Items

- An **ORB** turns back at the road's edge, where a wall turned it back before, and is gone at its
  third bounce or after four seconds, as today.
- A **BLOB** keeps its rules, wherever it lands.

### The look of the void

- The texture paints every void tile as space, once, when the texture is built: a near-black floor
  with stars, none of its colours equal to a theme token (ADR-0046), as the circuit's other
  colours.
- The neon edge is drawn on the void's side of the road's edge, cyan outside the circuit and
  magenta inside, as it was drawn on the walls.
- `BEYOND`, the floor's colour past the map's edge, becomes the void's darkest tone.
- The sky and the horizon do not change.

## Decisions

- **Everything off the road is void,** chosen by the person over the walls alone or the verge
  alone: the verge and the walls go together, so no edge of the road is safe.
- **A fall is seen and costs time,** about one and a half seconds, chosen by the person over an
  instant teleport or a longer penalty. The clock never stops.
- **The way back is where the kart fell, never further,** chosen by the person over the last
  waypoint passed (too harsh in a long straight) or the nearest road tile (which could put the kart
  past a waypoint it never reached).
- **Rivals fall too,** by the same rule, chosen by the person.
- **The void is a starfield under the road,** painted in the texture, chosen by the person over a
  plain black floor. The horizon's scenery is not this PRD.
- **The voice's objection, accepted.** persona:B-E DEv objected: "The rivals cut corners across the
  verge today, on purpose (`cornerGate`). With the void there, they will fall in every tight corner,
  and nothing in this design proves otherwise." Settled `accepted`: a test races a whole race of
  COMET RING and requires every rival to finish its three laps with at most one fall
  (**Acceptance criteria**). Only when it fails does the work tighten the rivals' corner cut, and
  nothing else of their driving.
- **What goes with the walls** (decided while writing this spec, as the consequence of the void):
  the grass's slowdown, the walls' bounce, the `wall` event, the `scrape` sound and the wall's
  sparks, since nothing can trigger them any more. Keeping them would leave code that never runs.
- **Items keep their rules** (decided while writing this spec): an ORB still bounces three times,
  now off the road's edge, so the item's balance is not changed by this PRD.
- **The blink is drawn only:** no invulnerability after the way back, which would be a rule of its
  own.
- **No reset of the kart's best times:** the road is the same, and the verge was never faster than
  the road, so a time set before this PRD stands beside the ones set after.
- **No browser acceptance scenario:** `acceptance.enabled` is off in this repository; every
  criterion below is proven by ordinary tests.
- **No proof video:** the person said no.

## User stories

- As a racer who misses a corner, I fall off COMET RING into space and come back on the road where
  I fell, so the mistake costs me time but never a lap.
- As a racer, I see the circuit hang over a starfield, so the race looks like it is run in space.
- As a racer, I see rivals fall off too, by the same rule, so the race is fair.

## Scope

**In:**
- The void tile, and COMET RING's map with only road and void.
- The fall and the way back, for the player and the rivals, and the `fell` event and the `fall`
  sound.
- The removal of the grass's slowdown, the walls' bounce, the `wall` event, the `scrape` sound and
  the wall's sparks.
- An ORB turning back at the road's edge.
- The void painted as space, the neon edge on the void's side, `BEYOND`, the falling and blinking
  kart, the props floating.
- OMNI KART's section of `apps/galaxy/README.md`.

**Out:**
- The horizon's scenery, its own PRD.
- Any other circuit, and any change to the road's layout.
- Invulnerability after the way back, and any change to the items beyond the ORB's bounce.
- The score contract: a race still sends its time in tenths (PRD 1440).

## Test seams

Every test is a pure Vitest test beside the module it tests, under `apps/galaxy/src/arcade/kart/`,
stepped frame by frame as the kart's tests are today; none calls GitHub or Supabase (`omni kb show
testing`). The new behaviour is written test-first.

- **`kart.test.ts`:** on a small map drawn in the test, a kart driven off the road starts falling
  on the sub-step its centre goes over the void, not before; during the fall the pad does nothing
  and the kart stays put; its BOOST ends and its item stays.
- **`rivals.test.ts`:** the way back is the nearest point of the segment `progressOf()` measures,
  never beyond its ends, on a straight and in a corner, and never across the start line; it faces
  the segment's direction; the pace is unchanged.
- **`race.test.ts`:** a race in which the player falls emits `fell` once and plays the `fall` cue;
  the clock runs through the fall; a kart pushed over the edge by another falls; a falling kart is
  not pushed, not hit and takes no box; the same
  seed and keys give the same race. **The whole race:** COMET RING raced by `step()` at a fixed
  1/60 s with the player's kart standing still, until every rival is done or ten minutes of race
  clock pass: every rival finishes its three laps, and none falls more than once.
- **`track.test.ts`:** COMET RING holds only road and void tiles; every prop stands on a void tile;
  a map with `.` or `X` is refused; every point of the racing line, sampled along each segment, is
  over road.
- **`items.test.ts`:** an ORB flying off the road turns back at its edge and is gone at its third
  bounce.
- **`texture.test.ts`:** a void tile is painted in the void's colours and none of the road's; the
  neon edge is on the void's side; `BEYOND` is the void's darkest tone.
- **`art.test.ts`:** a falling kart is drawn smaller as its fall goes on; a blinking kart is drawn
  every other blink frame.

## Risks

**What merging publishes** (`omni kb show releasing`): the merge to `main` ships the arcade's new
code with the galaxy app's deploy. Nothing is stored differently: no migration, no change to
`submit_score()`, and a race still sends its time in tenths.

- **The rivals get slower if they fall.** A rival that falls loses about a second and a half, so a
  race could get easier. The whole-race test bounds it at one fall per rival per race.
- **The feel changes.** A racer used to scraping the walls through a corner now falls there. That is
  the point of the PRD; the road itself is unchanged.
- **Best times stay comparable.** No reset: the verge was never faster than the road.
- **The deployment window is harmless.** A tab opened before the deploy keeps the old circuit and
  sends a time in the same contract.

**Rollback:** revert the feature PR. There is no data to restore.

## Acceptance criteria

1. COMET RING's map holds only road tiles (road, kerb, line, box, start) and void tiles; the legend
   has no verge and no wall, and `trackProblems()` refuses a map that holds `.` or `X`.
2. The floor off the road is drawn as space with stars, the road's neon edge sits on the void's
   side, the floor past the map's edge is the void's darkest tone, and the sky and the horizon are
   unchanged.
3. The props stand where they stood, on void tiles, floating around the circuit.
4. A kart falls as soon as its centre is over the void, after a sub-step or after the karts are
   pushed apart, and not while only its body hangs over the edge.
5. For the one second of a fall, the kart takes no input, does not move on the map, and is drawn
   smaller and lower until it is gone; its BOOST ends and the item it holds stays.
6. A falling kart is not pushed by another, is not hit by a BLOB or an ORB, takes no box and uses
   no item.
7. After the fall, the kart stands at rest on the racing line, at the point nearest where it fell
   on the segment it was on, never beyond the next waypoint nor across the start line, facing the
   way of the race, and blinks for half a second while it drives.
8. A fall never changes the kart's laps or the waypoints it has passed.
9. The race clock runs through a fall.
10. Rivals fall and come back by the same rule, and a kart pushed over the edge by another falls.
11. The player's fall plays the `fall` sound once; a rival's fall plays nothing.
12. Nothing slows a kart off the road or bounces it off a wall any more: the `wall` event, the
    `scrape` sound and the wall's sparks are gone.
13. An ORB turns back at the road's edge and is gone at its third bounce or after four seconds.
14. In a whole race of COMET RING simulated with the player standing still, every rival finishes
    its three laps and none falls more than once.
15. The same seed and the same keys give the same race.
