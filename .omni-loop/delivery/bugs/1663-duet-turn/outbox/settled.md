# Settled outbox items — PRD 1663

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-duet-quitting-proofs-at-the-new-turn -->

## s1-01-duet-quitting-proofs-at-the-new-turn — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-12T09:19:20Z
- Channel: feature pull request #1668
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1668#issuecomment-6121340651
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
A. Keep the updated tests; the quitting rule's checks are unchanged (built).
```

### The item, as it was raised

```text
---
id: s1-01-duet-quitting-proofs-at-the-new-turn
prd: 1663
slice: s1
rank: high
bears-on: BR-PRODUCT-101
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The tests that prove how quitting OMNI DUET ends the game also pin how fast the orbs turn and how long the first wave lasts. Both changed, so those tests changed with them. Is that fine, the quitting rule itself being unchanged?

## The decision, in plain words

The tests now expect the slower turn and wait for the first wave to pass instead of a fixed time; every check of the quitting rule is as it was.

## The intro, for fun

The orbs learned to take their time.

## The punchline, for fun

The way out of the game stayed exactly where it was.

## The options, in plain words

A. Keep the updated tests; the quitting rule's checks are unchanged (built).
B. Keep the old turn and waves, and leave those tests as they were.

## What I had to decide

BR-PRODUCT-101 (quitting ends the run at its game over, the score sent once) is enforced by `duet/run.test.ts` and `scenes/duet.test.ts`. The range changes their expectations of the turn (0.6 turns a second) and makes the pause test wait until the first wave has passed rather than 300 frames, since chapter I's first wave now lasts about 5.5 s. Nothing that checks the law changed.

## What I did meanwhile

The branch turns at 0.6 turns a second and both test files expect it.

## What it costs to change later

A constant, `RULES.turnsPerSecond`, and the tests that pin it.

## What I could not know

- Whether 0.6 turns a second feels right: it follows the person's ask for real held rotations, but nobody has played it in the browser yet (author).

```

<!-- /omni-outbox-settled: s1-01-duet-quitting-proofs-at-the-new-turn -->

<!-- omni-outbox-settled: s1-02-duet-waves-for-a-person -->

## s1-02-duet-waves-for-a-person — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-12T09:19:20Z
- Channel: feature pull request #1668
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1668#issuecomment-6121340651
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
A. Keep the new waves and the human check (built).
```

### The item, as it was raised

```text
---
id: s1-02-duet-waves-for-a-person
prd: 1663
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Every wave of the game was rewritten for the slower turn, and the check that keeps them passable now plays a person who needs a quarter of a second to react. Endless mode keeps its rule but falls a little slower and spaces its rows wider. Is that fine?

## The decision, in plain words

All four chapters are new, wider spaced and slower to fall; endless mode still draws one to three of the last chapter's own rows from a fixed seed, from a speed just above that chapter's fastest up to a ceiling, and every wave is proven passable for a person.

## The intro, for fun

The blocks were rearranged for players with human thumbs.

## The punchline, for fun

They still fall; they just leave time to dodge.

## The options, in plain words

A. Keep the new waves and the human check (built).
B. Keep the old waves and the perfect-input check, with the slower turn only.

## What I had to decide

BR-PRODUCT-102 (endless waves from the last chapter's rows, a speed that rises then stops at a ceiling, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The range rewrites the chapters' waves, builds endless rows from chapter IV's own text, sets endless mode at 108 px/s rising by 1 every 5 waves to 120, 10 rows apart, and makes the passability check require a person's 0.25 s reaction. The law's statement still holds as written.

## What I did meanwhile

The branch holds the new waves; every chapter wave and the first 200 endless waves pass the human check, even at 0.4 s reaction with orbs 2 px wider.

## What it costs to change later

The waves are text in one file, and the reaction delay is one constant.

## What I could not know

- Whether the new chapters feel right to play: the check proves them passable for a person, not fun (author).
- Chapter IV no longer uses 7-cell sliding rows or the sliding gapped row: they failed the human check in random endless combinations (author).

```

<!-- /omni-outbox-settled: s1-02-duet-waves-for-a-person -->
