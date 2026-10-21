---
screen: pong-ready
status: draft
kind: page
mock: pong-ready.html
implements: [apps/galaxy/src/arcade/scenes/pong.tsx, apps/galaxy/src/arcade/scenes/pong.css, apps/galaxy/src/arcade/scenes/pong.ts]
reads: [apps/galaxy/src/arcade/pong/mic.ts, apps/galaxy/src/arcade/pong/pitch.ts, apps/galaxy/src/arcade/pong/steer.ts, apps/galaxy/src/arcade/pong/options.ts, apps/galaxy/src/arcade/pong/rules.ts, apps/galaxy/src/arcade/keys.ts]
routes: []
supersedes: null
---

## Purpose

PULSAR VOLLEY's ready screen (PRD 2101): the player sets the pitch limit, turns on the microphone, tries
their voice on the pitch meter, and starts the match. No match starts without the microphone.

## Regions

- **The title:** `PULSAR VOLLEY`.
- **The limit:** `◀ PITCH · MID ▶`; ◀ ▶ step through `LOW` (160 Hz), `MID` (220 Hz) and `HIGH`
  (300 Hz), kept in the browser under `omni-loop:pong-options`.
- **The middle line:** `HIGH ▲ · LOW ▼` before the microphone; the pitch meter once it is on (▲, ·
  or ▼, and a bar marking the heard pitch against the limit and its still band of ±10 Hz).
- **The action:** `A · TURN ON MIC`, then `START · PLAY`.
- **The foot:** `B BACK`, to the game room.

## States

- **Before the microphone:** the limit, `HIGH ▲ · LOW ▼`, `A · TURN ON MIC`.
- **Microphone on:** the limit, the live pitch meter, `START · PLAY`.
- **Microphone refused, missing or on an insecure page:** `MIC REQUIRED`, its reason
  (`MIC BLOCKED IN THE BROWSER` or `NO MIC FOUND`), `A · ASK AGAIN`.
- **Loading the game:** `LOADING…`; a failed load reads `GAME DID NOT LOAD · A TO RETRY`.

## Words

PULSAR VOLLEY · PITCH · LOW · MID · HIGH · HIGH ▲ · LOW ▼ · A · TURN ON MIC · START · PLAY · MIC REQUIRED ·
MIC BLOCKED IN THE BROWSER · NO MIC FOUND · A · ASK AGAIN · B BACK · LOADING… · GAME DID NOT LOAD ·
A TO RETRY

## Refusals

- No keyboard steering: without the microphone, no match starts.
- The sound is never recorded, stored or sent.

## Open questions

- The tall grid (320×288) is not drawn: whether the pitch meter's bar keeps 160 px there is not said.
- Whether the meter shows the heard pitch in Hz as a number is not said; the draft shows the bar only.

## Source

/omni:brainstorm, PRD 2101: .omni-loop/delivery/shipped/2101-omni-pong/before-after.html
