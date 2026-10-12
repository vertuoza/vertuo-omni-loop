---
id: s1-01-duet-waves-in-a-vocabulary
prd: 1672
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Every wave is rewritten with three kinds of obstacles placed on the circle, each dodged by one clear position of the orbs. Endless mode keeps its rule, but its "rows" are now chapter IV's runs of obstacles that ask one position. Is that fine?

## The decision, in plain words

The waves use half bars from a wall, centre blocks and upright bars on the circle's edge, still, sliding or turning; endless mode draws one to three of chapter IV's own runs, at the same speeds, and every wave stays proven passable for a person.

## The intro, for fun

The blocks finally learned where the circle is.

## The punchline, for fun

Now each one tells you which way to stand.

## The options, in plain words

A. Keep the new vocabulary and waves; endless mode reads chapter IV's runs as its rows (built).
B. Keep the old grid of cells and its waves.

## What I had to decide

BR-PRODUCT-102 (endless waves are one to three of the last chapter's own rows from a fixed seed, at a speed starting just above that chapter's fastest, rising slowly to a ceiling, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The range rewrites both: chapter IV is no longer rows of cells but lines of obstacles, so endless mode draws its groups, chapter IV's runs of one pose. Speeds are unchanged (108, +1 every 5 waves, ceiling 120). The law's text still says "rows"; it is left as written.

## What I did meanwhile

The branch holds the vocabulary and the new waves; every chapter wave and the first 200 endless waves pass the human check with room to spare.

## What it costs to change later

The waves are text in one file and the obstacle sizes one constants block.

## What I could not know

- Whether the law's word "rows" should now read "runs of obstacles": left for a person, the meaning is unchanged (author).
- Whether the new chapters feel right: they follow Duet's vocabulary and are proven passable, not played in the browser (author).
