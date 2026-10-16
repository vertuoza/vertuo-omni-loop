---
screen: pong-match
status: draft
kind: page
mock: pong-match.html
implements: [apps/galaxy/src/arcade/scenes/pong.tsx, apps/galaxy/src/arcade/scenes/pong.css, apps/galaxy/src/arcade/scenes/pong.ts, apps/galaxy/src/arcade/pong/art.ts]
reads: [apps/galaxy/src/arcade/pong/match.ts, apps/galaxy/src/arcade/pong/rules.ts, apps/galaxy/src/arcade/pong/steer.ts, apps/galaxy/src/arcade/keys.ts, apps/galaxy/src/arcade/sound.ts]
routes: []
supersedes: null
---

## Purpose

OMNI PONG's match against the AI (PRD 2101), from the first serve to the game over: the player's
paddle steered by their voice, the AI's paddle, the ball that speeds up at every return, the score
and the lives.

## Regions

- **The HUD:** `SCORE n` at the left, the lives at the right (`♥♥♥`, a dot for each one lost).
- **The court** (`pong/art.ts`, on the canvas): a dashed centre line, the player's paddle at the
  left, the AI's at the right, the ball.
- **The steering sign:** ▲, · or ▼ beside the player's paddle, what the steering reads now.
- **The foot:** `ENTER PAUSE`.
- **The game over layer:** `GAME OVER`, the score, the saving state, `A · AGAIN`, `B · ROOM`.

## States

- **Playing:** the HUD, the court, the steering sign.
- **Serve:** one second after each point, the ball waits at the centre.
- **Paused:** `PAUSED`, `START · RESUME`, `SELECT · QUIT`; the microphone is off.
- **Microphone lost:** paused, `MIC LOST · A TO RETRY`.
- **Game over:** `SAVING…`, then `NEW BEST`, the best, or `SCORE NOT SAVED · A TO RETRY`.

## Words

SCORE · ENTER PAUSE · PAUSED · START · RESUME · SELECT · QUIT · MIC LOST · A TO RETRY · GAME OVER ·
SAVING… · NEW BEST · SCORE NOT SAVED · A · AGAIN · B · ROOM

## Refusals

- A point conceded never adds to the score.
- The match never runs while the microphone is off.

## Open questions

- The tall grid (320×288) is not drawn: the court's proportions there are not said.
- The pause and the microphone-lost layers are not drawn.

## Source

/omni:brainstorm, PRD 2101: .omni-loop/delivery/shipped/2101-omni-pong/before-after.html
