---
id: s1-01-version-picker-keeps-every-tab
prd: 384
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Once the PRD page opens on Questions, picking an older version of the before-and-after page sent the reader to Questions instead. Should the version choice always remember which tab it came from?

## The decision, in plain words

Yes: picking a version now always keeps the tab you were on, the before-and-after tab included, so the address gains a tab mention it did not carry before.

## The intro, for fun

The page grew a new front door, and the old side door started leading to the wrong room.

## The punchline, for fun

So now every door says which room it opens.

## The options, in plain words

A. Always carry the tab: what was built; the picker names its tab every time, so it can never land on the wrong one.
B. Carry it except on the default tab: a cleaner address, but the picker would need to know the page's default, which now depends on whether a question was asked.
C. Leave the picker as it was: no change outside the slice, but picking a version of the before-and-after page on a PRD with questions lands on Questions.

## What I had to decide

Whether the version picker, which sits outside this slice's declared files, may carry the tab on every tab.

## What I did meanwhile

The picker always names its tab; a version picked on the before-and-after tab stays there.

## What it costs to change later

One line in the version picker; undoing it is putting the old condition back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The version picker file is not in slice s1's declared territory; no sibling slice declares it either (author).
