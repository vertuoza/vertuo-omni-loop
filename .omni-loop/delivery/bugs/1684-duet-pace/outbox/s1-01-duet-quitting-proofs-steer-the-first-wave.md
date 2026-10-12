---
id: s1-01-duet-quitting-proofs-steer-the-first-wave
prd: 1684
slice: s1
rank: high
bears-on: BR-PRODUCT-101
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The tests that prove how quitting OMNI DUET ends the game used to get past the first wave by not moving. Every wave now asks the player to move, so those tests now steer through the first wave instead. What they check about quitting is unchanged. Is that fine?

## The decision, in plain words

The tests steer the orbs through the first wave before checking quitting; every check of the quitting rule is as it was.

## The intro, for fun

The tests can no longer sit still through the first wave.

## The punchline, for fun

So they learned to steer, then checked the exit as before.

## The options, in plain words

A. Keep the tests steering through the first wave; the quitting rule's checks are unchanged (built).
B. Leave those tests as they were, and keep a first wave that can be passed without moving.

## What I had to decide

BR-PRODUCT-101 (quitting ends the run at its game over, the score sent once) is enforced by `duet/run.test.ts` and `scenes/duet.test.ts`. Their setup held the orbs still through chapter I's first wave, which the fix forbids. Three tests of `run.test.ts` and the "sends the score reached on SELECT on the pause, once" test of `scenes/duet.test.ts` now steer through it with the waves' own route; their assertions are unchanged.

## What I did meanwhile

The branch holds the steering setups; both files pass.

## What it costs to change later

A few lines of test setup.

## What I could not know

- Nothing the knowledge does not settle (author).
