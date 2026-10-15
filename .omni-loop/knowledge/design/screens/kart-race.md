---
screen: kart-race
status: draft
kind: page
mock: kart-race.html
implements: [apps/galaxy/src/arcade/scenes/kart.tsx, apps/galaxy/src/arcade/scenes/kart.css, apps/galaxy/src/arcade/scenes/kart.ts]
reads: [apps/galaxy/src/arcade/kart/race.ts, apps/galaxy/src/arcade/kart/kart.ts, apps/galaxy/src/arcade/kart/fx.ts, apps/galaxy/src/arcade/kart/mode7.ts, apps/galaxy/src/arcade/kart/art.ts, apps/galaxy/src/arcade/kart/rules.ts, apps/galaxy/src/arcade/keys.ts, apps/galaxy/src/arcade/sound.ts]
routes: []
supersedes: null
---

## Purpose

OMNI KART's race, from the countdown to the line: the road seen from behind the player's kart, the
race's line over it, and what the drift, the rocket start and the slipstream (PRD 1963) show and
sound while the player drives.

## Regions

- **The road** (`kart/mode7.ts`, the canvas under the overlay): the circuit's floor, its sky and
  scenery, the player's kart low in the middle, the rivals ahead.
- **On the road, new with PRD 1963** (`kart/fx.ts`, drawn on the canvas):
  - the hop, 4 px up for 0.25 s;
  - two skid marks behind the rear wheels, white on ice and powder, dark on asphalt, fading over 3 s;
    the player's own are laid under its rear wheels and drawn over its shadow, under its sprite, where
    the camera sees them (PRD 2063);
  - sparks at the rear wheels while a drift charges, blue then orange;
  - snow thrown behind on powder; black smoke on a stall; white wind lines in a slipstream.
- **The overlay** (`scenes/kart.tsx`, `RaceScreen`):
  - the countdown's beat, `3`, `2`, `1`, `GO`, and under GO on a rocket start, `TURBO`;
  - during the countdown, on a keyboard, the player's six keys,
    `▲ GAS ◀ ▶ STEER ▼ BRAKE SPACE HOP SHIFT ITEM`;
  - the race's line over the top: the place, `LAP n/m`, the time, the held item framed with the
    ITEM key's name;
  - `ENTER PAUSE` under the line while racing.

## States

- **Countdown:** the beat, the keys line; GAS held makes the engine's hum rise.
- **GO, rocket start:** GAS last pressed during the 2 and held at GO: `TURBO` under GO, a puff and
  the BOOST trail for 0.8 s, a whoosh.
- **GO, stall:** GAS last pressed during the 3, or held since the countdown began: black smoke and a
  sputter for 0.5 s, the kart still.
- **Drifting:** the nose ahead of the path, marks behind (the player's under its rear wheels), no
  sparks before 0.8 s, blue to 1.8 s, orange after; a tick at each colour; a screech under the music.
- **Slipstream:** wind lines past the kart while the count builds; a whoosh and the BOOST trail when
  it pays.
- **Reduced motion:** sparks stand as a still glow; snow, smoke and wind lines are not drawn; the
  marks are.
- **The Game Boy's pad:** no keys line, the item frame with no key's name; ▲ hops.

## Words

3 · 2 · 1 · GO · TURBO · GAS · STEER · BRAKE · HOP · ITEM · LAP · FINAL LAP · ENTER PAUSE · ENTER MENU

## Refusals

- The overlay never names the drift's charge in words: the sparks' colour is the only sign.
- In MULTI the other players' karts show no hop, sparks or marks: MULTI's messages carry none. The
  rivals, stepped on the player's own screen, show all three.

## Open questions

- The tall grid (320×288) is not drawn: whether the six keys' line fits its width is not said.

## Source

/omni:brainstorm, PRD 1963: .omni-loop/delivery/shipped/1963-kart-drift/before-after.html
/omni:brainstorm, PRD 2063: .omni-loop/delivery/inbox/2063-kart-own-skid-marks/before-after.html
