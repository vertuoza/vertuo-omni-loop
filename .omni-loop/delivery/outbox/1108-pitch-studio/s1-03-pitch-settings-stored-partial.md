---
id: s1-03-pitch-settings-stored-partial
prd: 1108
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

How much of a product's Pitch settings should be stored, and what happens to the old look choice?

## The decision, in plain words

A product may store only part of its settings, the rest read from its look's preset and the defaults, while the old look choice is kept in step with that preset. Logos, fonts and music go to a private folder per product that any member of the workspace may change.

## The intro, for fun

Half a recipe card is fine as long as the cookbook fills in the rest.

## The punchline, for fun

And the old card stays in the drawer, still telling the truth.

## The options, in plain words

A. A. Store partial settings filled on read, keep the old choice in step, any member changes the files (built).
B. B. Store every product's settings whole, written out by the change.
C. C. Only workspace owners may change the settings and the files.

## What I had to decide

The spec asks that each product's old look reads as the matching preset after the change, and that the old column is kept. Storing just the preset name for existing products, and filling the rest when read, does that with no copy of the presets in the database.

## What I did meanwhile

Existing products store their preset name only; the database refuses a value the terminal could never read; both choices stay in step.

## What it costs to change later

Moving to fully stored settings later is one update that writes each product's filled value; the reads already fill them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Who counts as an editor is any member of the workspace today, as for the rest of the business settings; the spec's line about another member who cannot upload reads as a member of another workspace.
