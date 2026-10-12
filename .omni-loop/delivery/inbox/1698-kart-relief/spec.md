---
prd: 1698
title: OMNI KART's circuit gets hills, a thick deck, more boxes, tipping karts and a minimap
blocked-by: none
spec: file
---

# OMNI KART's circuit gets hills, a thick deck, more boxes, tipping karts and a minimap

**Date:** 2026-10-12 · **PRD:** #1698
**Touches:**
- `apps/galaxy/src/arcade/kart/relief.ts` (new, pure: the ground's height and slope anywhere on the
  circuit, and its lowest and highest points)
- `apps/galaxy/src/arcade/kart/track.ts` (COMET RING's relief and its new item boxes; the relief's
  shape and the checks a circuit's relief must pass)
- `apps/galaxy/src/arcade/kart/mode7.ts` (the race's floor drawn with its relief and its deck; the
  camera's eye over the ground; sprites standing on the ground)
- `apps/galaxy/src/arcade/kart/texture.ts` (the deck's colours)
- `apps/galaxy/src/arcade/kart/kart.ts`, `kart/rules.ts`, `kart/race.ts`, `kart/rivals.ts` (slopes,
  wheels, leaning and tipping over; rivals that keep their wheels on the road)
- `apps/galaxy/src/arcade/kart/art.ts` (sprites hidden behind a crest, karts leaning, bigger boxes
  with a pool of light, the minimap)
- `apps/galaxy/src/arcade/games/stills.ts` (the cabinet's still, drawn again for the new boxes)
- `apps/galaxy/README.md` (OMNI KART's section)

## Problem

COMET RING is a flat sheet floating in space. The road is projected line by line on one plane (Mode
7, PRD 1359), so it has no hills and no thickness: its edge is a line between the road and the void.
Only two rows of four item boxes stand on the whole lap, so a lap goes by with one item at most. A
kart only falls once its centre is past the edge, so driving with one side over the void costs
nothing. And nothing on the screen says where the other karts are, except the place in the HUD.

## Solution

### Hills and descents

- **COMET RING rises and falls along its racing line.** Each waypoint has a height, and each leg
  between two waypoints eases from the first height to the next, with a hump or a dip of its own
  in the middle. The relief is one block of data beside the circuit's map: `heights` (one per waypoint)
  and `bumps` (one per leg, positive a hump, negative a dip).
- **Every corner is level.** A leg is flat for 2.5 tiles at both of its ends, so the road never
  twists in a corner and two legs meet at the same height.
- **The ground anywhere** is the height of the leg nearest to that point. A circuit with no relief is
  flat, as today.
- **The relief stays under the eye.** From its lowest point to its highest, the relief spans 26 world
  units at most, under the camera's eye height (28), so the camera never looks at a road from under
  it. A circuit whose relief spans more, or whose relief has a height or a bump missing or not a
  number, is refused by the circuit's checks, like a broken map today.
- **The camera rides the ground.** The eye stands 28 units over the ground under the player's kart:
  climbing, the road ahead rises and hides what is behind its crest; going down, the road falls away
  and the circuit below shows.
- **Slopes change top speed.** Uphill, the top speed falls by 1.2 × the slope; downhill, it rises by
  as much, never under 0.67 nor over 1.33 of the flat top speed. The slope is taken along the kart's
  heading, so the same hill is slower up than down. Rivals obey the same rule.

### A thick deck

- **The road is a deck with a side.** Where the road meets the void and the void is nearer the
  camera, the road's edge shows the side of its deck, 12 world units deep: a light lip, metal that
  darkens down the side, every other panel a shade darker, and a magenta neon line at its foot.
- **A glow under the deck.** Under the side, a magenta glow fades into the void over 18 world units,
  laid over what is behind it.
- **A near hill hides what is behind it.** Karts, boxes, props, BLOBs and ORBs behind a crest are
  hidden where the road in front covers them. The arch over the start line stays on top.
- The cabinet's still on the game room's screen keeps today's flat floor: it is a picture of the
  race, drawn at a few dozen pixels high.

### More item boxes

- **Ten lines of four boxes,** one on every straight of COMET RING: the two lines of today, and eight
  new ones, 40 boxes in all. Each line stands across the road, as today's two do. Boxes keep today's
  rules: one item to a kart holding none, back after 3 seconds.
- **Bigger and brighter.** A box is drawn 20 world units wide (16 today), over a pool of its light on
  the road that pulses with it; with reduced motion on, the pool stands still with the box.

### Tipping over the edge

- **A kart stands on four wheels,** 6 units ahead of and behind its centre, 3 units to each side.
- **One side leans.** When a side of the kart has more wheels over the void than the other, the kart
  leans towards that side and slides towards the void at 16 units a second: the player can still
  steer back onto the road.
- **Both wheels of one side over the void tip it over.** The kart falls, by today's fall: 1 second
  sinking with no input, then back on the racing line. Today's rule stays too: a kart whose centre is
  7 units past the edge falls.
- **The lean shows.** A leaning kart is drawn rolled towards the void, and a falling one rolls over
  as it sinks; it casts no shadow while it falls.
- **Rivals keep their wheels on the road.** A rival looks a quarter of a second ahead: a wheel over
  the void there, or under it, steers it back, and brakes it when it is faster than a corner
  allows. It turns in for the
  next waypoint 64 units before the corner's waypoint, so it takes a corner on the road.

### The minimap

- **The circuit from above,** in the top right corner of the race, under the item panel and over the
  sky: one game pixel a tile, the road shaded by its height (the higher, the lighter), the start
  line light, over a dark panel framed in cyan. It covers neither the road ahead nor the screen's
  corner buttons.
- **On it:** every box there to take (a gold pixel), every rival on the road (a dot of its own colour,
  hidden while it falls), and the player as a bigger yellow dot with a tick the way it faces, drawn
  last so nothing covers it. The player's dot blinks while the player falls; with reduced motion on,
  it does not blink.
- In MULTI, every other player is a dot on the minimap, as rivals are in SINGLE.

### The cost of drawing it

- **The floor's work is bounded.** Each column of the screen samples the ground outwards from the
  camera, about one screen row a sample, and never takes more than 600 samples: the floor of a frame
  on the wide grid (640 × 360) costs at most 640 × 600 samples, wherever the kart stands on COMET
  RING. The renderer reports how many samples it took, so a test holds that bound.

## Decisions

- **Hills on the racing line, not a height map,** decided while designing: the relief follows the
  legs the karts already drive, so a hill is always along the road, corners are level, and one list
  of heights and bumps describes the whole circuit.
- **One wheel over the void leans the kart, both wheels of one side tip it over,** chosen by the
  person over falling as soon as one wheel is out (every edge becomes a trap) and over a lean that is
  only drawn (the edge costs nothing until the centre is past it).
- **Slopes change the top speed,** chosen by the person over a relief that only shows: the hills are
  felt, uphill slower and downhill faster.
- **The minimap stands in the top right corner, under the item panel,** chosen by the person over the
  bottom right (over the fullscreen button) and the bottom left (over the N button): it sits on the
  sky, where it is easy to read and covers no road.
- **Ten lines of four boxes, one a straight,** decided while designing: "more present" means a box
  on every straight, not more boxes in the same two lines.
- **The cabinet's still stays flat** (decided while designing): the still is a few dozen pixels
  high, where relief would not read, and its renderer is the one the stills test holds.
- **The voice's objection, accepted.** persona:F-E Developer objected: "A per-pixel renderer written
  by an agent and run every frame is where slow frames and bugs reach production on /play. I want a
  guard that bounds its cost, not only colour tests." Settled `accepted`: the floor never takes more
  than 600 samples a column, the renderer reports its count, and a test holds it at every waypoint
  of COMET RING on both grids (**The cost of drawing it**, **Test seams**).
- **No proof video,** chosen by the person.
- **Written from a prototype:** every number in this spec (the relief, the deck, the wheels, the
  rivals' look-ahead and turn-in, the minimap's place) was tried in a race before the spec was
  written. Rivals drove three laps without falling on seeds 1, 7 and 42.

## User stories

- As a racer, I climb a hill on COMET RING, lose speed on the way up, and see the road fall away
  past the crest with the circuit below.
- As a racer, I see the road as a deck floating in space, its side and its glow under every edge.
- As a racer, I find a line of item boxes on every straight.
- As a racer, I put one side of my kart over the void, feel it lean and slide, and steer back before
  both wheels go over and it tips into the void.
- As a racer, I glance at the minimap and see where I am on the lap and where every other kart is.
- As a player in MULTI, I see my colleagues' karts on the minimap as they race.

## Scope

**In:**
- COMET RING's relief, the relief's checks, and the ground's height and slope anywhere.
- The race's floor drawn with its relief, its deck's side and glow, and sprites hidden behind a
  crest; the camera over the ground.
- Slopes on the top speed, for the player and the rivals.
- The four wheels, the lean, the slide and the tip-over, drawn and played; the rivals' look-ahead,
  braking and turn-in.
- Eight new lines of boxes, bigger boxes and their pool of light.
- The minimap, in SINGLE and in MULTI.
- The floor's cost bound and its test.
- The cabinet's still drawn again for the new boxes, and OMNI KART's section of `apps/galaxy/README.md`.

**Out:**
- Jumps, ramps, banked corners, tunnels and bridges: the road never leaves the ground and never
  crosses itself.
- A new circuit, or a change to COMET RING's layout.
- Relief on the cabinet's still.
- Any change to the items' rules, the race's laps, the fall's length or the way back.
- Any change to MULTI's messages: each browser plays the wheels and slopes of its own kart.

## Test seams

Every test is a Vitest test beside the module it tests; none calls GitHub or Supabase (`omni kb show
testing`). The new behaviour is written test-first, from the prototype's numbers.

- **`kart/relief.test.ts`:** the ground is flat on a circuit with no relief; on COMET RING it is a
  waypoint's height at that waypoint, level for 2.5 tiles at both ends of a leg, and the bump at a
  leg's middle; the slope is zero on the flat, positive climbing and negative going down, and changes
  sign with the heading; the range is the lowest and highest ground.
- **`kart/track.test.ts`:** COMET RING's relief passes its checks and spans 26 at most; a relief with
  a height or a bump missing, not a number, or spanning more than 26 is refused, naming why; 40 boxes
  stand in ten lines of four across the road.
- **`kart/kart.test.ts`:** the top speed is 0.67 to 1.33 of the flat one, lower uphill and higher
  downhill; the wheels over the void on each side; one side out leans the kart and slides it towards
  the void; both wheels of one side tip it over; a kart driving straight off an edge falls once its
  rear wheels pass it.
- **`kart/race.test.ts`:** the fall and the push tests follow the new edge; rivals finish three laps
  without falling on seeds 1, 7 and 42 with no player input.
- **`kart/mode7.test.ts`:** the floor draws a hill higher on the screen than the flat road behind it;
  under an edge facing the camera it draws the deck's side, then the glow over what was there; the
  depth of each road pixel is its distance; a sprite on raised ground projects higher; **the cost
  guard** (the objection's answer): at every waypoint of COMET RING, facing the next one, on the wide
  and the tall grid, the floor takes at most 600 samples a column.
- **`kart/art.test.ts`:** a box behind a crest is not drawn; a leaning kart is drawn rolled and a
  falling one rolls further; the minimap stands in the top right corner under the item panel on both
  grids, shows the player's dot, a dot per rival on the road, none for a falling rival, and a gold
  pixel per box there to take.
- **`games/stills.test.ts`:** the still drawn again (`-u`) and checked by eye.
- **Guards that must stay green:** `kart/guard.test.ts` (nothing outside `arcade/kart/` imports it at
  run time) and the layering check.

## Risks

**What merging publishes** (`omni kb show releasing`): the arcade's new code ships with the galaxy
app's deploy. No migration, no data, no change to `submit_score()`: a race time stays a race time.

- **Times get slower or faster.** Slopes and new boxes change how long a lap takes, so best times set
  before this PRD and after it are not quite comparable. COMET RING's layout and its three laps do
  not change, and the best kept is still the lowest.
- **A frame costs more.** The floor samples the ground column by column instead of line by line; the
  cost guard bounds it, and a slow device drops frames, never the race's rules (the race steps on a
  fixed clock).
- **The edges are harder.** A kart with one side out now slides towards the void; the rivals were
  tuned so they do not fall, and the tests hold them on three seeds.
- **The deployment window.** A tab opened before the deploy races today's flat circuit until it
  reloads; in MULTI, a player on the old code and one on the new race the same layout, each with
  their own kart's rules.

**Rollback:** revert the feature PR. Nothing to restore.

## Acceptance criteria

1. On COMET RING, the road rises and falls between the waypoints; every corner is level, and two
   legs meet at the same height.
2. COMET RING's relief spans at most 26 world units, and the circuit's checks refuse a relief that
   spans more, or whose heights or bumps are missing or not numbers.
3. The camera's eye stands 28 units over the ground under the player's kart, so a crest ahead hides
   the road behind it and a descent shows the circuit below.
4. Uphill, a kart's top speed is lower than on the flat, and downhill higher, never under 0.67 nor
   over 1.33 of it; rivals obey the same rule.
5. Under every edge of the road facing the camera, the deck's side shows, 12 units deep, then a
   magenta glow fading into the void.
6. A kart, box, prop, BLOB or ORB behind a crest is hidden where the road in front covers it.
7. Ten lines of four item boxes stand across the road, one on every straight, 40 boxes in all; each
   box is drawn bigger than today, over a pool of its light.
8. A kart with more wheels over the void on one side leans that way and slides towards the void,
   and the player can steer it back onto the road.
9. A kart with both wheels of one side over the void tips over and falls, by today's fall and way
   back; a kart whose centre is 7 units past the edge still falls.
10. On seeds 1, 7 and 42, the five rivals finish three laps without falling.
11. The minimap stands in the top right corner under the item panel, on both grids, covering neither
    the road ahead nor the corner buttons; it shows the road shaded by height, the boxes there to
    take, a dot per kart on the road, and the player's yellow dot with its heading, blinking while
    the player falls (not with reduced motion).
12. In MULTI, every other player shows on the minimap.
13. At every waypoint of COMET RING, on the wide and the tall grid, the floor takes at most 600
    samples a column, as the renderer reports.
14. The cabinet's still is drawn again with the new boxes; its floor stays flat.
15. Nothing outside `arcade/kart/` imports it at run time.
