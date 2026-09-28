---
id: s1-01-no-promotion-keeps-the-ship
prd: 487
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a merged feature taught nothing new, should the harvest also skip the bookkeeping it does at merge time, like moving the feature's folder to the shipped shelf?

## The decision, in plain words

It skips only its own notes about what stayed local. If the feature's folder still has to move to the shipped shelf, or open questions still have to be closed, that still happens.

## The intro, for fun

Nothing new was learned, but the boxes still have to go to the attic.

## The punchline, for fun

We skip the diary entry, not the move.

## The options, in plain words

A. A. Skip only the harvest's own notes; still settle and ship what prepare planned, the option built.
B. B. Drop every change, the settling and the move included, so no pull request ever opens without a promotion.
C. C. Keep the notes too, and let the app decide from the list of promotions whether to open a pull request.

## What I had to decide

Whether a harvest with nothing promoted drops every change it would make, or only its own notes about what stayed local.

## What I did meanwhile

A harvest with no new register entry or decision record keeps the merge-time settling and the move out of the inbox that prepare planned, and adds none of its own ledger lines. For a feature already shipped by its branch, which is the usual case, that is no change at all, so the app opens no pull request.

## What it costs to change later

One line in the harvest's finishing step: return no changes at all instead of only what prepare planned.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the harvest returns no edits and the app opens no pull request; it does not say what should happen to a feature still in the inbox at merge, whose move would then never be made by anyone.
- (author) Without the local notes, a replayed harvest asks the model about the same candidates again; the spec does not say whether that matters.
