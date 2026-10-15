---
id: s2-01-beyond-territory-fixtures
prd: 1975
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Making secured zones pay nothing broke tests in files this slice's plan did not list, because they used a secured zone as their example of earning points, and the demo world's ranking lost its shape. Is it acceptable that this slice fixed them?

## The decision, in plain words

Those tests now earn their points another way (a rescue, a closed question, or a merged or reviewed pull request), their checks unchanged otherwise, and the demo world gained one merged pull request so its ranking still shows the player in the middle of the board.

## The intro, for fun

The zone stopped paying, and every test that counted on it came up short.

## The punchline, for fun

They found other work, and the scoreboard still adds up.

## The options, in plain words

A. Keep the fixes in this slice, so every test passes with the new pay.
B. Undo them here and let the last slice carry them, accepting a red test run in between.

## What I had to decide

Keep these fixes in this slice (A), or undo them and let the last slice carry them (B).

## What I did meanwhile

The slice ships with the fixes in it, and the whole test run is green.

## What it costs to change later

Undoing them is a small revert of test examples and one demo pull request; no stored data depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Files outside the territory: game/experience.test.ts, game/cli/score.test.ts, game/sources/github.test.ts, apps/galaxy/src/dashboard/load.test.ts, apps/galaxy/src/dashboard/season.test.ts, apps/galaxy/src/data/load-galaxy.test.ts, packages/galaxy/src/galaxy.test.ts, packages/galaxy/src/xp.test.ts and packages/galaxy/src/demo.ts (one merged feat pull request, so the demo's rankings test still finds the player below the top five).
- (author) The score function now takes an optional rulebook, the real one by default, so the night shift, the revert and the clawback stay tested under the rollback's numbers.
