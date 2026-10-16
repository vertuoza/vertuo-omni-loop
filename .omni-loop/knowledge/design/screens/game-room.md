---
screen: game-room
status: draft
mock: game-room.html
implements: [apps/galaxy/src/arcade/scenes/games.tsx, apps/galaxy/src/arcade/scenes/games.css, apps/galaxy/src/arcade/games/room.ts, apps/galaxy/src/arcade/games/index.ts, apps/galaxy/src/arcade/games/stills.ts]
reads: [apps/galaxy/src/arcade/games/, apps/galaxy/src/arcade/scenes/menu.tsx, apps/galaxy/src/arcade/deep-link.ts, apps/galaxy/src/data/scores.ts]
routes: [/play#games]
supersedes: null
---

## Purpose

The arcade's game room: a player's level and XP, and a cabinet per arcade game, lit with the crew's
top five once the player's level opens it, dark with the level it opens at otherwise. Playing never
earns points or XP (`apps/galaxy/README.md` › The game room).

## Regions

- **The heading and the badge** (`scenes/games.tsx`, the badge from `scenes/menu.tsx`): the player,
  their fleet and their level, `P1 INKY · OCTOPOD · LV 3`.
- **The XP header:** `LV 3`, the XP bar, `180 / 300 XP` and `120 XP to LV 4`, or the one line that
  says why there is no level (`games/room.ts`'s `XP_LINE`). The numbers come from the player's
  `player_xp` row; the curve and the unlock levels from the rulebook's `xp` block.
- **The cabinets,** one per game of the registry (`games/index.ts`), in its order: a lit one shows
  its attract (three rows of Entropy over the player's hero), the crew's top five with the player's
  own line highlighted, and A · PLAY; a locked one is dark with REACH LV n TO PLAY; a SOON cabinet
  stands for the game to come.
- **OMNI KART's turns** (PRD 1923): its lit cabinet shows its circuits in turn, five seconds each,
  a cut between them: the circuit's still, then `CREW TOP 5` with the circuit's name at its right,
  `COMET RING` or `FROST EIGHT`, over that circuit's board (`kart`, `kart-frost-eight`). A · PLAY
  opens OMNI KART's ready screen whatever the turn.
- **Layout by grid:** the wide grid (640×360) stands the cabinets side by side, ◀ ▶ choosing; the
  tall grid (320×288) shows one a page (`scenes/games.css`).

## States

- **A visitor** (no GitHub linked): every cabinet locked, LINK GITHUB TO EARN XP.
- **No XP yet:** NO XP YET · SCORE YOUR FIRST POINT.
- **XP out of reach:** XP OUT OF REACH, and no level on the badge.
- **A level:** the XP bar, the cabinets lit up to that level; MAX LEVEL at the cap.
- **Scores:** SCORES OUT OF REACH when they could not be read, NO SCORES YET when there are none;
  on OMNI KART's cabinet, each circuit's turn shows its own.
- **Reduced motion:** OMNI KART's turns are cuts, never slides, so there is nothing to remove.
- The room opens only once the galaxy is loaded, and its NEW tag on the menu goes once it has been
  opened on this device (`apps/galaxy/README.md`).

## Words

LINK GITHUB TO EARN XP · NO XP YET · SCORE YOUR FIRST POINT · XP OUT OF REACH · SCORES OUT OF
REACH · NO SCORES YET · REACH LV 2 TO PLAY · A · PLAY · MAX LEVEL · `? ? ?` on the SOON marquee ·
COMET RING · FROST EIGHT on OMNI KART's heading line.

## Refusals

- The room never shows a level it could not read, nor one before the first point
  (`games/room.ts`, `levelTag`).
- Playing never earns points or XP (`apps/galaxy/README.md`).

## Open questions

- The room is a scene of the arcade, not a page: its route is the hash `/play#games`, and a
  signed-out visitor lands on INSERT COIN instead (`arcade/deep-link.ts`). How should a review reach
  it: through the demo galaxy (`pnpm galaxy:dev`), or by a stated keyboard path from the menu?
- What the SOON cabinet does when it is picked is not said in the copy.
- The level-up (LEVEL UP!, NEW GAME UNLOCKED) plays before the menu, not in the room: is it part of
  this screen or a screen of its own?
- The room draws text in the DOM over a canvas on a fixed grid: which of the room's look belongs to
  the canvas and which to the text layer is not written anywhere a reviewer would read it.
- Whether OMNI KART's turns pause while its cabinet is under the cursor is not said (PRD 1923).
- The word pass reads each lit cabinet as one control of 11 to 22 words, because the whole cabinet is
  a button (`scenes/games.tsx`): should A · PLAY alone be the control?

## Source

- apps/galaxy/src/arcade/scenes/games.tsx@e0bfc65
- apps/galaxy/src/arcade/scenes/games.css@928665f
- apps/galaxy/src/arcade/games/room.ts@dfa0cc3
- apps/galaxy/src/arcade/games/index.ts@de33134
- apps/galaxy/src/arcade/deep-link.ts@736d552
- apps/galaxy/README.md@3dc7bdb
- /omni:invade 2026-10-10 (written by hand from its screen-library step, PRD 1407 s9)
- /omni:brainstorm, PRD 1923: .omni-loop/delivery/shipped/1923-kart-frost-eight/before-after.html (OMNI KART's turns)
- /omni:brainstorm, PRD 2101: .omni-loop/delivery/inbox/2101-omni-pong/before-after.html (the fifth cabinet, OMNI PONG, from LV 5)
