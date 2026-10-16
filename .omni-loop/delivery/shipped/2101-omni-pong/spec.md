---
prd: 2101
title: OMNI PONG, a voice-controlled Pong unlocked at LV 5
blocked-by: none
spec: file
phase0: server
---

# OMNI PONG, a voice-controlled Pong unlocked at LV 5

**Date:** 2026-10-16 · **PRD:** #2101
**Touches:**
- `game/rulebook.ts` (`xp.unlocks` gets `pong: 5`)
- `apps/galaxy/src/arcade/games/index.ts` (the fifth `GAMES` row)
- `apps/galaxy/src/arcade/scenes/common.ts` (the `pong` scene name and its `FrameState` field),
  `apps/galaxy/src/arcade/scenes/index.ts` (the new group and its case)
- `apps/galaxy/src/arcade/scenes/pong.ts`, `pong.tsx` and `pong.css` (new: the scene group, the
  canvas hand-off and the text layer)
- `apps/galaxy/src/arcade/pong/` (new: the pitch, the steering, the microphone port, the rules, the
  match, the options, the art, the loader)
- `apps/galaxy/src/arcade/ArcadeApp.tsx` (the scene's loading, frame loop, presses, pauses and
  score; `pong` in `HELD_SCENES`)
- `apps/galaxy/src/arcade/onboarding.ts` (`pong` in `SIGNED_IN_ONLY`)
- `apps/galaxy/README.md` (The game room: the fifth game)
- `.omni-loop/knowledge/design/screens/` (the drafts `pong-ready` and `pong-match`; `game-room`'s
  Source)

## Problem

The arcade's game room stands four cabinets: ENTROPY INVADERS from LV 1, SUPER OMNI WORLD from LV 2,
OMNI KART from LV 3 and OMNI DUET from LV 4. A player who reaches LV 5 gets nothing new to play.

Every game in the room is played with the same pad: arrows, A, B, START. A colleague asked for a
game that is played another way: a Pong where the paddle moves with the voice, a high sound up and
a low sound down, against an AI first and against colleagues later, as OMNI KART went from SINGLE
(PRD 1359) to MULTI (PRD 1572).

SUPER OMNI WORLD taught that dying must never earn a point (PRD 1633's Problem): a new game keeps
that rule.

## Solution

**OMNI PONG** is a Pong against an AI, unlocked at LV 5, played from the game room's fifth cabinet,
and steered by the player's voice alone.

### Unlock and the room

- The rulebook's `xp.unlocks` becomes `{ invaders: 1, platformer: 2, kart: 3, duet: 4, pong: 5 }`.
  `GAMES` gets a fifth row: `{ id: 'pong', title: 'OMNI PONG', scene: 'pong', measure: 'points' }`.
- The room's wide grid already shows a window of three cabinets that scrolls by one
  (`roomWindow` in `games/room.ts`): cabinets 3–5 show with the cursor on the fifth. The tall grid
  already shows one cabinet a page. Nothing in the room's code changes.
- Below LV 5 the fifth cabinet shows `REACH LV 5 TO PLAY`. From LV 5 it shows the room's standard
  lit cabinet (crew top 5, `A · PLAY`).
- `pong` joins `SIGNED_IN_ONLY`: a visitor lands on INSERT COIN, as for OMNI DUET.
- The game's code sits in `apps/galaxy/src/arcade/pong/`, imported only when the cabinet opens
  (`LOADING…` meanwhile; a failed import reads `GAME DID NOT LOAD · A TO RETRY`, B back to the room),
  as OMNI DUET's.

### The microphone

- The ready screen reads `OMNI PONG`, `◀ PITCH · MID ▶`, `HIGH ▲ · LOW ▼` and `A · TURN ON MIC`. A asks the browser for
  the microphone (`getUserMedia({ audio: true })`, echo cancellation, noise suppression and auto
  gain off, so the pitch is the voice's own).
- Granted: the ready screen shows the **pitch meter** (below) live, so the player tries their voice
  before playing, and reads `START · PLAY`.
- Refused, no microphone, or no secure context: the ready screen reads `MIC REQUIRED`, with the
  reason in one line under it (`MIC BLOCKED IN THE BROWSER`, `NO MIC FOUND`), A to ask again and B
  back to the room. **There is no way to play without the microphone**: no keyboard steering.
- The sound is analysed in the browser, frame by frame, and **never recorded, stored or sent**. The
  microphone's track is stopped when the player leaves the scene, pauses, or the tab is hidden, and
  asked for again (A) when play resumes.
- A microphone that stops during a match (unplugged, taken by another app) pauses the match and
  reads `MIC LOST · A TO RETRY`.

### The steering: two sounds, two ways

- Each frame, `pitchOf` reads the latest 2048 samples from an `AnalyserNode` and returns the voice's
  frequency in Hz, or `null` when the sound is too quiet (its RMS under the floor) or not clearly
  pitched (the normalised autocorrelation peak under the clarity floor), so speech, breath and room
  noise steer nothing. It looks for a pitch between 70 Hz and 1000 Hz.
- `steerOf(hz, limit)`: **above `limit + 10` Hz the paddle moves up, below `limit − 10` Hz it moves
  down**, at one fixed speed; inside that 20 Hz band, and in silence, it holds still.
- **The limit** is fixed per player and set on the ready screen with ◀ ▶: `LOW` 160 Hz, `MID`
  220 Hz (the default) and `HIGH` 300 Hz. It is kept in the browser under `omni-loop:pong-options`,
  as OMNI KART's options are (PRD 1762); storage that refuses keeps `MID` for the page's life.
- The **pitch meter**, on the ready screen and during the match beside the player's paddle: `▲`,
  `·` or `▼` for what the steering reads, and a bar marking the heard pitch against the limit.

### The match: survival against the AI

- The player's paddle is on the left, the AI's on the right, the ball served from the centre toward
  the player, at a random angle drawn from the match's seed.
- The ball speeds up by a fixed factor at every return, by either paddle, up to a cap.
- The AI's paddle follows the ball with a reaction delay and a top speed it cannot exceed. Once the
  ball outruns it, the AI starts to miss: the longer a rally, the likelier a point.
- **A point is scored when the AI misses the ball.** The match ends at the **third point conceded**.
  The HUD shows the score (points scored) and the lives left (`♥♥♥`).
- After each point, either way, the ball is served again from the centre after one second, toward
  the side that conceded.
- **The score is the points scored.** It is sent once, through `submitScore('pong', points)`, on
  the move into `over`, whichever route led there (the third point conceded, or SELECT · QUIT on the
  pause screen). A point conceded never adds to the score.
- START (ENTER) pauses and only START resumes; a blurred window, a hidden tab or leaving the scene
  pauses too. The pause reads `PAUSED`, `START · RESUME`, `SELECT · QUIT`.
- The game over screen reads `GAME OVER`, the score, then the saving states the other games show:
  `SAVING…`, `NEW BEST`, the best, or `SCORE NOT SAVED · A TO RETRY`. A plays again (from the ready
  screen, the microphone kept), B goes back to the room.
- The engine is pure, stepped at fixed sub-steps from a seed: the same seed and the same steering
  give the same match at 60 and at 120 frames a second.

### Not in this PRD

- Live multiplayer, against colleagues of the workspace, as OMNI KART's MULTI: the next PRD.
- Keyboard steering, a calibration screen, and the limit kept on the player's account.

## Decisions

- **AI first, multiplayer in a PRD of its own,** chosen by the person, following OMNI KART
  (PRD 1359, then PRD 1572): the voice is proven playable before a netcode is added.
- **Two sounds, two ways,** chosen by the person over the pitch setting the paddle's position and
  over the pitch setting its speed: any sound above the limit moves up, any below moves down, at one
  speed.
- **A fixed limit,** chosen by the person over a calibration before the first match and over a
  hummed reference note.
- **Survival against an AI that a speeding ball outruns,** chosen by the person over a match to 11
  and over levels of AI: one score that keeps a crew board alive, three points conceded end it.
- **The microphone is required,** chosen by the person over keyboard steering with a score of its
  own and over keyboard steering on the same board: the game is a voice game.
- **The voice's objection, accepted.** persona:Lead Engineer objected: "In an open space a game you
  must sing to play disturbs the whole team, and with one fixed limit at 220 Hz part of the team
  will spend the match straining their voice instead of playing." Settled `accepted`: the limit
  stays fixed during play, but the player sets it on the ready screen to `LOW` (160 Hz), `MID`
  (220 Hz) or `HIGH` (300 Hz).
- **A dead band of ±10 Hz around the limit** (decided while writing this spec): without it a voice
  held near the limit makes the paddle shake up and down.
- **The browser's echo cancellation, noise suppression and auto gain are turned off** (decided while
  writing this spec): they bend the voice's pitch and loudness, which the steering reads.
- **The microphone is stopped on pause and on a hidden tab** (decided while writing this spec): the
  browser's recording light goes out whenever the player is not playing.
- **The limit is kept in the browser** (decided while writing this spec, as PRD 1762 decided for
  OMNI KART's options): no migration, and a new device starts on `MID`.
- **Pitch detection by normalised autocorrelation, with no dependency** (decided while writing this
  spec): one voice, 70–1000 Hz, is well inside what it reads, and a pure function on samples is
  tested with synthesised sines.
- **No migration:** `submit_score()` already keeps a `points` game's best under its key once the game
  is unlocked, as it did for OMNI DUET.
- **No browser acceptance scenario:** `acceptance.enabled` is off in this repository; every criterion
  below is proven by ordinary tests, and the feel by a person.
- **No proof video:** the person said no.

## User stories

- As a player at LV 5, I open the fifth cabinet, turn on my microphone, and see the pitch meter move
  as I hum high and low.
- As a player, I hum high to move my paddle up and low to move it down, and keep a rally going
  against the AI as the ball speeds up.
- As a player with a low or a high voice, I set the limit to `LOW` or `HIGH` so both of my sounds
  sit comfortably on either side of it.
- As a player, I concede my third point, see my score, and see it kept as my best when it beats it.
- As a player whose browser refuses the microphone, I read `MIC REQUIRED` and why, and go back to the
  room.

## Scope

In: everything under **Solution**. Out: everything under **Solution › Not in this PRD**, any change
to the XP curve or levels, any database migration, any change to the other four games or the play
dock.

## Test seams

Tests live beside the code as `*.test.ts` and run with `pnpm test`. They never call Supabase or
GitHub, never open a microphone and never need a canvas: everything below `mic.ts`, `art.ts` and the
scene's drawing is pure.

- **The pitch** (`pong/pitch.test.ts`): synthesised sines at 110, 165, 220, 330 and 660 Hz at 44.1
  and 48 kHz read within 2 % of their frequency; a sine with harmonics reads its fundamental, not an
  octave; silence, a sine under the loudness floor and white noise read `null`.
- **The steering** (`pong/steer.test.ts`): for each limit, a pitch 11 Hz above moves up, 11 Hz below
  moves down, the limit itself and ±9 Hz hold still, `null` holds still.
- **The options** (`pong/options.test.ts`): `MID` by default; ◀ ▶ step through `LOW`, `MID`, `HIGH`
  and stop at the ends; the choice is read back from storage; a missing, broken or refusing storage
  gives `MID`.
- **The match** (`pong/match.test.ts`): a ball bounces off the walls and the paddles; each return
  speeds it up by the factor, up to the cap; the AI's paddle never moves faster than its top speed;
  an AI miss adds one point; a point conceded costs a life and never changes the score; the third
  conceded ends the match; the serve after a point goes toward the side that conceded.
- **No death earns a point:** for 200 seeds, a match where the player concedes at a given rally never
  ends with a higher score than the same steering without the miss.
- **The AI misses:** for 200 seeds, with a player that returns every ball, the AI misses before the
  ball reaches its cap.
- **Determinism:** the same seed and steering give the same match and score; the same steering
  stepped at 1/60 s and at 1/120 s gives the same match and score.
- **The microphone port** (`pong/mic.test.ts`, with a fake `PitchSource`): granted, refused, not
  found and insecure each map to their ready line; `stop()` is called on leaving, pausing and a
  hidden tab; a track that ends reads `MIC LOST`.
- **The score is sent once** (`pong/match.test.ts` and `scenes/pong.test.ts`): on the move into
  `over`, whichever route led there, and never twice.
- **The room** (extends `games/room.test.ts`, and the rulebook tests that pin `xp.unlocks`:
  `game/rulebook.test.ts`, `game/experience.test.ts`, `packages/galaxy/src/galaxy.test.ts`): the fifth
  cabinet is OMNI PONG, refused with `REACH LV 5 TO PLAY` at LV 4 and open at LV 5; on the wide grid
  the window holds cabinets 3–5 with the cursor on 5.
- **The text layer** (`scenes/pong.test.ts`, and `scenes/theme.test.ts` on both grids): loading, the
  failure line and A to retry, the ready screen before and after the microphone, `MIC REQUIRED` and
  its reasons, the pitch meter's three states, the HUD, the pause, `MIC LOST`, the game over screen,
  and the score's saving, NEW BEST, best and not saved states.
- **Loaded on demand** (`pong/guard.test.ts`): a test reads the static import graph of the arcade's
  entry and fails if any file outside `arcade/pong/` imports from it at run time; type-only imports
  are allowed.
- **By a person, in the browser:** how the steering feels with a real voice at each limit, on a
  laptop's microphone and a headset, on a computer (wide grid) and on a phone's handheld (tall grid);
  and how the ball's speed-up and the AI feel over a few matches.

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) with a new chunk loaded only when the OMNI
  PONG cabinet opens, and a rulebook change. The next `pnpm game:xp` run unlocks `pong` for every
  player at LV 5 or above. No migration. The arcade asks for the microphone for the first time, only
  on A on OMNI PONG's ready screen.
- **Rollback:** revert the feature PR. A `pong` key left in `player_xp.unlocked` and scores left in
  `arcade_scores` are harmless: the room draws only the games `GAMES` lists.
- **The microphone in a frame:** a page that embeds the arcade in an iframe without
  `allow="microphone"` gets `MIC REQUIRED · MIC BLOCKED IN THE BROWSER`. `/play` itself sends no
  `Permissions-Policy` that blocks it today; a test pins that `next.config.ts` and `vercel.json` keep
  it so.
- **Voices the limits do not fit:** a voice that cannot sit on both sides of any of the three limits
  cannot play. The three limits and the dead band sit in `pong/rules.ts`, so a follow-up retunes them
  without touching the engine.
- **Balance:** the ball's speed-up, its cap and the AI's delay and top speed sit in one constants
  block in `pong/rules.ts`; the AI-misses test keeps every tuning winnable.

## Acceptance criteria

1. With the rulebook at `pong: 5`, a player at LV 4 sees the fifth cabinet, OMNI PONG, refused with
   `REACH LV 5 TO PLAY`, and at LV 5 the cabinet opens the game.
2. On the wide grid, moving the room's cursor to the fifth cabinet scrolls the row so cabinets 3–5
   show; the tall grid shows one cabinet a page.
3. The ready screen reads `PITCH · MID` and `A · TURN ON MIC`; ◀ ▶ change the limit to `LOW` or
   `HIGH`, and the choice is still there after a reload.
4. With the microphone granted, the pitch meter shows `▲` for a sound above the limit's band, `▼`
   for one below, `·` in the band and in silence, and the ready screen reads `START · PLAY`.
5. With the microphone refused, missing or on an insecure page, the ready screen reads
   `MIC REQUIRED` with its reason, A asks again, B goes back to the room, and no match can start.
6. During the match, a sound above the band moves the player's paddle up, one below moves it down,
   and silence holds it still, at one fixed speed.
7. Each return speeds the ball up to its cap; each AI miss adds one point; each point conceded costs a
   life and adds nothing; the third conceded ends the match.
8. The third point conceded or SELECT · QUIT on the pause ends the match and sends the score reached
   once under `pong`, showing saving, then NEW BEST, best or not saved with a retry.
9. START pauses and only START resumes; a blurred window, a hidden tab or leaving the scene pauses
   too; the microphone is stopped while paused and while the scene is closed.
10. A microphone that stops during a match pauses it with `MIC LOST · A TO RETRY`.
11. The same seed and steering give the same match and score at 60 and at 120 frames a second, and
    no conceded point at any tested rally leaves a higher score than the same match without it.
12. A page that never opens the OMNI PONG cabinet never downloads `arcade/pong/`, and the guard test
    proves it; a failed load shows `GAME DID NOT LOAD · A TO RETRY`, A retries, and B goes back to
    the room.
