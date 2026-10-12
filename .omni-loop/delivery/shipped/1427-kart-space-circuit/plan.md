# Plan: OMNI KART races on a space circuit, with music and sounds

PRD #1427, specified in [`spec.md`](./spec.md) beside this plan. The feature branch
`feat/kart-space-circuit` merges into `main` through the feature PR (`Closes #1427`). Each slice is a
sub-PR from `feat/kart-space-circuit--<slice>` into the feature branch (`Part of #1427`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The space floor: dark metal walls with neon edges, neon kerbs, panel seams, the lunar verge that still halves the top speed, and three chevrons before each corner pointing the way it turns | `apps/galaxy/src/arcade/kart/texture` `apps/galaxy/src/arcade/kart/track` | — | 1 |
| s2 | The race reports what happens as cues, and the player hears them: the countdown's beeps and GO, one sound per item, a box, a hit, a spin-out and a wall scrape, the rivals' quieter and lower by distance and silent beyond 20 tiles, all muted by M | `apps/galaxy/src/arcade/kart/race` `apps/galaxy/src/arcade/kart/items` `apps/galaxy/src/arcade/kart/kart.` `apps/galaxy/src/arcade/kart/art` `apps/galaxy/src/arcade/scenes/kart.ts` `apps/galaxy/src/arcade/scenes/kart.test.ts` `apps/galaxy/src/arcade/sound` `apps/galaxy/src/arcade/ArcadeApp.tsx` | — | 1 |
| s3 | Pylons and beacons line the circuit, an arch spans the start line, and asteroids, satellites and wrecks stand off the road, on wall tiles only, drawn far to near and scaled by distance | `apps/galaxy/src/arcade/kart/track` `apps/galaxy/src/arcade/kart/art` `packages/design/src/sprites` | s1 | 2 |
| s4 | The race music and the engine: no music on the ready screen or the countdown, the race tune from GO, the FINAL LAP jingle and the faster tune on the final lap, none while paused, the fanfare on the results, and an engine hum whose pitch follows the player's speed; the README says what the race sounds like | `apps/galaxy/src/arcade/score` `apps/galaxy/src/arcade/sound` `apps/galaxy/src/arcade/scenes/kart.ts` `apps/galaxy/src/arcade/scenes/kart.test.ts` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` | s2 | 2 |
| s5 | The HUD in game frames: the place, the lap and the time in framed panels, the held item as its icon, and a large 3·2·1·GO that pops in, without the pop under reduced motion | `apps/galaxy/src/arcade/scenes/kart.tsx` `apps/galaxy/src/arcade/scenes/kart.css` `apps/galaxy/src/arcade/scenes/kart.hud.test.ts` | — | 3 |
| s6 | The livelier sky: a second planet, a distant station and comets crossing, all standing still under reduced motion | `apps/galaxy/src/arcade/kart/art` `packages/design/src/sprites` | — | 3 |
| s7 | Shadows and effects: every kart casts a shadow, sparks at a wall, the BOOST trail, bursts on a hit, at most 64 particles and none under reduced motion, and the item boxes as glowing cubes that turn and flash when taken; the README's game room shows the space circuit | `apps/galaxy/src/arcade/kart/fx` `apps/galaxy/src/arcade/kart/art` `packages/design/src/sprites` `apps/galaxy/README.md` | s2 | 4 |

**Shared ground.** The slices draw and play one race, so several share files. The waves keep them
apart:

- `apps/galaxy/src/arcade/kart/art` (`art.ts`, where the race is drawn and `createKart` builds the
  game, and `art.test.ts`, its recorded canvas): s2 (the cues and `speed()` on the game), s3 (the
  props and the arch), s6 (the sky) and s7 (shadows, particles, boxes). Waves 1, 2, 3 and 4.
- `packages/design/src/sprites` (`sprites.ts` and the forged digests in `sprites.test.ts`): s3 (the
  props), s6 (the station) and s7 (the glowing box). Waves 2, 3 and 4.
- `apps/galaxy/src/arcade/kart/track` (`track.ts` and `track.test.ts`): s1 (the corners) and s3 (the
  props and their check). Waves 1 and 2.
- `apps/galaxy/src/arcade/scenes/kart.ts` and `scenes/kart.test.ts`: s2 (`KartCue`, `soundOf`,
  `cues()` and `speed()` on `KartGame`) and s4 (`kartSong`). Waves 1 and 2. The prefix
  `scenes/kart.ts` also covers `scenes/kart.tsx`, so s5 (the HUD) waits for wave 3.
- `apps/galaxy/src/arcade/sound` (`sound.ts` and `sound.test.ts`) and
  `apps/galaxy/src/arcade/ArcadeApp.tsx`: s2 (the effects, `far`, playing the cues) and s4 (the
  songs' wiring and the engine). Waves 1 and 2.
- `apps/galaxy/README.md`: s4 (the sound section) and s7 (the game room). Waves 2 and 4.
- `apps/galaxy/src/arcade/scenes/theme.test.ts` draws every scene, the kart's included, in a theme
  where every token has a colour no default has. No slice edits it: a colour equal to a theme token
  is read from `s.theme` (ADR-0046), and the space colours are the race's own.

## Per slice: done when

### s1: the space floor

- `paintTrack` paints wall tiles dark metal, and each side of a wall tile that meets road or verge
  neon: cyan when the wall is outside the circuit (joined to the map's border), magenta when it is
  inside. No other wall pixel is neon (`kart/texture.test.ts`).
- Kerb tiles alternate the two neon colours; road tiles carry a darker seam every four tiles across
  the way forward; verge tiles are pale lunar grey with craters and carry no road colour.
- `cornersOf(track)` in `track.ts` answers the waypoints where the racing line turns by more than
  30°, with the way each turns; COMET RING's corners are listed in `kart/track.test.ts`.
- Each corner has three chevrons, all on road tiles of the leg into it, the last two tiles before
  it, each pointing the way the line turns there.
- A kart on the verge still tops out at half its road speed (`kart/kart.test.ts` passes unchanged).
- Every `SURFACE` colour differs from every theme token.
- `pnpm test` is green.

### s2: the cues and the effects

- `RaceEvent` gains the countdown's beats, an item used, a box taken, a hit, a wall contact starting
  and the final lap starting, each naming its racer; `items.ts` reports which racer took a box and
  which was hit, by what; `kart.ts` reports a kart stopped by a wall.
- `KartCue` in `scenes/kart.ts` holds `beep`, `go`, `item`, `box`, `hit`, `spin`, `scrape` and
  `finalLap`, with `beat`, `item`, `you` and `tiles` as the spec's table says.
- `KartGame` gains `cues()` (the cues since the last call, in order, then forgotten) and `speed()`
  (the player's speed over its road top speed, 0 to 1). `step()` and `press()` keep their
  signatures.
- `kart/race.test.ts` and `kart/items.test.ts`: START gives `beep 3`; the countdown gives `beep 2`,
  `beep 1` and `go`, each once; using an item gives one `item` cue with its item and `you`; a box, a
  hit, the player's spin-out and the final lap give their cue once; a kart held against a wall gives
  one `scrape`, and another only after a step without contact; `tiles` is the distance to the
  player.
- `soundOf(cue)` maps every cue to an effect; a rival's cue maps to the same effect with its `far`,
  and to nothing beyond 20 tiles (`scenes/kart.test.ts`).
- `sound.ts` gains the `Sfx` names `beep`, `go`, `boost`, `blob`, `orb`, `box`, `impact`, `spin`,
  `scrape` and `finalLap`, and `sfx(name, far = 0)`, quieter and lower as `far` grows, at most half
  as loud for a rival (`sound.test.ts`); muted, nothing sounds.
- `ArcadeApp.tsx` plays the game's cues after each frame, through `soundOf` and `sfx`.
- `kart/guard.test.ts` passes unchanged: nothing outside `arcade/kart/` imports it statically, and
  `sound.ts` imports nothing from it.
- `pnpm test` is green.

### s3: the props and the arch

- COMET RING's source gains `props`, each a kind (`pylon`, `beacon`, `asteroid`, `satellite`,
  `wreck`) and a tile; pylons and beacons stand on the wall tiles along the circuit's edge, the rest
  deeper in.
- `trackProblems` refuses a prop on a road, kerb, line, box, start or verge tile and names it, with
  its row and column; COMET RING's props pass (`kart/track.test.ts`).
- The arch's legs stand on the first wall tile beyond each end of the start line.
- The props are drawn as sprites with the karts and items, far to near, each scaled by its distance
  (`kart/art.test.ts`, on the recorded canvas); beacons blink and satellites turn, and stand still
  under reduced motion.
- The new sprites are in `packages/design/src/sprites.ts`, with their digests in `sprites.test.ts`.
- `pnpm test` is green.

### s4: the race music and the engine

- `score.ts` gains `race`, a looping chiptune of about 30 seconds, and `lastLap`, the same tune at a
  higher tempo; both parse and loop (`score.test.ts`).
- `kartSong(hud)` answers no song for ready and countdown, `race` for the race, `lastLap` once
  FINAL LAP shows, none while paused, and `fanfare` on the results (`scenes/kart.test.ts`).
- `ArcadeApp.tsx` plays `kartSong`'s song in the kart scene, and the `finalLap` cue's jingle comes
  before the faster tune. `music()` keeps its signature.
- `sound.ts` gains `engine(level: number | null)`: one quiet oscillator under the music, its pitch
  rising with the level, from a low hum at rest to an octave above at 1; `null` stops it
  (`sound.test.ts`). Muted, it does not sound.
- `ArcadeApp.tsx` feeds `speed()` to `engine` during the countdown and the race, and passes `null`
  on pause, on the results and on leaving the cabinet; leaving stops the race's music too.
- `apps/galaxy/README.md`'s sound section lists the race's music, effects and engine, and still says
  no audio file is used.
- `pnpm test` is green.

### s5: the HUD

- The text layer renders the place, the lap and the time in framed panels; the held item as its
  icon (BOOST, BLOB or ORB) in a frame of its own, an empty frame when none is held
  (`scenes/kart.hud.test.ts`, rendered with `renderToStaticMarkup`).
- The countdown's `3`, `2`, `1` and `GO` show large and pop in; under `prefers-reduced-motion` the
  pop is off (`kart.css`). FINAL LAP flashes, and not under reduced motion.
- `READY_LINE`, `PAUSED_LINE` and `NOT_LOADED` show as before.
- `pnpm test` is green.

### s6: the sky

- The sky draws its bands, stars, nebula and planet as before, and a second, smaller planet, a
  distant station and comets crossing, seeded from the race (`kart/art.test.ts`).
- Under reduced motion, two frames draw the same sky: nothing moves.
- The station's sprite is in `packages/design/src/sprites.ts`, with its digest.
- `pnpm test` is green.

### s7: shadows, effects and boxes

- `kart/fx.ts` steps the particles purely, seeded from the race: the same seed and steps give the
  same particles; never more than 64 alive (a new one replaces the oldest); each is gone at the end
  of its life; a wall contact spawns sparks, a BOOST a trail, a hit a burst and a box a flash
  (`kart/fx.test.ts`).
- Every kart's shadow is drawn on the floor before the kart; under reduced motion no particle is
  drawn and the shadows stay (`kart/art.test.ts`).
- The item boxes are glowing cubes that turn and bob, and stand still under reduced motion; a taken box
  flashes, and its place stays empty until it comes back.
- The glowing box's sprite is in `packages/design/src/sprites.ts`, with its digest.
- `apps/galaxy/README.md`'s game room describes OMNI KART's space circuit.
- `pnpm test` is green, and the full race still loads only when its cabinet opens.
