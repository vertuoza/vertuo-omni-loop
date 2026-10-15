---
id: s4-01-fix-pulls-a-fresh-main-too
prd: 1990
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When a person asks the sync tool to fix their checkout and their main branch is only a few hours behind, should it pull those commits too, or leave them since the status still reads green?

## The decision, in plain words

It pulls them: whenever main is behind and the checkout is clean, the fix brings it up to date, whatever the colour. The status line only turns red after a day, but a pull asked for is never wasted.

## The intro, for fun

Main is a few commits behind, yet the light is still green.

## The punchline, for fun

Asked to tidy up, the fix picks up the crumbs as well.

## The options, in plain words

A. A. Fast-forward whenever main is behind on a clean tree, green or red.
B. B. Fast-forward only while the main check is red, as the fix line suggests.
C. C. Fast-forward whenever behind, and have the fix line name the fast-forward while green too (a change to s1's status rules).

## What I had to decide

Whether omni sync --fix fast-forwards the default branch whenever it is behind, or only when the main check is red (its oldest missing commit older than sync.mainRedAfter).

## What I did meanwhile

kit/lib/sync/fix.ts fastForwardStep runs whenever the behind count is above zero on a clean default branch with nothing of its own; spec section 1's example prints main green at 2 behind with the fix line 'fast-forwards main', which this follows. kit/lib/sync/status.ts (s1) leaves 'fast-forwards main' off the fix line while main is green, so the fix line can say less than --fix does.

## What it costs to change later

One condition in fastForwardStep: require the main check's red finding to be open, a change of one line and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Spec section 7 says each step runs when its finding is open; whether a green 'behind' finding counts as open is not settled (author).
