# Settled outbox items — PRD 2156

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-duet-gate-hold -->

## s1-01-duet-gate-hold — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-17T21:31:03Z
- Channel: feature pull request #2158
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2158#issuecomment-6241408583
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-102
- Raised: 2026-10-17
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built and states nothing new about the product; BR-PRODUCT-102 reads as before.

### The answer, as it was given

```text
1: A
```

### The item, as it was raised

```text
---
id: s1-01-duet-gate-hold
prd: 2156
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-17
wave: 1
---

## The question, in plain words

A gate next to an obstacle of the other pose (a centre block, an upright block, a short bar) now stands 1.75 R further from it, so the moment to start the turn is as long as beside a half bar (0.55 s or more, it was 0.20 to 0.28 s). Chapter I's waves 4, 7 and 10 and chapter IV's wave 9 get longer by about half a second, and endless mode spaces its gates by the same rule. Is that fine?

## The decision, in plain words

The spacing rule asks a change of pose between two still obstacles 1.75 R more room when one of them is a gate, because a gate holds the pair upright while it crosses the whole circle, where a half bar asks its pose only at the centre's height. The gates of chapter I's waves 4, 7, 10 stand 3 to 3.1 R from the change, chapter IV's wave 9's 3.45 R; endless mode's gaps count it.

## The intro, for fun

The gate kept the orbs upright all the way down, and the centre block was already waiting.

## The punchline, for fun

Now the centre block waits a little further back.

## The options, in plain words

A. A gate beside a change of pose asks 1.75 R more room, in the chapters and in endless mode (built).
B. Keep the spacing, and drop gates next to centre blocks from the waves altogether.

## What I had to decide

BR-PRODUCT-102 (endless waves from the last chapter's own rows and a fixed seed, a speed rising slowly to a ceiling, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The fix keeps the law's statement: the rows, the seed and the ceiling are unchanged, and every wave stays passable; only the room before a change beside a gate grows.

## What I did meanwhile

The branch holds the gate's hold in the spacing rule, the respaced waves, and a test measuring how long the moment to start each change of pose lasts in every chapter wave and the first 200 endless waves; every existing check stays green.

## What it costs to change later

One constant, `SHAPE.gate.hold`, and four wave distances in `duet/waves.ts`.

## What I could not know

- Whether 0.55 s feels right in play: measured against the half bars' changes, not played here (author).
- Whether a gate next to a sliding block or a rod asks the same: those changes ask a turn, not a pose, and are left as they were (author).
```

<!-- /omni-outbox-settled: s1-01-duet-gate-hold -->
