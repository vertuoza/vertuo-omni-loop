---
prd: 1923
title: "OMNI KART: FROST EIGHT, a second circuit — a figure eight on a snowy mountain that crosses on a frozen lake, picked at a CIRCUIT step, with its own times on the cabinet"
blocked-by: none
spec: file
phase0: server
---

# OMNI KART: FROST EIGHT, a second circuit — a figure eight on a snowy mountain that crosses on a frozen lake, picked at a CIRCUIT step, with its own times on the cabinet

**Date:** 2026-10-14 · **PRD:** #1923
**Touches:**
- `apps/galaxy/src/arcade/kart/line.ts` (`locate` takes the branch a kart was on: the distance along the line it had a step
  before)
- `apps/galaxy/src/arcade/kart/track.ts` (the circuits: COMET RING as today and FROST EIGHT; the surface at the pixel beside
  `roadAt`; the checks of `trackProblems` for a line that crosses itself)
- `apps/galaxy/src/arcade/kart/kart.ts`, `kart/fx.ts`, `kart/rules.ts` (the powder's cap, the slide on the ice, the tree
  line; the tip-over reads the void, never "not road")
- `apps/galaxy/src/arcade/kart/rivals.ts`, `kart/race.ts` (the branch carried by every kart through the progress, the
  places, the rivals' aim and the way back; a race on the circuit it is given)
- `apps/galaxy/src/arcade/kart/relief.ts`, `kart/texture.ts`, `kart/mode7.ts`, `kart/art.ts` (FROST EIGHT's ground, snow,
  ice, snow banks and kerbs, its sky, its props and stands, the minimap's ice)
- `apps/galaxy/src/arcade/kart/options.ts`, `kart/grid.ts`, `kart/hub.ts`, `kart/net.ts`, `kart/index.ts` (the chosen
  circuit kept, sent in MULTI's start, raced by the grid)
- `apps/galaxy/src/arcade/scenes/kart.ts`, `scenes/kart.tsx`, `scenes/kart.css` (the CIRCUIT step, the ready line)
- `apps/galaxy/src/arcade/games/index.ts`, `games/stills.ts`, `scenes/games.tsx`, `ArcadeApp.tsx`,
  `apps/galaxy/src/data/scores.ts` (OMNI KART's two boards: read, sent, and shown in turn on its cabinet)
- `supabase/migrations/` (one new migration: `submit_score` takes the board `kart-frost-eight`), `supabase/checks/`
- `apps/galaxy/README.md` (OMNI KART's section), and the tests beside each

## Problem

OMNI KART has one circuit, COMET RING, and it is in space: a road floating over the void, neon edges, stars, planets and
asteroids. Every race is that race, and every time on the crew's board is a time on it.

The request, as it came: « fais une deuxième map qui sera juste un 8 comme dans Mario mais cette fois pas dans l'espace ! »,
then, of three proposals, « Je prends FROST EIGHT (montagne, croisement sur lac gelé) », and, looking at the OMNI KART
cabinet's CREW TOP 5: « il faut aussi que les scores des 2 maps défilent ici ».

A figure eight crosses itself, and the engine does not allow that today. `locate` answers the nearest point of the centre
line over all its segments; at the crossing both branches are as near, so a kart's distance along the line, its height,
its progress, its place, a rival's aim and the way back could jump from one branch to the other. The kart has no sideways
motion either: its position always follows its nose, so it cannot slide.

## Solution

### The circuits

OMNI KART gets a **register of circuits**, in driving-menu order: COMET RING, then FROST EIGHT. Each circuit is an `id`, a
name, its `TrackSource`, its **scenery** (the sky, the ground off the road, the road's edge and kerbs, its props and stands)
and its **board** (the crew table its times go to). COMET RING's source, scenery and board are today's, byte for byte.

`createKart`, `newRace` and `newMultiRace` take the circuit to race; given none, they race COMET RING, as today. Every
caller that names no circuit, every test of today included, races exactly what it races now.

### The crossing: the branch a kart is on

`locate(line, x, y, hint?)` takes an optional **hint**: the distance along the line the kart had a step before. With a
hint, it answers the nearest point among the stretches of the line within 6 tiles of the hint, either way along it, so a
kart on one branch of the X stays on that branch. Without a hint it answers what it answers today, over every segment.

Every kart (the player's, the rivals', a MULTI opponent's) carries its distance along the line from step to step. The
progress, the places, the waypoints passed, the rivals' aim and look-ahead, and the way back after a fall read `locate`
with it.

The baked maps need no branch: the road is the union of both branches, the crossing is level (both branches at the lake's
height, so the relief is one value there) and the whole lake is ice whatever the branch.

`trackProblems` checks, on a line that crosses itself:

- the ground is level within the lake: both branches at the same height across it;
- no waypoint's gate, and no point of the start line, lies within 8 tiles of the crossing;
- the two branches cross at an angle of at least 60°.

### The surfaces

Beside `roadAt`, `parseTrack` bakes the **surface** at the pixel: `road`, `ice`, `powder` or `void`. COMET RING has `road`
and `void` only, as today. FROST EIGHT has no void: the lake is `ice`, road or not; the rest of the road is `road`; every
other point of the map is `powder`.

- **Powder** caps a kart's top speed at `RULES.powder` × the top speed (0.55), the way a slope scales it today. A kart on
  powder never tips over and never falls: the tip-over, the wheels over the edge and the pull towards it read `void`, never
  "not road".
- **Ice** keeps the top speed and loosens the grip (below).
- **The tree line.** A kart cannot leave FROST EIGHT's map: one tile inside its edge it stops, as at a wall.

### The slide on the ice

The kart gets a **direction of travel** beside its heading. Each step, the direction of travel turns towards the heading by
at most the surface's grip × the step. On `road` and `powder` the grip has no limit: the direction of travel is the heading,
and a kart drives exactly as today. On `ice` the grip is `RULES.iceGrip` (1.2 radians a second): a kart that steers on the
lake turns its nose before its path, drifts wide and comes out of the X off its line. The gap between heading and travel
never exceeds `RULES.iceSlip` (0.6 radians). Leaving the ice, the direction of travel is the heading again.

The rivals drive with the same model, so they slide too, and still finish their laps. Karts that meet at the X push each
other apart as anywhere else (`pushApart`).

### FROST EIGHT

A figure eight standing up on 72×72 tiles, the road 5 tiles wide like COMET RING's. The top loop is driven clockwise, the
bottom loop anticlockwise, and the two diagonals cross at the middle of the map, at about 62°.

| # | waypoint (tiles) | radius | where |
|---|---|---|---|
| 1 | `[56, 64]` | 5 | bottom loop, bottom right: from the start straight, north |
| 2 | `[56, 48]` | 4 | onto the diagonal, north-west through the crossing |
| 3 | `[16, 24]` | 4 | top loop, off the diagonal, north |
| 4 | `[16, 8]` | 5 | top left, east along the top straight |
| 5 | `[56, 8]` | 5 | top right, south |
| 6 | `[56, 24]` | 4 | onto the diagonal, south-west through the crossing |
| 7 | `[16, 48]` | 4 | bottom loop, off the diagonal, south |
| 8 | `[16, 64]` | 5 | bottom left, east along the start straight |

- **The frozen lake:** a disc of ice 12 tiles across, centred on the crossing at `[36, 36]`.
- **The start:** the start line across the bottom straight at `x = 32`, heading east; the six starting places behind it.
- **The relief:** the top loop climbs to a pass on the top straight and comes down to the lake; the bottom loop stays
  nearly flat; the lake is level, at the ground's base height.
- **Features:** a row of item boxes on the top straight and one on the start straight past the line; a boost pad on the
  right side of each loop. No ramp, no gap, no tunnel, no shortcut.
- **The road's edge:** a snow bank in place of the neon deck; red and white kerbs round the curves.
- **The scenery:** pines, chalets, ski-lift pylons, snowmen and signs, on powder, clear of the road; stands on the snow
  beside the start straight; a wooden start arch. The sky is a pale blue fading to white, snowy peaks along the horizon, a
  low sun, and falling flakes; with reduced motion the flakes stand still.
- **The minimap** is today's, drawn from `roadAt`, with the lake in light blue.
- **The music** is today's race and last-lap songs.

### Choosing the circuit

A **CIRCUIT** step comes after SINGLE and after MULTI: ◀ ▶ moves between COMET RING and FROST EIGHT, each shown by its name,
its minimap and the player's best time on it (`NO TIME YET` when there is none). A races it (SINGLE) or goes to the grid
(MULTI); B goes back. The hint reads `◀ ▶ CHOOSE · A RACE · B BACK` (`A GRID` after MULTI).

The choice is kept in `omni-loop:kart-options` as `track`, and the CIRCUIT step opens on it. A stored value with no
`track`, or one that names no circuit, reads as COMET RING. The ready screen's title before the pick, and the ready line,
name the circuit kept: `FROST EIGHT · 3 LAPS`.

### MULTI

The grid races the circuit of its first arrival, as it races their laps: each player's Presence entry carries their
`track`, and the grid shows the circuit's name. The `start` message carries an optional `track`; a start without one is
raced on COMET RING. A start whose `track` names no circuit is a message the client cannot read, ignored like any other.
The grid's channel, `kart:<workspace>`, stays as it is. On the grid, each player's best is their time on the grid's circuit.

### The boards

The registry's OMNI KART names two boards: `kart`, COMET RING's, and `kart-frost-eight`, FROST EIGHT's. A race finished
on a circuit sends its time to that circuit's board. `readScores` reads both.

One migration replaces `submit_score`: `kart-frost-eight` is accepted when the player has `kart` unlocked, and keeps the
lowest time, as `kart` does. It deletes and rewrites no row. `measure.guard.test.ts` holds the SQL list of lowest-wins
boards equal to the registry's time boards.

A second migration, the newest, starts COMET RING's times over: it deletes the rows of `arcade_scores` on the board
`kart`, in every workspace, and nothing else, as PRD 1698's did when the circuit got its hills. COMET RING changed since
(its curves and its vaulted tunnel, #1840), so the times set before stay out of reach. The weekly export keeps them; a
revert does not bring them back.

### The cabinet

OMNI KART's lit cabinet shows its circuits in turn, five seconds each: the circuit's still on its screen, then the line
`CREW TOP 5` with the circuit's name at its right, `COMET RING` or `FROST EIGHT`, over that board's five best times, the
player's own line highlighted as today. The name shares the heading's line because `CREW TOP 5 · FROST EIGHT` is wider than
the cabinet's 160 px of text on the wide grid; side by side, the two fit in 153 px at 7 px a character. A board with no
time shows `NO SCORES YET`; a board that cannot be read shows `SCORES OUT OF REACH`, each on its own turn. The turn is a
cut, never a slide, so reduced motion has nothing to remove. FROST EIGHT gets a still of its own start; COMET RING's still
is unchanged.

### What stays as it is

COMET RING (its line, its road, its scenery; its times start over, as **The boards** says), the five rivals and their levels, the items, the laps option and
the difficulty, the controls, the songs, OMNI KART's unlock at LV 3, and every other game and cabinet.

## Decisions

- **FROST EIGHT,** a snowy mountain with its crossing on a frozen lake, chosen by the person over CLOVER EIGHT (a meadow,
  a plain level crossing) and SUNSET BAY (a beach, a bridge over the crossing).
- **A level crossing,** not a bridge: the ground stays one height at each point, and a bridge, which needs a ground with
  two levels, stays out.
- **The branch a kart is on,** chosen by the person over reading the progress from the gates alone, which would have
  changed COMET RING's places too and left the rivals' aim ambiguous.
- **A real slide,** chosen by the person over a softer steering alone: the kart gets a direction of travel, bounded.
- **A CIRCUIT step,** chosen by the person over a line in OPTIONS and over both.
- **One board per circuit,** chosen by the person over keeping FROST EIGHT's times off the board: one migration.
- **FROST EIGHT is open with OMNI KART,** at LV 3, chosen by the person over a later level or a race finished first: no
  change to the rulebook.
- **The cabinet shows both boards in turn,** asked by the person while the design was shown.
- **The objection of persona:Lead Engineer, accepted:** « Je regarde le board pour garder la cohérence entre les équipes.
  Un seul PRD qui touche le moteur du kart, une migration Supabase et le protocole MULTI, ça fait trois choses de nature
  différente à relire d'un coup. » The plan lands the branch and the surfaces (nothing a player sees), the migration, and
  MULTI's `track` each in a slice of its own, readable alone, before the circuit.
- **Set in the design the person approved:** powder at 0.55 × the top speed; the ice's grip of 1.2 radians a second and
  slip of 0.6; the tree line stops a kart; today's songs; the grid races its first arrival's circuit; a start naming no
  circuit is ignored.
- **No proof video,** chosen by the person.
- **COMET RING's times start over,** asked by the person during the build (2026-10-14), over a pull request of its own:
  the reset migration ships with FROST EIGHT, so both boards start empty together.

## User stories

- As a player, I pick FROST EIGHT at the CIRCUIT step and race three laps of a figure eight on a snowy mountain.
- As a player, I cross the frozen lake twice a lap, feel my kart slide on it, and meet rivals coming across the X.
- As a player, I run wide into the powder and lose speed, but I never fall off the mountain.
- As a player, the CIRCUIT step opens on the circuit I raced last, and shows my best time on each.
- As a player in MULTI, the grid races the circuit its first arrival picked, and I see its name before the start.
- As a member of the crew, I watch the OMNI KART cabinet show COMET RING's top five, then FROST EIGHT's, in turn.

## Scope

**In:** the register of circuits; `locate`'s hint and the branch every kart carries; the surface at the pixel; powder, ice,
the slide and the tree line; FROST EIGHT's line, lake, relief, features, scenery, sky, minimap and still; the CIRCUIT step
and the `track` option; MULTI's `track`; the board `kart-frost-eight`, its migration and check; the reset of COMET RING's times;
the cabinet's turns; the README; the guards and the tests below.

**Out:** a bridge, or any ground with two levels; a new song; a third circuit; a circuit unlocked later; a ghost or a time
trial; any change to COMET RING's driving or scenery; the touch controls.

## Test seams

Pure modules, tested beside them as today (`omni kb show testing`): no browser, no network, no Supabase, every race stepped
from a seed.

- `kart/line.test.ts`: at the crossing, `locate` with a hint on either branch answers that branch; without a hint, on a
  grid of points over COMET RING, it answers what it answers today.
- `kart/track.test.ts`: `trackProblems(FROST_EIGHT)` is empty; a crossing not level, a gate or a start line within 8 tiles
  of the crossing, and a crossing under 60°, are each refused; FROST EIGHT's 8 waypoints and radii are those of the table;
  the surface is `ice` across the lake, `road` on the rest of the road, `powder` everywhere else, and never `void`;
  COMET RING's surface is `road` where `roadAt` is true and `void` elsewhere.
- `kart/kart.test.ts`: on powder the speed settles at 0.55 × the top speed and the kart never tips over; on ice the gap
  between heading and travel grows when steering and never passes 0.6 radians; on road the direction of travel is the
  heading at every step, and every test of today passes unchanged; at the tree line a kart stops.
- `kart/race.test.ts`: on FROST EIGHT, on seeds 1, 7 and 42, at the levels easy, normal and hard, the five rivals finish
  three laps; no kart's progress goes back while it crosses the X; no lap is counted twice.
- `kart/options.test.ts`: `track` kept and read back; a store without it, or naming no circuit, reads as COMET RING.
- `kart/net.test.ts`, `kart/hub.test.ts`, `kart/race.multi.test.ts`: a start with `track` races it; one without races
  COMET RING; one naming no circuit is ignored; the grid races its first arrival's circuit.
- `scenes/kart.test.ts`: the CIRCUIT step after SINGLE and after MULTI, ◀ ▶, A and B, and the ready line with the circuit.
- `data/scores` tests and `measure.guard.test.ts`: both boards read; a time sent to its circuit's board; the lowest-wins
  list equal to the time boards.
- `scenes/games` tests: the kart cabinet's turns every five seconds, each with its circuit's still and heading, and each
  board's `NO SCORES YET` and `SCORES OUT OF REACH`; `games/stills.test.ts`: FROST EIGHT's still added, COMET RING's
  unchanged.
- `supabase/checks/`: a player with `kart` unlocked submits to `kart-frost-eight` and keeps the lower of two times; one
  without it is refused; a time on `kart-frost-eight` changes nothing on `kart`.

## Risks

- **The kart's model.** A direction of travel beside the heading touches every step of every kart: on road it equals the
  heading, and the race's tests of today must pass unchanged, which holds COMET RING as it is.
- **The branch at the X.** A hint that drifts would send a kart's progress or a rival's aim to the other branch: the race
  test on three seeds and three levels guards it.
- **MULTI across a release.** A player still on a tab opened before the release ignores `track` and races COMET RING while
  the others race FROST EIGHT, until the tab reloads.
- **The frame's cost.** The snowy sky, its peaks and flakes are drawn each frame; reduced motion stops the flakes.
- **The stills.** `games/stills.test.ts` gains FROST EIGHT's still; COMET RING's is regenerated only if its drawing changes,
  and it must not.
- **What merging publishes:** the galaxy app's arcade at the next release, and the migration, applied to the production
  Supabase project by the `supabase` workflow (`omni kb show releasing`). Rolled back by reverting the feature PR and
  shipping a migration that restores today's `submit_score`; the rows on `kart-frost-eight` stay, read by nothing. The
  rows the reset deleted from `kart` do not come back with a revert: the weekly export (`pnpm game:export`) keeps them.
- **The locked laws: none touched.** `omni kb laws` prints all twenty for every file here, none scoped by path. The two
  nearest hold: N-PRODUCT-16, the game's ledger only added to, because `arcade_scores` is not the ledger: the first
  migration rewrites no row, and the reset deletes only the `kart` rows of `arcade_scores`, as PRD 1698's did; N-PRODUCT-17, no secret in the browser, because the browser gains only a board's name.

## Acceptance criteria

1. The CIRCUIT step comes after SINGLE and after MULTI, shows COMET RING and FROST EIGHT with their names, minimaps and the
   player's best on each, and opens on the circuit raced last.
2. FROST EIGHT is a figure eight on 72×72 tiles whose 8 waypoints and radii are those of the table, its two diagonals
   crossing at 60° or more on a frozen lake 12 tiles across.
3. On FROST EIGHT, on seeds 1, 7 and 42, at every level, the five rivals finish three laps, and no kart's progress goes back
   while it crosses the lake.
4. On FROST EIGHT's powder a kart slows to 0.55 × the top speed and never falls; at the tree line it stops.
5. On the lake a steering kart slides: its path lags its nose by up to 0.6 radians; off the lake it does not.
6. COMET RING drives and looks exactly as before: every test of today passes unchanged and its still is unchanged. Its
   times start over: once the migrations run, the board `kart` is empty in every workspace.
7. A race on FROST EIGHT sends its time to `kart-frost-eight`, which keeps the lowest; `kart` is unchanged by it.
8. In MULTI, the grid races its first arrival's circuit and shows its name; a start without a circuit races COMET RING.
9. The OMNI KART cabinet shows COMET RING's top five, then FROST EIGHT's, in turn every five seconds, each with its still
   and `CREW TOP 5` with the circuit's name on the same line, each with its own `NO SCORES YET` or `SCORES OUT OF REACH`.
