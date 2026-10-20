---
id: s3-01-knowledge-opens-on-unbuilt-constituents
prd: 2240
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The Knowledge tab now opens on Constituents, but Constituents, Personas, Pitch and Settings are built by later slices, so should their sub-menu entries exist and show no count until then?

## The decision, in plain words

The sub-menu lists all six sections in order and the Knowledge address sends a reader to Constituents. Only Legal and Glossary show a count and open a page for now; the other four answer not found until the slices that own them land.

## The intro, for fun

The menu has six doors, and only two have rooms behind them so far.

## The punchline, for fun

The other four are being furnished in the next waves.

## The options, in plain words

A. A. All six entries now, opening on Constituents as the spec says (built).
B. B. Show only the sections that exist, opening on Legal, and let each later slice add its entry.

## What I had to decide

Follow the spec as written: all six entries, opens on Constituents. The feature branch is only whole once s4, s5 and s6 have merged.

## What I did meanwhile

Legal and Glossary work fully; the four later sections are links that answer the not found page.

## What it costs to change later

Changing it later is a constant in one file (the first section and the counted sections in knowledge-sections.ts).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the Knowledge address should open on Legal until s4 lands was not specified.
