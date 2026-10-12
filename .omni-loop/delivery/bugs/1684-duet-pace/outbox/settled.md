# Settled outbox items — PRD 1684

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-duet-quitting-proofs-steer-the-first-wave -->

## s1-01-duet-quitting-proofs-steer-the-first-wave — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-12T10:41:25Z
- Channel: feature pull request #1685
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1685#issuecomment-6122642833
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-101
- Raised: 2026-10-12
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built; BR-PRODUCT-101 and BR-PRODUCT-102 read as before.

### The answer, as it was given

```text
A. Keep the tests steering through the first wave; the quitting rule's checks are unchanged (built).
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-01-duet-quitting-proofs-steer-the-first-wave -->

<!-- omni-outbox-settled: s1-02-duet-short-fast-waves-without-uprights -->

## s1-02-duet-short-fast-waves-without-uprights — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-12T10:41:25Z
- Channel: feature pull request #1685
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1685#issuecomment-6122642833
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-102
- Raised: 2026-10-12
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built; BR-PRODUCT-101 and BR-PRODUCT-102 read as before.

### The answer, as it was given

```text
A. Keep the faster, shorter waves without upright bars; endless starts just above the new chapter IV (built).
```

### The item, as it was raised

```text
---
id: s1-02-duet-short-fast-waves-without-uprights
prd: 1684
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The waves now fall about twice as fast, are short, always ask a move, and no longer use upright bars. Endless mode keeps its rule but starts faster, just above the new last chapter. Is that fine?

## The decision, in plain words

Only half bars and centre blocks remain; chapters fall at about two circle radii a second, each wave lasts at most eight seconds and asks at least two moves; endless mode starts at 145 and rises to 155, and every wave stays proven passable for a person.

## The intro, for fun

The blocks stopped dawdling.

## The punchline, for fun

A chapter now fits in the time it takes to make a coffee.

## The options, in plain words

A. Keep the faster, shorter waves without upright bars; endless starts just above the new chapter IV (built).
B. Keep the slow, long waves and the upright bars.

## What I had to decide

BR-PRODUCT-102 (endless waves from the last chapter's own rows and a fixed seed, a speed starting just above that chapter's fastest, rising slowly to a ceiling, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The range removes the upright bar, rewrites all 40 chapter waves at about twice the speed, and moves endless to 145, +1 every 5 waves, ceiling 155, chapter IV's fastest being 143. The law's statement still holds as written.

## What I did meanwhile

The branch holds the new waves; every chapter wave and the first 200 endless waves pass the spacing rule and the human check with room to spare.

## What it costs to change later

The speeds and waves are text in one file.

## What I could not know

- Whether the new pace feels right: proven passable and short, not played in the browser (author).

```

<!-- /omni-outbox-settled: s1-02-duet-short-fast-waves-without-uprights -->
