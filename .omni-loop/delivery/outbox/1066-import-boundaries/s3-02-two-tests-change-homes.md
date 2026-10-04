---
id: s3-02-two-tests-change-homes
prd: 1066
slice: s3
rank: medium
bears-on: none
raised: 2026-10-04
wave: 2
---

## The question, in plain words

Two existing checks broke the layering rules: the design library's check reached into the game, and a check of the whole test suite sat inside the delivery tool. Where should each live now?

## The decision, in plain words

The check that the design has a colour for every kind of game wound moved to the website, which may read both. The check of the test suite's time limits moved to the repository's own scripts, beside the other repository-wide checks.

## The intro, for fun

Two tests were caught standing in the wrong rooms, so they were kindly shown the door.

## The punchline, for fun

Same tests, same answers, just better addresses.

## The options, in plain words

A. Move both checks to a layer that may read what they compare (what was built).
B. Leave both tests where they were and widen the test allowance so the design's tests may read the game and the kit's tests may read the root config.

## What I had to decide

How to fix two leftovers the guard found: packages/design/src/sprites.test.ts imported game/events.ts (the design never imports the game, tests included), and kit/test/test-timeouts.test.ts imported the root vitest.config.ts.

## What I did meanwhile

The equality of the design's WOUND_TINT keys and the game's WOUND_KINDS moved to a new apps/galaxy/src/arcade/wound-tints.test.ts; the sprite test now loops over the design's own tints. The time-limit test moved to scripts/test-timeouts.test.ts, as the architecture form asks of a check about the repository as a whole; its one-line mention in vitest.config.ts's comment, a root file outside this slice's territory, was updated with it.

## What it costs to change later

Moving two test files back, if a reviewer prefers a row allowance instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reviewer would rather allow the design's tests to read the game than move the check was not asked.
