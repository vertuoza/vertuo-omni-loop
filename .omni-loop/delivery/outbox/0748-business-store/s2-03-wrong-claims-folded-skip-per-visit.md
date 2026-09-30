---
id: s2-03-wrong-claims-folded-skip-per-visit
prd: 748
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

What does the page show for a fact someone marked wrong, and what does Skip remember?

## The decision, in plain words

A fact marked wrong moves to a folded list at the bottom, where a tap on ✓ brings it back. Skip only folds the picks away for this visit and stores nothing, so the picks are back on the next visit.

## The intro, for fun

Some answers were wrong, and one person was not ready to answer at all.

## The punchline, for fun

Both were shown the side door, and it stays unlocked.

## The options, in plain words

A. Folded list for wrong facts, Skip for this visit only, the option built
B. Hide wrong facts from the page entirely, Skip for this visit only
C. Folded list, and Skip remembered in a cookie so the picks stay folded

## What I had to decide

Where rejected claims show on Settings › Business, and whether Skip is remembered between visits.

## What I did meanwhile

Rows list confirmed and proposed claims; rejected ones sit under a folded 'Marked wrong · N' with ✓ enabled. Skip sets page state only (no storage, no cookie); reloading shows the picks again. Opening the page still makes the business itself through business_open, as the spec asks, with no claim.

## What it costs to change later

A few lines of apps/galaxy/src/business/BusinessView.tsx and model.ts; remembering Skip would need a cookie or a stored flag.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the row is kept and leaves the sentence, and that Skip stores nothing, but not where a kept row shows or whether Skip lasts
