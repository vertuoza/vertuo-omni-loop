---
id: s1-02-rule-tests-gain-cases
prd: 1975
slice: s1
rank: high
bears-on: BR-PRODUCT-78
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The tests that prove four product rules about answer points, login spelling and the arcade menu gained new cases for merged pull requests, and the spot reserved for answers that belong to no PRD now also holds merged pull request points. Do those rules still read right?

## The decision, in plain words

Every existing check of those rules was kept as it was; only new cases were added beside them, and the reserved spot was widened to the two new kinds of points, which the map still leaves out.

## The intro, for fun

Four rules found new neighbours moving in next door.

## The punchline, for fun

Nobody touched their furniture.

## The options, in plain words

A. A. The rules stand as written: their checks are unchanged and only new cases sit beside them.
B. B. Reword the answer rule to say that merged pull request points share the spot reserved for answers no PRD claims.

## What I had to decide

Agree that the rules stand as written (A), or ask for the answer rule to say that merged pull request points share that spot (B).

## What I did meanwhile

The rules stay as written, and their tests prove them as before.

## What it costs to change later

Rewording the rule later is a one-line change to the rules register; the points and the tests stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Files: game/rulebook.test.ts, game/projector.test.ts and game/economy.test.ts (BR-PRODUCT-77, BR-PRODUCT-79), apps/galaxy/src/arcade/scenes/menu.test.ts (BR-PRODUCT-48, only the XP weights list), supabase/checks/game_answered_rounds.sql and the new migration's planet check (BR-PRODUCT-78). (author)
- The database check runs only in continuous integration; it was not run on this machine. (author)
