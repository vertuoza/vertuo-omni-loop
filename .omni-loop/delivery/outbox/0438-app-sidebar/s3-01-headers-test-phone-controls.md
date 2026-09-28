---
id: s3-01-headers-test-phone-controls
prd: 438
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The phone menu button and the small logo now open the app's top bar, so the shared check that reads every app page's top bar had to learn about them. That check belongs to other parts of this work: may this part change it?

## The decision, in plain words

I changed that one check so it expects the menu button and the logo first, then the theme switch and Game mode as before. Nothing else in it moved.

## The intro, for fun

Two new buttons walked into the top bar and the bouncer had a list.

## The punchline, for fun

We added their names to the list rather than hide them in the coat room.

## The options, in plain words

A. Keep the menu button and the logo at the start of the top bar, and let the shared check expect them (built).
B. Move them after the rest of the bar in the page and place them on the left by layout only, so the shared check stays untouched; keyboard order would then differ from what is seen.
C. Draw the phone's first row outside the top bar, as a separate strip that only phones see.

## What I had to decide

Whether the shared page-header check may name the phone menu button and the logo, or whether they should live somewhere the check does not read.

## What I did meanwhile

The check expects the menu button and the logo before the theme switch; on a computer both stay hidden, on a phone they open the bar.

## What it costs to change later

Undoing it is two lines in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan names the shared check as the other slices' ground, and says nothing on whether this slice may extend it (author).
