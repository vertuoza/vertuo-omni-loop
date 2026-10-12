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
