---
prd: 1427
title: OMNI KART races on a space circuit, with music and sounds
blocked-by: none
spec: file
---

# OMNI KART races on a space circuit, with music and sounds

**Date:** 2026-10-10 · **PRD:** #1427
**Touches:**
- `apps/galaxy/src/arcade/kart/texture.ts` (the space floor: metal, neon edges and kerbs, panel
  seams, the lunar verge, the chevrons)
- `apps/galaxy/src/arcade/kart/track.ts` (the corners, the props of COMET RING and their check)
- `apps/galaxy/src/arcade/kart/fx.ts` (new: shadows, sparks, the BOOST trail, the bursts and the
  pickup flash)
- `apps/galaxy/src/arcade/kart/art.ts` (the sky, the props, the effects and the boxes drawn; the
  cues and the speed handed to the arcade)
- `apps/galaxy/src/arcade/kart/race.ts`, `items.ts` and `kart.ts` (what happened on a step: items
  used, boxes taken, hits, wall contact, the countdown's beats, the final lap)
- `apps/galaxy/src/arcade/scenes/kart.ts` (the `KartCue` type, `cues()` and `speed()` on
  `KartGame`, `soundOf` and `kartSong`), `kart.tsx` and `kart.css` (the HUD in game frames, the item
  icon, the countdown)
- `apps/galaxy/src/arcade/sound.ts` (the race's effects, rival effects by distance, the engine hum)
- `apps/galaxy/src/arcade/score.ts` (the `race` and `lastLap` songs)
- `apps/galaxy/src/arcade/ArcadeApp.tsx` (plays the cues, the race's music and the engine)
- `packages/design/src/sprites.ts` (new: the props, the glowing box, the BOOST icon, the station)
- `apps/galaxy/README.md` (The game room and the sound section: what the race sounds like)

## Problem

OMNI KART (PRD 1359) plays, but it does not look or sound like a game yet. The floor is a flat
texture: grey road, green grass and plain purple walls, with nothing standing beside the track. The
item boxes are yellow squares with a `?`. The HUD is plain text. And the race is silent: `TRACK` in
`ArcadeApp.tsx` has no entry for the kart, and nothing the race does makes a sound. Using an item,
the one moment a player acts on another, passes without a sound.

The person who asked put it simply: they want it to look like a real game, with a little music and a
sound when an item is used.

## Solution

COMET RING keeps its layout and its rules, and becomes a circuit in space: neon on metal, a lunar
verge, things standing around it, and a sky that moves. The race reports what happens in it, and
the arcade turns that into effects, music and an engine. Everything is drawn and played in code, as
the rest of the arcade is: no image and no audio file.

### The floor

`paintTrack` paints the circuit once, when the race loads, as today.

- **The walls** (`X`) become dark metal. Each side of a wall tile that meets a tile a kart can drive
  on (road or verge) carries a **neon edge**: cyan on the outside of the circuit, magenta on its
  inside. The wall's flat purple is gone.
- **The kerbs** (`r`) alternate cyan and magenta in place of red and white.
- **The road** (`#`) gets **panel seams**: a darker line every four tiles across the way forward.
- **The verge** (`.`) becomes lunar ground: pale grey with small craters. It still halves a kart's
  top speed: the rule reads the map's character, never its colour.
- **The chevrons.** A **corner** is a waypoint where the racing line turns by more than 30°. Before
  each corner, on the road along the leg into it, three **chevrons** (`►►►`) are painted, the last
  one two tiles before the corner, each pointing the way the line turns there.
- The colours are the floor's own, in `SURFACE`, and none equals a theme token (ADR-0046), as today.

### The props

Things stand around the circuit as billboards, drawn the way the karts are: scaled by their
distance and sorted with the karts and items, far to near.

- **Pylons and beacons** line the circuit, on the wall tiles along its edge. Beacons blink.
- **Asteroids, satellites and wrecks** stand deeper in, on the wall tiles inside and outside the
  circuit. Satellites turn slowly.
- Their places are fixed, written in COMET RING's data (`props`, kind and tile), so every race shows
  the same circuit. `trackProblems` refuses a prop on any tile a kart can drive on, so a prop never
  blocks or hides the road and no collision rule changes.
- **The arch** spans the start line. It is not in `props`: it is placed from the track's `line`, its
  two legs on the first wall tile beyond each end of the line. It is the one thing above the road;
  karts pass under it.

### The effects

`kart/fx.ts` holds the race's particles: a pure step, seeded from the race's seed, and at most 64
alive at once (a new one replaces the oldest).

- **A shadow** under every kart, drawn on the floor before the kart, scaled with it.
- **Sparks** where a kart scrapes a wall.
- **A trail** behind a kart on BOOST.
- **A burst** where an ORB or a BLOB hits a kart.
- **A flash** where a box is taken.

### The item boxes

A box becomes a glowing cube that turns and bobs. Taken, it flashes, and its place stays empty until
it comes back, as today.

### The HUD

The text layer (`scenes/kart.tsx`) puts the place, the lap and the time in framed panels, as
console racers do. The held item shows as its icon (BOOST, BLOB or ORB) in a frame of its own, empty
when the hands are empty. The countdown shows `3`, `2`, `1` and `GO` large, each popping in, and
FINAL LAP flashes when it shows. The lines the tests read (`READY_LINE`, `PAUSED_LINE`,
`NOT_LOADED`) do not change.

### The sky

The sky keeps its bands, stars, nebula and planet, and adds a second, smaller planet, a space
station far off, and comets crossing now and then, seeded from the race.

### Reduced motion

With reduced motion on, as `FrameState.reduced` says today: the sky, the comets and the satellites
stand still, the boxes and beacons do not turn or blink, no particle is drawn, and the countdown
shows its numbers without popping. Shadows stay. The race plays exactly the same.

### The cues

The race says what happened on each step. `race.ts`'s `RaceEvent` gains the beats of the countdown,
an item used, a box taken, a kart hit, a wall contact starting, and the final lap starting, each
naming the racer it happened to. `items.ts` reports which racer took a box and which racer was hit,
by what. `kart.ts` reports when a kart is stopped by a wall.

`createKart` turns them into **cues** for the arcade, `KartCue` in `scenes/kart.ts`:

| cue | when | fields |
|---|---|---|
| `beep` | each of the countdown's `3`, `2` and `1` | `beat` |
| `go` | GO | |
| `item` | a racer uses its item | `item`, `you`, `tiles` |
| `box` | the player takes a box | |
| `hit` | an ORB or a BLOB hits a racer | `item`, `you`, `tiles` |
| `spin` | the player spins out | |
| `scrape` | the player's kart meets a wall, after a step without contact | |
| `finalLap` | the player starts the last lap | |

`you` is true for the player; `tiles` is how far the racer is from the player, in tiles. Each cue is
emitted once, on the step (or press) where it happens. `KartGame` gains:

- `cues(): readonly KartCue[]`: the cues since the last call, in order, then forgotten;
- `speed(): number`: the player's speed as a share of its top speed on the road, from 0 to 1.

The synth stays outside `arcade/kart/`, so the guard of PRD 1359 holds: the kart's code loads only
when its cabinet opens.

### The sound

The arcade plays the cues (`ArcadeApp.tsx`), through `soundOf(cue)` in `scenes/kart.ts`, a pure
function that answers the effect to play and how far away it is, or nothing.

- **Effects** (`sound.ts`, new `Sfx` names): `beep` for each number and `go` for GO; `boost`, `blob`
  and `orb`, one sound per item; `box`; `impact` for a hit; `spin`; `scrape`; and the `finalLap`
  jingle.
- **The rivals.** A rival's item and a hit on a rival play the same effects, quieter and lower: at
  most half the player's loudness, quieter and lower the farther they are, and silent beyond 20
  tiles. `sfx(name, far = 0)` takes how far, from 0 (beside the player) to 1 (20 tiles).
- **The music.** `score.ts` gains `race`, a chiptune loop of about 30 seconds in the arcade's SNES
  voice, and `lastLap`, the same tune faster. `kartSong(hud)` in `scenes/kart.ts` answers the song
  for the race's phase: none on the ready screen and during the countdown, `race` from GO, `lastLap`
  from the final lap (after the `finalLap` jingle), none while paused (the song starts again on
  resume), and the arcade's `fanfare` on the results. `music()` keeps its signature.
- **The engine.** `sound.ts` gains `engine(level: number | null)`: one quiet oscillator under the
  music, its pitch rising with `speed()`, from a low hum at rest to an octave above at top speed. It
  plays during the countdown and the race, and stops (`null`) on pause, on the results and on
  leaving the cabinet.
- **M** mutes all of it, as it mutes the arcade today, and the choice is kept the same way.
- Leaving the cabinet stops the race's music, its engine and its effects.

## Decisions

- **A space circuit.** Of the looks offered, the person chose the space circuit: it fits COMET RING's
  name and the arcade's galaxy.
- **"Like a real game".** The person asked for every element offered: neon edges, corner chevrons,
  pylons and beacons, asteroids and satellites; and every finish: shadows and effects, glowing boxes,
  a framed HUD, a livelier sky.
- **A chiptune race loop,** in the arcade's own synth, as every song the arcade plays; no audio file.
- **Every sound offered,** chosen by the person: the start and finish, the boxes and impacts, the
  rivals' items, and the engine.
- **The verge keeps its rule.** The grass becomes lunar ground for the look only: it still halves the
  top speed, so the driving does not change.
- **The race reports, the arcade plays.** The synth stays outside `arcade/kart/` so the guard of PRD
  1359 holds, and every sound goes through one path that M mutes. The race reports cues through
  `cues()`; `step()` and `press()` keep their signatures.
- **Props stand on wall tiles only,** so no collision rule changes and no prop hides the road. The
  arch is the one exception above the road, and karts pass under it.
- **Reduced motion draws no particle.** A frozen spark is noise, so particles are not drawn at all;
  shadows, which do not move on their own, stay.
- **The music starts at GO,** so the countdown's beeps are heard clean, and stops on pause.
- **The final lap is its own song,** `lastLap`, rather than a tempo argument on `music()`: the
  arcade's music path stays as it is.
- **Rivals fall silent beyond 20 tiles,** so a full grid never drowns the player's own sounds.
- **No proof video:** the person said no.
- **The A key after a failed load** (the person's other request) is a bug, handled apart as issue
  #1426, not here.
- **The voice's objection.** B-E DEv objected, citing persona:B-E DEv: "I already see this tool as a
  gimmick, and a whole PRD of scenery and music for a kart is exactly the fluff that confirms it." The
  person approved the design without answering it (settled `none`). The design keeps the cost to
  those who never play at nothing: the new art loads with the kart, and the synth adds notes, no files.

## User stories

- As a player at LV 3 or above, I race on a circuit that looks like space, with neon edges, signs
  before the corners, and things standing around the track, so it feels like a real kart game.
- As a player, I hear my item when I use it, and the rivals' items when they use theirs nearby, so I
  know what just happened without reading the screen.
- As a player, I hear a race tune from GO, faster on the final lap, and my engine rising as I speed
  up.
- As a player, I see what I hold as an icon and a big countdown, so I read the race at a glance.
- As a player who has turned reduced motion on, the circuit stands still around me and nothing
  flickers, and the race plays the same.
- As a player who wants silence, M still mutes everything.

## Scope

**In:** the floor, the chevrons, the props, the effects, the boxes, the HUD, the sky, the cues, the
effects and their rival versions, the two songs, the engine hum, and the README.

**Out:** a new circuit or a change to COMET RING's layout; any change to driving, items, the rivals,
laps or the score; image or audio files; a volume setting; music on the ready screen; the A key
after a failed load (#1426).

## Test seams

Tests live beside the code as `*.test.ts` and run with `pnpm test`. They never call Supabase or
GitHub. The floor, the corners, the props, the particles, the cues and the sound mapping are pure;
the drawing is checked on the recorded canvas `kart/art.test.ts` already uses.

- **The floor** (`kart/texture.test.ts`): every side of a wall tile that meets road or verge is neon,
  and no other wall pixel is; kerbs alternate the two neon colours; the verge carries no road colour;
  every `SURFACE` colour differs from every theme token.
- **The corners and chevrons** (`kart/track.test.ts`, `kart/texture.test.ts`): COMET RING's corners
  are the waypoints where the line turns by more than 30°; each corner has three chevrons, all on
  road tiles of the leg into it, the last two tiles before it, pointing the way the line turns.
- **The props** (`kart/track.test.ts`): `trackProblems` refuses a prop on a road, kerb, line, box,
  start or verge tile and names it; COMET RING's props pass; the arch's legs stand on the first wall
  tile beyond each end of the start line.
- **The particles** (`kart/fx.test.ts`): the same seed and steps give the same particles; never more
  than 64; a particle is gone at the end of its life; a wall contact spawns sparks, a BOOST a trail, a
  hit a burst, a box a flash.
- **The cues** (`kart/race.test.ts`, `kart/items.test.ts`): START gives `beep 3`, and the countdown
  gives `beep 2`, `beep 1` and `go`, each once; using an item gives one `item` cue with the right
  item and `you`; a box taken, a hit and the final lap give their cue once; a kart held against a wall
  gives one `scrape`, and another only after a step without contact; `tiles` is the distance to the
  player.
- **The sound mapping** (`scenes/kart.test.ts`): every cue maps to an effect; a rival's cue maps to
  the same effect, farther, and to nothing beyond 20 tiles; `kartSong` answers none, `race`,
  `lastLap`, none and `fanfare` for ready and countdown, race, final lap, paused and finish.
- **The songs and the synth** (`score.test.ts`, `sound.test.ts`): `race` and `lastLap` parse and
  loop, and `lastLap` is faster; every new `Sfx` name plays; `sfx` with `far` is quieter and lower
  than without; the engine's pitch rises with the level and a `null` level stops it; muted, nothing
  sounds.
- **The drawing** (`kart/art.test.ts`): each kart's shadow is drawn before the kart; props and karts
  are drawn far to near; with reduced motion no particle is drawn and the sky does not move between
  two frames.
- **The guard** (`kart/guard.test.ts`, unchanged): nothing outside `arcade/kart/` imports it
  statically, and `sound.ts` and `score.ts` import nothing from it.
- **In a browser,** by a person: the look, the feel of the sounds and their loudness, and the frame
  rate on a phone.

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) only. The kart's chunk grows with the new
  art and effects, still loaded only when the cabinet opens. `sound.ts` and `score.ts`, loaded with
  the arcade, grow by a few notes and effects. No migration, no rulebook change, nothing for the kit.
- **Rollback:** revert the feature PR. Nothing is stored: the mute choice keeps its key.
- **Frame rate on small phones:** the floor is still painted once and sampled once per pixel. The
  props in view are drawn as sprites, like the karts, and the particles are capped at 64. The
  person's browser check covers a phone.
- **Loudness and annoyance:** the levels are chosen by ear, in one block of constants in `sound.ts`,
  so a follow-up can tune them without touching the race. The engine sits under the music, and M
  mutes everything.
- **A sound left playing:** the engine is a long-running oscillator; leaving the cabinet, pausing and
  the results stop it, and a test holds it.

## Acceptance criteria

1. The circuit's walls are dark metal with a neon edge wherever they meet road or verge: cyan
   outside the circuit, magenta inside. The kerbs alternate cyan and magenta, and the road shows
   panel seams.
2. The verge is pale lunar ground with craters, and a kart on it still tops out at half speed.
3. Before each corner of COMET RING, three chevrons on the road point the way the corner turns.
4. Pylons and beacons line the circuit, an arch spans the start line, and asteroids, satellites and
   wrecks stand off the road. None stands where a kart can drive, they grow as the kart nears them,
   nearer things hide farther ones, and every race shows them in the same places.
5. Every kart casts a shadow. Scraping a wall throws sparks, a BOOST leaves a trail, an ORB or BLOB
   hit bursts, and taking a box flashes.
6. The item boxes are glowing cubes that turn.
7. The place, the lap and the time sit in framed panels; the held item shows as its icon; the
   countdown shows 3, 2, 1 and GO large, popping in.
8. The sky shows a second planet, a distant station, and comets crossing.
9. With reduced motion on, the sky, comets, satellites, boxes and beacons stand still, no particle
   shows, and the countdown does not pop; the race plays the same.
10. Each of 3, 2 and 1 beeps and GO sounds. Using a BOOST, a BLOB and an ORB each sounds, each its
    own sound. Taking a box, being hit, spinning out and scraping a wall each sound, once each time.
11. A rival's item or hit sounds quieter and lower than the player's, quieter still the farther it is,
    and not at all beyond 20 tiles.
12. The ready screen and the countdown play no music. From GO the race tune plays; on the final lap a
    FINAL LAP jingle plays and the tune plays faster. Pausing stops the music and resuming starts it
    again. The results play the arcade's fanfare.
13. During the countdown and the race a quiet engine hum plays under the music, its pitch rising with
    the player's speed. It stops on pause, on the results, and on leaving the cabinet.
14. M mutes the music, the effects and the engine, and the choice is kept as today.
15. Leaving the cabinet stops every race sound.
16. COMET RING's layout, the driving, the items, the rivals and the score are unchanged; no image or
    audio file is added; the kart's code still loads only when its cabinet opens.
