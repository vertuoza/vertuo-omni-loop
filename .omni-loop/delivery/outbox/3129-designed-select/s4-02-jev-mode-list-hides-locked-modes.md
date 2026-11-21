---
id: s4-02-jev-mode-list-hides-locked-modes
prd: 3129
slice: s4
rank: medium
bears-on: none
raised: 2026-11-21
wave: 4
---

## The question, in plain words

Jev's mode picker greyed out Shadow and On until a key is stored, and the designed Select cannot grey out one option. Should the list hide them instead?

## The decision, in plain words

While no key is stored, the mode list offers Off only. Once a key is stored all three show.

## The intro, for fun

Two choices were greyed out in the old list.

## The punchline, for fun

The new list simply does not show them yet.

## The options, in plain words

A. A. Hide Shadow and On from the list while no key is stored, as built.
B. B. Add a disabled flag to the Select's options in a follow-up and grey them out as before.

## What I had to decide

Filtered the options of the Jev mode Select instead of marking them disabled, because the Select's options carry only a value and a label and packages/ui is outside this slice. The server still checks the mode again.
Decided by: Jev (hardToRevert 0.80) · agent said false

## What I did meanwhile

Shadow and On stay out of the list until a key is stored, as they were out of reach before.

## What it costs to change later

Adding a disabled flag to the Select's options later is a small change in packages/ui, then this line goes back to marking them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test of the old behaviour is lost; the pick is covered by select-pick.dom.test.ts. (author)
