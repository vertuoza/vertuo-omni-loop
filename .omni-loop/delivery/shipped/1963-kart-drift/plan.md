# Plan: OMNI KART's drift — a slippery ice, a hop that drifts into a mini-turbo, a rocket start and the slipstream

PRD #1963, specified in `spec.md` beside this plan. The feature branch `feat/kart-drift` merges into
`main` through one feature PR (`Closes #1963`); each slice is a sub-PR from `feat/kart-drift--<slice>`
into the feature branch (`Part of #1963`). One landing: no migration, no board and no change to
MULTI's messages.

The objection of persona:B-E DEv, accepted in the spec's **Decisions**, shapes the plan: the ice,
the frozen patches, the keys, the hop and drift, the HARD rivals' drift, the rocket start, the
slipstream, what the player sees and what the player hears each land in a slice of their own,
readable alone. No slice touches the engine, the rivals and the sound at once.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | the ice slides: on `ice` the direction of travel turns towards the heading at `RULES.iceGrip` 0.4 rad/s and never lags it by more than `RULES.iceSlip` 1.0 rad; the gas, the brake and the coast act at `iceAccel` 0.6, `iceBrake` 0.4 and `iceCoast` 0.3 of the road's; the way back: off the ice `travel` turns back at `RULES.grip` 6 rad/s and is dropped within 0.01 rad | `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/rivals.test.ts` `apps/galaxy/src/arcade/kart/race.frost.test.ts` | — | 1 |
| s2 | FROST EIGHT's two frozen patches: the track's `lake` becomes a list of ice discs, the lake first; two discs 6 tiles across on the middle of bend 4 and bend 8's curves; drawn as the lake is, on the ground and in light blue on the minimap | `apps/galaxy/src/arcade/kart/track.` `apps/galaxy/src/arcade/kart/art.snow.` `apps/galaxy/src/arcade/kart/art.circuit.test.ts` `apps/galaxy/src/arcade/kart/texture.frost.test.ts` `apps/galaxy/src/arcade/kart/race.frost.test.ts` | — | 2 |
| s3 | the six keys: HOP on SPACE, held as `up`, and ITEM on SHIFT by default; SHIFT can be bound, and is SELECT in OMNI KART only when unbound; five saved keys read back by the spec's rule; OPTIONS › KEYS lists six rows, HOP last; the countdown's line names the six | `apps/galaxy/src/arcade/kart/options.` `apps/galaxy/src/arcade/kart/index.ts` `apps/galaxy/src/arcade/keys.` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/scenes/kart.` | — | 1 |
| s4 | the hop and the drift: HOP going down makes a kart hop 4 px for 0.25 s, drawn only; a hop landing with HOP and an arrow held, at half the top speed or more, starts a drift turning at 2.2, 1.5 or 0.9 rad/s; its charge, its blue and orange mini-turbos, and every way it is lost | `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/race.ts` `apps/galaxy/src/arcade/kart/race.test.ts` `apps/galaxy/src/arcade/kart/art.ts` `apps/galaxy/src/arcade/kart/art.test.ts` | s1 | 2 |
| s5 | the HARD rivals' drift: at HARD a rival hops into a bend tighter than `RULES.rivalDriftRadius` 8 tiles and releases as it opens, never with the void in its look; EASY and NORMAL rivals never hop | `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/rivals.` `apps/galaxy/src/arcade/kart/race.test.ts` `apps/galaxy/src/arcade/kart/race.frost.test.ts` | s4 | 3 |
| s6 | the rocket start: GAS pressed last during the 2 and held at GO gives a BOOST of 0.8 s and `TURBO` under GO; during the 3, or held since the countdown began, a 0.5 s stall; during the 1 a normal start; the rivals' rocket start at 0.2, 0.4 and 0.7 by level, drawn from the seed, never a stall | `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/race.` `apps/galaxy/src/arcade/kart/rivals.test.ts` `apps/galaxy/src/arcade/kart/items.test.ts` `apps/galaxy/src/arcade/kart/art.test.ts` `apps/galaxy/src/arcade/kart/hub.finish.test.ts` `apps/galaxy/src/arcade/kart/live.test.ts` `apps/galaxy/src/arcade/scenes/kart.` | — | 4 |
| s7 | the slipstream: 1.2 s within 48 px behind a kart and 0.3 rad of its line, both at 0.6 × the top speed or more, give a BOOST of 0.6 s, to every kart, MULTI's carried karts included; leaving the cone resets the count | `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/race.` | — | 5 |
| s8 | what the player sees: snow on powder, skid marks over `RULES.skidGap` 0.15 rad or in a drift, fading over 3 s under `MAX_MARKS`, blue then orange sparks, wind lines in a slipstream, black smoke on a stall; under reduced motion no particle moves and the sparks stand as a glow | `apps/galaxy/src/arcade/kart/rules.ts` `apps/galaxy/src/arcade/kart/fx.` `apps/galaxy/src/arcade/kart/art.ts` `apps/galaxy/src/arcade/kart/art.test.ts` | s4, s6, s7 | 6 |
| s9 | what the player hears, on their own kart: the screech as a second continuous voice, a tick at blue and at orange, a whoosh at every mini-turbo, rocket start and slipstream, a sputter on a stall, and the engine's hum rising with GAS in the countdown | `apps/galaxy/src/arcade/sound.` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/kart/index.ts` `apps/galaxy/src/arcade/kart/race.ts` `apps/galaxy/src/arcade/kart/race.test.ts` `apps/galaxy/src/arcade/kart/art.ts` `apps/galaxy/src/arcade/kart/art.test.ts` `apps/galaxy/src/arcade/scenes/kart.ts` `apps/galaxy/src/arcade/scenes/kart.test.ts` | s4, s6, s7 | 7 |
| s10 | OMNI KART's section of `apps/galaxy/README.md` says how the race is now: the ice and its two frozen bends, the six keys, the hop, the drift and its mini-turbos, the HARD rivals' drift, the rocket start and the stall, the slipstream, and what a player sees and hears | `apps/galaxy/README.md` | — | 1 |

**Shared ground.** OMNI KART's engine is a few files every feature passes through, so most slices
run one wave after another, each on top of the one before:

- `apps/galaxy/src/arcade/kart/rules.ts`, where every number of the spec is named: s1, s4, s5, s6,
  s7 and s8, in waves 1, 2, 3, 4, 5 and 6.
- `apps/galaxy/src/arcade/kart/kart.` (the kart's step and its test): s1, s4, s6 and s7, in waves 1,
  2, 4 and 5.
- `apps/galaxy/src/arcade/kart/race.ts` and `race.test.ts`: s4, s5, s6, s7 and s9, in waves 2, 3,
  4, 5 and 7; s6 and s7 hold every `race.` file, `race.multi.test.ts` included.
- `apps/galaxy/src/arcade/kart/race.frost.test.ts`, which races the five rivals on FROST EIGHT on
  seeds 1, 7 and 42: s1, s2, s5, s6 and s7, in waves 1, 2, 3, 4 and 5.
- `apps/galaxy/src/arcade/kart/rivals.test.ts`: s1, s5 and s6, in waves 1, 3 and 4.
- `apps/galaxy/src/arcade/kart/art.ts` and `art.test.ts`: s4, s6 (its test only, for a race stepped
  through the countdown), s8 and s9, in waves 2, 4, 6 and 7.
- `apps/galaxy/src/arcade/scenes/kart.` (the overlay, its words, its cues and their tests): s3, s6
  and s9, in waves 1, 4 and 7.
- `apps/galaxy/src/arcade/ArcadeApp.tsx` and `apps/galaxy/src/arcade/kart/index.ts`: s3 and s9, in
  waves 1 and 7.

The tests that hold GAS through the countdown's 3 (in `items.test.ts`, `art.test.ts`,
`hub.finish.test.ts`, `live.test.ts`, `rivals.test.ts` and the `race.` tests) stall once s6 lands, so
s6 holds them all and changes each to press GAS at GO, naming each in its pull request. s2 and s4
share no ground and run side by side in wave 2; s3 and s10 run beside s1 in wave 1.

## Per slice: done when

**s1** (`ui: yes`), the ice slides
- `kart/kart.test.ts`: on ice at the top speed, steering full lock, the gap between heading and
  travel reaches 1.0 rad within a second and never passes it.
- On ice the gas adds 0.6 ×, the brake takes off 0.4 × and letting go takes off 0.3 × what they do
  on road, reversing included; the top speed is kept.
- Off the ice, on road or powder and not drifting, `travel` turns back at 6 rad/s and is dropped
  within 0.01 rad; a kart on road that never touched ice carries no `travel`.
- Every number is a named `RULES` constant: `iceGrip`, `iceSlip`, `iceAccel`, `iceBrake`,
  `iceCoast`, `grip`.
- The five rivals still finish three laps on FROST EIGHT on seeds 1, 7 and 42 at every level, and
  COMET RING drives as before (every kart test of today green).

**s2** (`ui: yes`), FROST EIGHT's two frozen patches
- `kart/track.test.ts`: FROST EIGHT's surface is `ice` across the road's width at the middle of bend
  4's and bend 8's curves, as on the lake; COMET RING has no ice; the lake keeps its place and size.
- A track's ice is a list of discs, the lake first; `floorOf` makes `ice` inside any of them.
- The patches are drawn in the ground's ice texture and in light blue on the minimap (the minimap's
  tests name ice tiles at both bends); the scenery stands on no ice.
- The five rivals finish three laps on FROST EIGHT on seeds 1, 7 and 42 at every level.

**s3** (`ui: yes`), the six keys
- `kart/options.test.ts`: six keys kept and read back; SHIFT can be bound, ENTER, TAB, ESC, M and F
  cannot; five saved keys equal to the old defaults read as the six new defaults; five custom keys
  are kept and HOP takes the first free of SPACE, X, C and V; DEFAULTS gives the six.
- HOP is held as the arcade's `up`; on the Game Boy's pad ▲ is HOP and ITEM stays B.
- The key routing's test: in OMNI KART, SHIFT bound to ITEM fires the item in the race and never
  selects on the pause; unbound, SHIFT is SELECT; TAB is SELECT always.
- `scenes/kart.test.ts`: OPTIONS › KEYS lists six rows, HOP last, as the `kart-keys` screen draws
  it; the countdown's line reads `▲ GAS ◀ ▶ STEER ▼ BRAKE SPACE HOP SHIFT ITEM` with the defaults
  and names a player's own keys.

**s4** (`ui: yes`), the hop and the drift
- `kart/kart.test.ts`: HOP going down on the ground hops 4 px over 0.25 s and `airborne` stays false
  through it; HOP in the air or during a hop does nothing.
- A drift starts only on landing, with HOP and ◀ or ▶ held, at half the top speed or more; it turns
  at 2.2, 1.5 and 0.9 rad/s with the drift's arrow, neither or the other; the nose leads the path by
  at most 0.45 rad, and on ice the lower grip and the larger slip hold.
- The charge grows on road and ice and stands still on powder; released at 0.8 and 1.8 s it gives a
  BOOST of 0.5 and 1 s, under 0.8 none; a turbo never shortens a BOOST already running.
- ▼, a spin-out, a fall, a tip-over, the tree line, the speed under half, a ramp's jump and the
  race's end each lose a drift with no turbo.
- The race feeds the held `up` to the player's kart as HOP; the hop is drawn 4 px up on the canvas.
- A kart that never hops drives as today: every kart test of today green.

**s5** (`ui: yes`), the HARD rivals' drift
- `kart/rivals.test.ts`: a HARD rival hops at a bend tighter than 8 tiles at half the top speed or
  more, drifts towards its side and releases once the turn opens past that radius; never with a
  wheel over the void in its look, and it releases at once when the void comes into it.
- EASY and NORMAL rivals never hop.
- On FROST EIGHT and COMET RING, on seeds 1, 7 and 42, at every level, the five rivals finish three
  laps, never falling into the void at HARD.

**s6** (`ui: yes`), the rocket start
- `kart/race.test.ts`: GAS pressed last during the 2 and held at GO gives a BOOST of 0.8 s; during
  the 3, or held since the countdown started, a 0.5 s stall in which the kart does not move; during
  the 1, a normal start; pressed during the 3, let go and pressed during the 2, a rocket start; GAS
  not held at GO, a normal start.
- The rivals' rocket starts are drawn from the race's seed at 0.2, 0.4 and 0.7 by level, and a rival
  never stalls; in MULTI each player's start is their own.
- `scenes/kart.hud.test.ts`: `TURBO` shows under GO on a rocket start, as the `kart-race` screen
  draws it, and not otherwise.
- Each test that held GAS through the 3 now presses it at GO, and each test that pinned a rival's
  place or time is changed: the pull request names each.

**s7** (`ui: yes`), the slipstream
- `kart/race.test.ts`: 1.2 s in a row within 48 px behind a kart and 0.3 rad of the line straight
  back from its heading, both at 0.6 × the top speed or more, gives a BOOST of 0.6 s and starts the
  count again; leaving the cone resets it to 0.
- The player, the rivals, and in MULTI the other players' karts at their carried positions each give
  and take one; a kart in the air or falling neither gives nor takes.
- MULTI's messages are unchanged (`race.multi.test.ts` and `net.test.ts` green as they are).

**s8** (`ui: yes`), what the player sees
- `kart/fx.test.ts`: snow only on powder and above 0.6 × the top speed; marks only over the 0.15 rad
  gap or in a drift, white on ice and powder, dark on road, fading out over 3 s, at most
  `MAX_MARKS`; sparks blue once the charge is blue, orange once it is orange; wind while a
  slipstream builds; smoke on a stall; all under the particle cap of today.
- With reduced motion no particle moves, the sparks stay as a still glow, and the snow, smoke and
  wind are not drawn; the marks stay.
- In MULTI the other players' karts are drawn without hop, sparks or marks.

**s9** (`ui: yes`), what the player hears
- `scenes/kart.test.ts`: the cues map to the screech, the tick, the whoosh and the sputter, each
  synthesized in `sound.ts`, no audio file.
- The screech is a continuous voice beside the engine's hum, on while the gap is over 0.15 rad or a
  drift runs, louder as the gap grows, silent when muted; a tick at blue and at orange; a whoosh at
  each mini-turbo, rocket start and slipstream; a sputter on a stall; only the player's own kart is
  heard.
- The engine's hum rises while GAS is held during the countdown.

**s10**, the README
- OMNI KART's section of `apps/galaxy/README.md` says what the spec makes true: the slippery ice and
  FROST EIGHT's two frozen bends, the six keys and SHIFT in OMNI KART, the hop, the drift and its
  blue and orange mini-turbos, the HARD rivals' drift, the rocket start and the stall, the
  slipstream, and the snow, marks, sparks, wind and sounds.
