---
id: s1-01-step-line-names
prd: 2906
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The spec's example and its first acceptance test name the current step differently on the line of steps: a short name in one, the full name in the other. Which should the line show, and what are the short names?

## The decision, in plain words

The step the work is at shows its full name, so the person reads what is happening now; the steps done and to come show short names. A short name never holds a technical word, so a bug fix's fourth step reads Checked rather than Checks running.

## The intro, for fun

Two drafts of one sentence walked into a status block.

## The punchline, for fun

The long one got the arrow, the short ones got the ticks.

## The options, in plain words

A. Full name for the step it is at, short names for the rest, no technical word in a short name: what was built.
B. Short names everywhere, as the spec's example shows, and change the first acceptance test to match.
C. Full names everywhere, and no short names at all.

## What I had to decide

The spec's example prints the strip as `✓ Understood  ✓ Reproduced  ✓ Fixed  ▶ Checks running  ○ Your review  ○ Merged` (short names everywhere), while acceptance criterion 1 asks for `Step 3 of 6` with `▶ Reproduced, fixing it` (the step's full name). The spec names short names only in its example (bug fix); the other kinds' short names were not given. Built in `kit/lib/now/status/words.ts` (`STEPS[*].short`) and `render.ts` (`stepLine`): the step at prints `name`, the others `short`. Short names chosen: PRD before approval Shaped, Written down, Your approval, Ready to build; PRD build Planned, Built, Checked, Your answers or Your review, Shipped; bug fix Understood, Reproduced, Fixed, Checked, Your review, Merged; visual update Options shown, Pick applied, Checked, Your review, Merged. The spec's `Checks running` short became `Checked`, since `checks` is a word the block must explain the first time it appears, and an explanation inside the line of steps on every early step would crowd it; the full names keep `checks`, marked, and are explained there when no line above did.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Built the line with the full name for the current step and the short names above for the rest, every name in the one table of words, tested in render.test.ts and words.test.ts.

## What it costs to change later

A constant: each short name is one string in the table, and which name the current step prints is one line of the renderer; no stored data, no other reader yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives short names for the bug fix only; whether a person wants other short names for the PRD and visual update steps is not settled anywhere.
- (author) Whether the person prefers the spec example's Checks running as a short name, accepting that the word checks then needs its explanation inside the line of steps.
