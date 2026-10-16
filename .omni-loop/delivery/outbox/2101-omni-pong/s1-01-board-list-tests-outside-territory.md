---
id: s1-01-board-list-tests-outside-territory
prd: 2101
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Adding the fifth game also adds its crew board, and two tests that list every game's board sit outside this slice's ground. Should this slice update them?

## The decision, in plain words

This slice added the new game's board to those two lists, so every test stays green when the game joins the room.

## The intro, for fun

A new cabinet arrived, and two old guest lists suddenly had one name missing.

## The punchline, for fun

We wrote the name in, rather than leave the door shut on a game with no players yet.

## The options, in plain words

A. Update the two board-list tests in this slice, as built.
B. Leave them for a later slice, with the preflight red until then.

## What I had to decide

Adopt A if the two board-list tests may follow the registry in the slice that grows it; pick B to move them to a later slice.

## What I did meanwhile

The two tests list OMNI PONG's board beside the other four games' boards.

## What it costs to change later

One line each in two tests; undoing it is removing those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the board-list tests to be in s1, or simply missed them when it listed every test that counts games (author)
