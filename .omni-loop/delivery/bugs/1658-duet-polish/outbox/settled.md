# Settled outbox items — PRD 1658

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-duet-quitting-proof-at-the-slower-turn -->

## s1-01-duet-quitting-proof-at-the-slower-turn — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-12T07:50:56Z
- Channel: feature pull request #1659
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1659#issuecomment-6120044323
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-101
- Raised: 2026-10-12
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built and states nothing new about the product; BR-PRODUCT-101 and BR-PRODUCT-102 read as before.

### The answer, as it was given

```text
A. Keep the new speed numbers in that file; the quitting rule's checks are unchanged (built).
```

### The item, as it was raised

```text
---
id: s1-01-duet-quitting-proof-at-the-slower-turn
prd: 1658
slice: s1
rank: high
bears-on: BR-PRODUCT-101
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The test file that proves how quitting OMNI DUET ends the game also pins how fast the orbs turn. Turning is now slower, so its numbers changed. Is that fine, the quitting rule itself being untouched?

## The decision, in plain words

The speed numbers in that file now say the new, slower turn; every check of the quitting rule is as it was.

## The intro, for fun

The orbs took a deep breath and slowed down.

## The punchline, for fun

The rule about leaving the game did not even notice.

## The options, in plain words

A. Keep the new speed numbers in that file; the quitting rule's checks are unchanged (built).
B. Keep the old turning speed, and leave the file as it was.

## What I had to decide

BR-PRODUCT-101 (quitting ends the run at its game over, the score sent once) is enforced by `duet/run.test.ts`. The range changes that file's expectations of the turn from 1.75 to 1.25 turns a second, and nothing that checks the law.

## What I did meanwhile

The branch turns the pair at 1.25 turns a second, and `run.test.ts` expects that speed.

## What it costs to change later

A constant: `RULES.turnsPerSecond` and the numbers that pin it.

## What I could not know

- The person asked for "a little slower"; 1.25 turns a second is the agent's pick of how much, not tried in the browser (author).

```

<!-- /omni-outbox-settled: s1-01-duet-quitting-proof-at-the-slower-turn -->

<!-- omni-outbox-settled: s1-02-duet-wave-seven-shorter-bar -->

## s1-02-duet-wave-seven-shorter-bar — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-12T07:50:56Z
- Channel: feature pull request #1659
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1659#issuecomment-6120044323
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-102
- Raised: 2026-10-12
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built and states nothing new about the product; BR-PRODUCT-101 and BR-PRODUCT-102 read as before.

### The answer, as it was given

```text
A. Shorten that wave's top bar, and keep every wave passable at the slower turn (built).
```

### The item, as it was raised

```text
---
id: s1-02-duet-wave-seven-shorter-bar
prd: 1658
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

At the slower turn, one wave of chapter II could no longer be dodged, so its top bar is now half as long. The files that keep every wave passable changed with it. Is that fine?

## The decision, in plain words

That wave's top bar is two cells long instead of four, and every wave, endless ones included, is still proven passable at the new speed.

## The intro, for fun

One bar was too wide for the slower orbs to slip past.

## The punchline, for fun

So it lost half its length and none of its spikes.

## The options, in plain words

A. Shorten that wave's top bar, and keep every wave passable at the slower turn (built).
B. Keep the wave as it was, and turn the orbs at their old speed instead.

## What I had to decide

BR-PRODUCT-102 (endless waves drawn from the last chapter's rows, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The range shortens chapter II wave 7's still bar from four cells to two in `waves.ts`, and the passability ring the test pins moves from 240 bins, 7 a step, to 48 bins, 1 a step, as the slower turn makes it. Endless waves are drawn from chapter IV's rows, which did not change.

## What I did meanwhile

The branch holds the shorter bar; the passability check passes every chapter wave and the first 200 endless waves.

## What it costs to change later

One line of a wave's text.

## What I could not know

- Whether the shorter bar keeps wave 7 as hard as it was meant to be: it was judged by the passability check, not played (author).

```

<!-- /omni-outbox-settled: s1-02-duet-wave-seven-shorter-bar -->
