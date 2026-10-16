---
prd: 1963
title: "OMNI KART: the drift — a slippery ice, a hop that drifts into a mini-turbo, a rocket start and the slipstream"
blocked-by: none
spec: file
phase0: server
---

# OMNI KART: the drift — a slippery ice, a hop that drifts into a mini-turbo, a rocket start and the slipstream

## Problem

FROST EIGHT (PRD 1923) shipped a frozen lake that barely slides. On ice the direction of travel turns towards the heading
at 1.2 radians a second, while at the top speed the nose turns at 1.56 (`turnRate`): the path lags the nose by 0.36 radians
a second, and needs 1.7 seconds to reach its 0.6 cap. The road crosses the lake on straight diagonals, in about 1.75
seconds, so a kart is barely steered there, and nothing else changes on ice: the gas, the brake and the coast are the
road's, and the path snaps back to the nose on leaving it. The person who asked put it plainly: the ice does not slide
enough.

OMNI KART also has nothing that rewards a driver's skill beyond the line they take: no drift, no start to time, no
slipstream to chase, and no sound or mark that says a kart is sliding. The person asked for Mario Kart's: a hop that drifts
round a bend and pays a small boost, a boost for the gas pressed between the 2 and the 1 of the countdown, the slipstream,
and the snow, marks, screech and sparks that let a player feel it.

## Solution

Every number below is a starting point in `RULES` (`kart/rules.ts`), named there, so a follow-up tunes the feel without
touching the engine. Every turbo below is today's BOOST (`fx.boost`, 1.4 × the top speed, the gas held): a turbo makes the
BOOST last at least its time, and never cuts one that runs longer.

### The ice

- On `ice` the direction of travel turns towards the heading at `RULES.iceGrip` = **0.4** radians a second (was 1.2), and
  never lags it by more than `RULES.iceSlip` = **1.0** radian (was 0.6). At the top speed, steering full lock, the gap
  reaches 1.0 radian in under a second.
- On `ice` the gas adds `RULES.iceAccel` = **0.6** × what it adds on road, the brake takes off `RULES.iceBrake` = **0.4** ×,
  and letting go takes off `RULES.iceCoast` = **0.3** ×. Reversing follows the same shares. The top speed is kept.
- **The way back.** A kart that carries a direction of travel (`travel`) on `road` or `powder`, and is not drifting, sees
  it turn towards the heading at `RULES.grip` = **6** radians a second; within 0.01 radian of the heading `travel` is
  dropped, and the kart travels the way it faces, as today. COMET RING has no ice, so a kart there carries `travel` only
  after a drift.
- **Two frozen patches on FROST EIGHT.** Beside the lake, two discs of ice **6 tiles across**, each centred on the middle of
  a bend's curve: bend 4 (`[16, 8]`, top left, east along the top straight) and bend 8 (`[16, 64]`, bottom left, the last
  bend before the line). The track's `lake` becomes a list of ice discs, the lake first; the floor is `ice` inside any of
  them. The patches are drawn as the lake is, in the ground's texture and in light blue on the minimap.
- **The rivals on ice** pick their speed for a bend as today. On an icy bend they slide wide into the powder, as a player
  who does not brake does, and still finish their laps.

### The hop and the drift

- **HOP** is a sixth drive key: SPACE by default, held as the arcade's `up` (▲ on the Game Boy's pad).
- **The hop.** HOP going down, with the kart on the ground, not falling and not spinning out, makes it hop: drawn
  `RULES.hopHeight` = **4** pixels up and back down over `RULES.hopTime` = **0.25** seconds. The hop is drawn only:
  `airborne` never sees it, so a hopping kart takes boxes, pads, BLOBs, ORBs and pushes, tips over and falls exactly as on
  the ground. HOP pressed in the air (a ramp's jump), or while a hop runs, does nothing.
- **The drift starts** when the hop lands with HOP still held, ◀ or ▶ held at that moment (its side is the drift's), and
  the speed at least `RULES.driftMin` = **0.5** × the top speed. No arrow held: the hop was only a hop.
- **While drifting** (HOP held), the kart always turns towards the drift's side: at `RULES.driftTight` = **2.2** radians a
  second with the drift's arrow held, `RULES.driftMid` = **1.5** with neither, `RULES.driftWide` = **0.9** with the other
  arrow. The direction of travel turns towards the heading at `RULES.driftGrip` = **0.8** radians a second and never lags
  it by more than `RULES.driftSlip` = **0.45** radian, so the nose points into the bend. On ice the lower grip and the
  larger slip of the two hold, so a drift on the lake runs wider.
- **The charge** (`fx.charge`, seconds) grows while drifting on `road` or `ice`, and stands still on `powder`. Blue sparks
  from `RULES.chargeBlue` = **0.8** seconds, orange from `RULES.chargeOrange` = **1.8**.
- **Releasing HOP** ends the drift: an orange charge gives a BOOST of `RULES.miniOrange` = **1** second, a blue one
  `RULES.miniBlue` = **0.5**, less than blue nothing. The direction of travel then comes back to the heading by the way
  back above.
- **A drift is lost**, its charge with it and no turbo: on ▼, on a BLOB or ORB hit (the spin-out), when a fall starts,
  when it tips over, when the tree line stops it, when its speed drops under `RULES.driftMin` × the top speed, when it
  leaves the ground on a ramp, and when the race ends.

### The rivals' drift

- At **HARD** only, a rival hops at a bend's entry when its look ahead (`rivalHorizon`, `rivalHorizonTime`) finds a turn
  of radius under `RULES.rivalDriftRadius` = **8** tiles and its speed is at least `RULES.driftMin` × the top speed. It
  drifts towards the bend's side, steering at its aim as today (its aim picks tight, mid or wide), and releases HOP when the
  turn ahead opens past that radius, taking the turbo its charge earned.
- A HARD rival never starts a drift with a wheel over the void within its look (`rivalLook`), and releases a drift at once
  when the void comes into it.
- EASY and NORMAL rivals never hop.

### The rocket start

- The countdown shows **3** for its first second, **2** for its second, **1** for its third (`RULES.countdown`). The race
  keeps when GAS last went down during it; GAS already held when the countdown starts counts as pressed during the 3.
- **At GO**, with GAS held:
  - pressed down last during the **2**: a BOOST of `RULES.rocketTime` = **0.8** seconds, and `TURBO` under GO;
  - pressed down last during the **3**: the engine **stalls**: for `RULES.stallTime` = **0.5** seconds the kart does not
    move whatever is held, black smoke puffs behind it and the engine sputters;
  - pressed down during the **1**: a normal start.
  GAS not held at GO: a normal start. Only the last press counts: pressed during the 3, let go and pressed again during the
  2, it is a rocket start.
- **The rivals** draw a rocket start at GO, from the race's seed, with a chance per level: `RULES.levels.<level>.rocket` =
  **0.2** EASY, **0.4** NORMAL, **0.7** HARD. A rival never stalls.
- **MULTI:** each player's start is their own, timed on their own countdown.

### The slipstream

- A kart at **0.6** × the top speed or more (`RULES.draftMin`), within **48** pixels (`RULES.draftRange`) behind another
  kart also at `draftMin` or more, and within **0.3** radian (`RULES.draftLine`) of the line straight back from that
  kart's heading, builds a slipstream. **1.2** seconds of it in a row (`RULES.draftTime`) give a BOOST of **0.6** seconds
  (`RULES.draftBoost`) and start the count again. Leaving the cone starts it again from 0.
- Every kart gives one and takes one: the player, the rivals, and in MULTI the other players' karts at their carried
  positions. A kart in the air or falling neither gives nor takes.

### The feel

All of it is drawn by `art.ts` from pure, seeded state in `fx.ts`, under its particle cap; the sound is the arcade's own
engine (`sound.ts`), no audio file.

- **Snow:** a kart on `powder` faster than `draftMin` × the top speed throws snow behind its rear wheels.
- **Skid marks:** while the gap between heading and travel is over `RULES.skidGap` = **0.15** radian, or a drift runs, the
  rear wheels leave two marks, white scratches on ice and snow, dark on road, each fading out over **3** seconds; at most
  `MAX_MARKS` live at once, the oldest going first.
- **Sparks:** a drifting kart throws blue sparks from its rear wheels once its charge is blue, orange once it is orange.
- **Wind:** white lines stream past a kart while its slipstream builds.
- **Sounds** (the player's own kart only): a **screech**, a second continuous voice under the music like the engine's hum,
  on while the gap is over `skidGap` or a drift runs, louder as the gap grows; a **tick** when the sparks turn blue and
  again when they turn orange; a **whoosh** when a mini-turbo, a rocket start or a slipstream fires; a **sputter** on a
  stall. The engine's hum rises while GAS is held during the countdown.
- **Reduced motion:** no particle moves. The sparks stay, as a still glow in their colour at the rear wheels, because they
  tell the charge; the snow, the smoke and the wind are not drawn; the skid marks stay, since they do not move.
- In MULTI the other players' karts are drawn without hop, sparks or marks: nothing is added to MULTI's messages.

### The keys

- The player's keys become six: GAS ▲, BRAKE ▼, LEFT ◀, RIGHT ▶, **ITEM SHIFT**, **HOP SPACE**. OPTIONS › KEYS lists the six,
  HOP last, and DEFAULTS restores them.
- **SHIFT can be bound.** The reserved keys are ENTER, TAB, ESC, M and F. In OMNI KART, SHIFT stands for SELECT only when none
  of the player's keys is SHIFT; TAB is SELECT always. So ITEM on SHIFT never leaves a paused race.
- **The keys a player saved are kept.** `omni-loop:kart-options` read back with five keys:
  - equal to the old defaults (▲ ▼ ◀ ▶ and SPACE for ITEM) → the new six defaults;
  - otherwise its five keys are kept, and HOP takes the first of SPACE, X, C and V that none of them holds.
  Six keys read back as today's rule reads five: all there, none reserved, no key twice, or the defaults.
- The countdown's line names the six: `▲ GAS ◀ ▶ STEER ▼ BRAKE SPACE HOP SHIFT ITEM`, with the player's own keys.
- On the Game Boy's pad, HOP is ▲ and ITEM stays B.

### What stays as it is

COMET RING's driving when HOP is never pressed and the start is a normal one; the items, their draw and their rules; the
rivals' line, pace and rubber band at every level, but for the HARD drift and the rocket start; the circuits' lines,
scenery and skies (FROST EIGHT gains its two patches); the boards and the times on them; the songs; MULTI's messages; the
touch layout but for ▲; and every other game and cabinet.

## Decisions

- **One PRD for the feel of driving,** asked by the person: the ice, the hop and drift, the rocket start, the slipstream
  and the feel, rather than one PRD each.
- **The hop stays on the ground,** chosen by the person over a real jump: no dodging a BLOB or an ORB by hopping, no
  hopping along the void's edge to stop a tip-over.
- **The HARD rivals drift,** chosen by the person over no rival drifting and over every rival drifting.
- **HOP on SPACE and ITEM on SHIFT,** chosen by the person over X, C or ALT for HOP. SHIFT therefore stops being one of the
  arcade's reserved keys in OMNI KART; TAB stays SELECT, and SHIFT is SELECT in OMNI KART only when unbound.
- **Every turbo is today's BOOST,** for its own time (0.5, 1, 0.8, 0.6 seconds): one mechanism, no new speed factor.
- **A stall for a GAS pressed during the 3,** in the design the person approved: without it, holding GAS from the start
  would always pay the turbo.
- **The rivals' rocket start at 20 %, 40 % and 70 %,** in the design the person approved, never a stall.
- **The two frozen patches** on bends 4 and 8, in the design the person approved; FROST EIGHT's lake stays where it is.
- **The boards are kept,** not reset: a drift makes a lap faster, so the times already there are beaten, never out of
  reach. The most reversible choice: a reset deletes rows.
- **MULTI's messages are not changed:** the others' karts show no sparks, hop or marks.
- **No proof video,** chosen by the person.
- **The objection of persona:B-E DEv, accepted:** « Je vois déjà cet outil comme un gadget, et un sixième PRD sur le kart
  plutôt que sur l'outil me le confirme. Si le jeu reste, qu'au moins il ne me coûte rien à relire : un seul PRD qui touche
  le moteur, les rivaux, les touches et le son d'un coup, c'est trop. » The plan lands the ice, the keys, the hop and drift,
  the HARD rivals' drift, the rocket start, the slipstream and the feel each in a slice of its own, readable alone, and no
  slice mixes the engine, the rivals and the sound.

## User stories

- As a player on FROST EIGHT, I steer on the lake and in its two icy bends and feel my kart slide wide.
- As a player, I hop with SPACE into a bend, hold it with an arrow to drift, watch the sparks turn blue then orange, and let
  go for a mini-turbo out of the bend.
- As a player, I press the gas during the 2 and shoot off at GO; pressed too early, my engine stalls.
- As a player, I tuck in behind a rival on a straight and get pulled past it.
- As a player, I see the snow, the marks and the sparks, and hear the screech, the ticks and the whoosh.
- As a player racing at HARD, I watch the rivals drift and boost out of the tight bends too.
- As a player who chose their keys, I keep them, and find HOP added.

## Scope

**In:** the ice's numbers and the way back; FROST EIGHT's two frozen patches; the hop, the drift, its charge and its
mini-turbos; the HARD rivals' drift; the rocket start, the stall and the rivals' rocket start; the slipstream; the snow, the
skid marks, the sparks, the wind, the screech, the ticks, the whoosh, the sputter and the countdown's rev; the sixth key,
SHIFT bindable, the saved keys' reading, OPTIONS › KEYS and the countdown's line; the README's OMNI KART section; the tests
below.

**Out:** a drift at EASY or NORMAL; a third colour of sparks; a drift held through the air; tricks on a ramp; a ghost or a
time trial; coins; speed classes or a mirror mode; anything added to MULTI's messages; a new song; a new item or a change to
the items; a reset of the boards.

## Test seams

Pure modules, tested beside them as today (`omni kb show testing`): no browser, no network, no Supabase, every race stepped
from a seed.

- `kart/kart.test.ts`: on ice at the top speed, steering full lock, the gap between heading and travel reaches 1.0 radian
  within a second and never passes it; on ice the gas, the brake and the coast act at 0.6, 0.4 and 0.3 of the road's; off
  the ice `travel` turns back at 6 radians a second and is dropped within 0.01 radian; a hop is drawn 4 pixels high over
  0.25 seconds and `airborne` is false through it; a drift starts only on landing, with HOP and an arrow held, at half the
  top speed or more; it turns at 2.2, 1.5 and 0.9 radians a second; its charge grows on road and ice and stands still on
  powder; released at 0.8 and 1.8 seconds it gives a BOOST of 0.5 and 1 second, under 0.8 none; ▼, a spin-out, a fall, a
  tip-over, the tree line, the speed under half, a ramp's jump each lose it with no turbo; a turbo never shortens a BOOST
  already running.
- `kart/race.test.ts`: GAS pressed last during the 2 gives a BOOST of 0.8 seconds at GO; during the 3, or held since the
  countdown started, a 0.5-second stall in which the kart does not move; during the 1, a normal start; pressed during the
  3, let go and pressed during the 2, a rocket start; the rivals' rocket starts drawn from the seed at 0.2, 0.4 and 0.7,
  never a stall; 1.2 seconds in a kart's slipstream give a BOOST of 0.6 seconds and leaving the cone resets the count; on
  FROST EIGHT and COMET RING, on seeds 1, 7 and 42, at the levels easy, normal and hard, the five rivals finish three laps.
- `kart/rivals.test.ts`: a HARD rival hops at a bend tighter than 8 tiles and releases once it opens; never with the void
  in its look; EASY and NORMAL rivals never hop.
- `kart/track.test.ts`: FROST EIGHT's surface is `ice` across the road's width at the middle of bends 4 and 8, as on the
  lake; COMET RING has no ice.
- `kart/options.test.ts`: six keys kept and read back; SHIFT can be bound, ENTER, TAB, ESC, M and F cannot; five saved keys
  equal to the old defaults read as the new defaults; five custom keys are kept and HOP takes the first free of SPACE, X,
  C and V; DEFAULTS gives the six.
- `kart/fx.test.ts`: snow only on powder and fast; marks only over the gap or in a drift, fading out over 3 seconds, at
  most `MAX_MARKS`; sparks blue then orange; with reduced motion no particle moves and the sparks stay as a glow.
- `scenes/kart.test.ts` and `scenes/kart.hud.test.ts`: OPTIONS › KEYS lists six rows, HOP last; the countdown's line names
  the six; `TURBO` shows under GO on a rocket start; the cues map to the screech, the tick, the whoosh and the sputter.
- `keys.test.ts`, or the test of the arcade's key routing: in OMNI KART, SHIFT bound to ITEM fires the item in the race and
  never selects on the pause; unbound, SHIFT is SELECT; TAB is SELECT always.
- Every kart test of today passes unchanged, but those that hold GAS through the countdown's 3, which now stall and are
  changed to press GAS at GO, and those that pin a rival's exact place or time, which the rivals' rocket start moves: each
  such change is named in its slice's pull request.

## Risks

- **Every kart's step.** The way back and the drift touch every step of every kart. A kart that never hops, on road, carries
  no `travel`, and the tests of today hold COMET RING as it is.
- **The saved keys.** Today's reading falls back to the defaults whenever a key is missing, which would wipe every
  player's keys on the first read of six. The reading of five saved keys is tested for both cases above.
- **SHIFT freed in OMNI KART.** A player who knew SHIFT as SELECT on the pause now has TAB only; the pause's hint already
  names TAB. A slip here would let ITEM leave a race: the key routing's test guards it.
- **The HARD rivals at the void.** A drift that runs wide on COMET RING's gaps or tunnel would drop a rival: the race test on
  three seeds and three levels, and the rule that no drift starts with the void in its look, guard it.
- **The frame's cost.** Snow, sparks, wind and smoke share the particle cap of today; the marks have a cap of their own.
- **A second voice.** The screech plays under the music beside the engine's hum; muted, the master is silent.
- **What merging publishes:** the galaxy app's arcade at the next release (`omni kb show releasing`). No migration, no
  change to a board or to MULTI's messages. Rolled back by reverting the feature PR. A player's six saved keys then read
  back under today's rule, which refuses SHIFT as reserved and gives the five defaults.
- **The locked laws: none touched.** `omni kb laws` prints all twenty for every file here, none scoped by path. The two
  nearest hold: N-PRODUCT-16, the game's ledger only added to, because no score, time or ledger row is written differently;
  N-PRODUCT-17, no secret in the browser, because the change is the arcade's own code and nothing is fetched.

## Acceptance criteria

1. On FROST EIGHT's lake, a kart at the top speed steering full lock sees its path lag its nose by 1.0 radian within a
   second, never more; on ice the gas, the brake and the coast act at 0.6, 0.4 and 0.3 of the road's; off the ice the
   path comes back to the nose at 6 radians a second.
2. FROST EIGHT's bends 4 and 8 are ice across the road's width at the middle of their curve, drawn as the lake is and in
   light blue on the minimap.
3. HOP makes a kart hop 4 pixels for 0.25 seconds, drawn only: through it the kart takes boxes, pads, BLOBs, ORBs and pushes,
   and tips over and falls, as on the ground.
4. A hop that lands with HOP and ◀ or ▶ held, at half the top speed or more, starts a drift on that side that lasts while
   HOP is held, turning at 2.2, 1.5 or 0.9 radians a second with the drift's arrow, neither or the other.
5. Released after 0.8 seconds of charge a drift gives a BOOST of 0.5 seconds, after 1.8 seconds one of 1 second, before 0.8
   nothing; the charge stands still on powder; ▼, a hit, a fall, a tip-over, the tree line, the speed under half or a
   ramp's jump lose it.
6. At HARD the rivals drift through the bends tighter than 8 tiles, never with the void in their look; at EASY and NORMAL
   they never hop; on FROST EIGHT and COMET RING, on seeds 1, 7 and 42, at every level, the five rivals finish three laps.
7. GAS pressed last during the 2 and held at GO gives a BOOST of 0.8 seconds and `TURBO` under GO; pressed last during the 3,
   or held since the countdown began, stalls the kart for 0.5 seconds with smoke and a sputter; during the 1, a normal
   start. The rivals start with a turbo at 20 %, 40 % and 70 % by level, and never stall.
8. 1.2 seconds within 48 pixels behind a kart and 0.3 radian of its line, both at 0.6 × the top speed or more, give a BOOST
   of 0.6 seconds, to the player and the rivals alike, and in MULTI behind another player's kart.
9. A kart throws snow on powder, leaves marks fading over 3 seconds on ice and in a drift, throws blue then orange sparks
   while its charge grows, and streams wind while its slipstream builds; the player hears the screech, a tick at blue and
   at orange, a whoosh at every turbo and the engine rising with GAS in the countdown. With reduced motion no particle
   moves and the sparks stay as a glow.
10. The player's keys are six, ITEM on SHIFT and HOP on SPACE by default; SHIFT can be bound and is SELECT in OMNI KART only
    when unbound, so ITEM never leaves a paused race; five saved keys equal to the old defaults become the new six, five
    custom keys are kept with HOP on the first free of SPACE, X, C and V; OPTIONS › KEYS lists the six and the countdown's
    line names them.
11. COMET RING drives as before when HOP is never pressed and the start is normal: every kart test of today passes, but
    those named in their slice's pull request for GAS held through the 3 or a rival's pinned place.
12. MULTI's messages are unchanged: a player drifts, starts and slipstreams on their own, and the others' karts are drawn
    without hop, sparks or marks.
