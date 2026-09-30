# Plan: Super Omni World, a SNES-style platformer unlocked at LV 2

PRD #817, spec beside this plan (`spec.md`). The feature branch `feat/super-omni-world` goes into
`main` through the feature PR (`Closes #817`). Each slice is a sub-PR from
`feat/super-omni-world--<slice>` into the feature branch (`Part of #817`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Opens SUPER OMNI WORLD at LV 2 in the arcade room and plays a first, bare 1-1. The rulebook's `xp.unlocks` gets `platformer: 2`, `GAMES` gets its row, and `platformer` joins the scene names and the scene switch. `phaser` (4.x) joins the arcade's dependencies. `PlatformerScreen` imports it on demand, starts a pixel-art `Phaser.Game` on the grid it is given, takes the arcade's actions each frame, pauses and resumes when told, and destroys the game on unmount. A failed import shows `GAME DID NOT LOAD · A TO RETRY`. The pure rules hold the physics constants, the jump that grows with how long A is held, the stage legend and parser, and the stage checks. 1-1 has ground, pits, bricks, pipes, a start and a flag. The hero is the player's own (`heroLook`), runs with B, and reaching the flag shows the stage clear. The new 16px tiles (ground, brick, `?` block, pipe) join `@omni/design` in the grass palette | `game/rulebook` `game/experience.test.mjs` `game/cli/xp.test.mjs` `packages/galaxy/src/xp` `packages/design/src/` `apps/galaxy/package.json` `pnpm-lock.yaml` `apps/galaxy/src/arcade/` `apps/galaxy/src/data/` | — | 1 |
| s2 | Makes 1-1 a game. Entropy blobs walk and turn at walls and ledges. A stomp kills one and bounces the hero, and any other touch costs a life. A `?` block hit from below gives a coin and turns empty. Coins lie in the stage. There are 3 lives: an enemy, a pit or the 300-second timer running out costs one and restarts the stage with the score kept, and 0 lives is game over. The score is coin 10, stomp 50, and 10 per second left at the flag. The text layer shows score, coins, lives, stage and time, plus the ready (`1-1 · PRESS START`), pause (SELECT quits to the room) and game-over screens | `apps/galaxy/src/arcade/platformer/` `apps/galaxy/src/arcade/scenes/platformer` | s1 | 2 |
| s3 | Completes the world and saves the score. Stages 1-2 (underground) and 1-3 (castle) join `stages.ts`, with castle stone and one palette per stage in `@omni/design`, and blobs tinted per stage. The stages play in order, and 1-3's flag shows `WORLD CLEAR`. At game over or `WORLD CLEAR` the arcade sends the score once through `submitScore('platformer', …)`, showing saving, NEW BEST, best or not saved with a retry, as Invaders does. The arcade README's game room describes the second game and the dock picker | `apps/galaxy/src/arcade/platformer/` `apps/galaxy/src/arcade/scenes/platformer` `apps/galaxy/src/arcade/scenes/invaders-score` `apps/galaxy/src/arcade/ArcadeApp.tsx` `packages/design/src/sprites.mjs` `packages/design/src/sprites.test.mjs` `apps/galaxy/README.md` | s2, s4 | 3 |
| s4 | Puts the platformer in the corner Game Boy. `dockDoor` returns the games the player may play. With only Invaders open, the dock goes straight into it, as today. With both open, it opens on the picker (`ENTROPY INVADERS` / `SUPER OMNI WORLD`, up and down, A plays, B folds). B on a game's ready, pause or game-over screen goes back to the picker. The picker remembers the last choice in the dock's sessionStorage entry, and ignores storage that throws. The platformer mounts through `PlatformerScreen` on the tall grid: a question pauses it, only START resumes it, and it stays silent. `send.ts` takes the game's key. The lazy-loading guard test fails if `phaser` is imported statically outside `apps/galaxy/src/arcade/platformer/` | `apps/galaxy/src/play-dock/` `apps/galaxy/src/ask/page/dock` `apps/galaxy/src/dossier/page/dock-player.test.ts` `apps/galaxy/src/dossier/page/page.test.ts` | s1 | 2 |

**Shared ground.**
- **`apps/galaxy/src/arcade/platformer/` and `apps/galaxy/src/arcade/scenes/platformer`:** s1
  creates them, s2 adds the play, and s3 adds the stages and the end of the world. They are in
  waves 1, 2 and 3, and s1's wider `apps/galaxy/src/arcade/` covers both in wave 1.
- **`packages/design/src/sprites.mjs`:** s1 adds the grass tiles, and s3 adds castle stone and the
  other two palettes. They are in waves 1 and 3.
- **`apps/galaxy/src/arcade/ArcadeApp.tsx` and `scenes/invaders-score`:** s1 may touch them to
  mount the scene (it owns all of `apps/galaxy/src/arcade/`). s3 adds the score sending. They are
  in waves 1 and 3.
- **The registry tests:** a second row in `GAMES` and in `xp.unlocks` changes what
  `games/room.test.ts`, `scenes/games.test.ts`, `scenes/menu.test.ts`, `deep-link.test.ts`,
  `account-demo.test.ts`, `data/xp.test.ts`, `game/rulebook.test.mjs`, `game/experience.test.mjs`
  and `packages/galaxy/src/xp.test.mjs` see. s1 owns them all.
- **The dock:** s4 alone owns `apps/galaxy/src/play-dock/` and the pages' dock tests. It shares
  wave 2 with s2 and no prefix. It uses only what s1 exported: `PlatformerScreen`, its pause and
  retry props, and `GAMES`.

## Per slice: done when

**s1**
- With the rulebook at `platformer: 2`, `room.test.ts` shows the second cabinet as SUPER OMNI
  WORLD, refused with `REACH LV 2 TO PLAY` at LV 1 and open at LV 2. The third cabinet stays SOON.
- `unlockedFor` gives `platformer` from LV 2 and keeps it after a rule change (`experience.test`).
- `platformer/rules.test.ts`: the jump height grows with how long A is held and stops at the cap.
  No jump starts in mid-air.
- `platformer/stages.test.ts`: 1-1 parses. It has one start, one flag, 18 equal rows, only legend
  characters and ground under the start, and no pit wider than a run-jump. An unknown character is
  refused with its row and column.
- `platformer/PlatformerScreen.test.ts` (Phaser stubbed): the game starts on mount with the grid
  and pixel-art mode, pause and resume pass through, and unmount destroys it. A failed import shows
  the retry line, and A retries the import.
- By a person in the browser: the cabinet opens 1-1, and the hero runs, jumps and reaches the flag.

**s2**
- `rules.test.ts`: a coin is 10, a stomp 50, and 10 per second left at the flag. A life lost
  restarts the current stage with the score kept. The timer at 0 costs a life. 0 lives is game over.
- The scene turns a stomp, a side touch, a `?` block hit, a pit and the flag into the rules' events
  (`stomp`, `hurt`, `coin`, `pit`, `flag`). A test with Phaser stubbed covers this mapping.
- The text layer's test shows the HUD values, the ready, pause and game-over screens, and SELECT on
  the pause screen leaving the game.

**s3**
- `stages.test.ts` passes for 1-1, 1-2 and 1-3, and `rules.test.ts` plays them in order to
  `WORLD CLEAR`.
- The arcade sends the score once at game over and once at `WORLD CLEAR`, under `platformer`, and
  shows saving, then NEW BEST, best or not saved with a retry (score-sending test with a fake
  account).
- The sprites test covers the new tiles in all three palettes.
- The README's game room names SUPER OMNI WORLD, its LV 2 unlock and the dock picker.

**s4**
- `dock.test.ts`: below LV 2 the dock goes straight into Invaders. At LV 2 it opens the picker. A
  plays the chosen game, B folds, and B from a game's ready, pause or game-over screen returns to the
  picker. The remembered choice survives a reopen, and storage that throws is ignored.
- `PlayDock.test.ts`: a question pauses the platformer and only START resumes it. Claude done lets
  it run to its end.
- `send.test.ts`: the score goes under the game's key it is given.
- The guard test passes, and fails on a static `import 'phaser'` added to `DockGame.tsx`.
- By a person in the browser: the dock at 600px and above shows the picker at LV 2 and plays both
  games.
