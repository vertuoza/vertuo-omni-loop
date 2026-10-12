# Settled outbox items — PRD 1692

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-duet-endless-pace-and-new-shapes -->

## s1-01-duet-endless-pace-and-new-shapes — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-12T12:07:56Z
- Channel: feature pull request #1702
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1702#issuecomment-6123957586
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-102
- Raised: 2026-10-12
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built; BR-PRODUCT-102 reads as before, its ceiling now 170.

### The answer, as it was given

```text
A. Keep the faster endless mode and the new shapes (built).
```

### The item, as it was raised

```text
---
id: s1-01-duet-endless-pace-and-new-shapes
prd: 1692
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Endless mode now rises much higher, to about three circle radii a second, with tighter groups, and the waves gain gates, upright blocks, short bars and chains of turning rods. Endless still starts just above the last chapter's fastest and stops at a ceiling. Is that fine?

## The decision, in plain words

Endless starts at 145, rises by one every two waves and stops at 170; it still draws one to three of chapter IV's own runs from a fixed seed, now including the new shapes and rod chains, and every wave stays proven passable for a person.

## The intro, for fun

Endless mode found a higher gear.

## The punchline, for fun

It still stops before the orbs lose their heads.

## The options, in plain words

A. Keep the faster endless mode and the new shapes (built).
B. Keep endless at its old ceiling of 155 and the shapes as they were.

## What I had to decide

BR-PRODUCT-102 (endless waves from the last chapter's own rows and a fixed seed, a speed starting just above that chapter's fastest, rising slowly to a ceiling, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The range raises the ceiling from 155 to 170 px/s at one more every two waves, tightens groups of one pose to 1.25 R, starts each endless wave 1 R above the field, and adds the new shapes to chapter IV's runs. The law's statement still holds as written.

## What I did meanwhile

The branch holds the new pace and shapes; the first 200 endless waves pass the human check with room to spare.

## What it costs to change later

A few constants and wave text in one file.

## What I could not know

- Whether 170 px/s feels right as endless's ceiling: measured from the original, not played here (author).

```

<!-- /omni-outbox-settled: s1-01-duet-endless-pace-and-new-shapes -->
