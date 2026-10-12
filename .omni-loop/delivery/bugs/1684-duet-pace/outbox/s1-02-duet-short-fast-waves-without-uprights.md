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
