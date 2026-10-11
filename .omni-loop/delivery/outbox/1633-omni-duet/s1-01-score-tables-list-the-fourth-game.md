---
id: s1-01-score-tables-list-the-fourth-game
prd: 1633
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Two tests of the arcade's score tables listed exactly three games, so adding the fourth game broke them, and the plan did not give this slice the files they live in. Should this slice fix them?

## The decision, in plain words

Yes: both tests now expect the fourth game's score table beside the other three. Only the expected lists changed; no code that reads or saves scores changed.

## The intro, for fun

The plan counted every test that counts games. Two more were hiding behind the score board.

## The punchline, for fun

They counted to three, and now they count to four.

## The options, in plain words

A. A. Fix the two score-table tests in this slice, outside its territory, by adding the fourth game to their expected lists
B. B. Leave them red and add the files to a later slice's territory

## What I had to decide

Keep A: the two score-table tests expect OMNI DUET's table, as they expect every game of the registry. B would leave the full test run red on the feature branch until another slice fixed them.

## What I did meanwhile

Built as A: apps/galaxy/src/data/scores.test.ts and apps/galaxy/src/data/arcade.test.ts expect a `duet` table, read and unreadable alike.

## What it costs to change later

A constant: two expected lists in two test files. Undoing it is reverting those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's shared-ground note said every test that counts games belongs to s1, but listed neither file in s1's territory (author).
