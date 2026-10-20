---
id: s4-01-business-tests-expected-the-moved-sections
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

Four existing tests expected Settings › Business to draw the Constituents and the Personas, which this slice takes off that page, so should those four tests change?

## The decision, in plain words

This slice rewrote those four tests to say the page no longer draws them, and kept every test of the Constituents panel and the Personas section itself unchanged.

## The intro, for fun

Four tests were waiting for guests who have since moved to another house.

## The punchline, for fun

We told them the address, and they stopped checking the door.

## The options, in plain words

A. Rewrite the four tests to assert the sections are gone from Business, keeping every direct test of the components untouched (built).
B. Keep the four tests as they were and leave the sections on Business as well as on the Knowledge home, which contradicts the spec.

## What I had to decide

The spec asks both that Settings › Business render neither section, with a render test proving it, and that every existing test of the panel and the section pass unchanged. Four tests (two in constituents-render.test.ts, two in personas-render.test.ts) rendered the whole Business screen and expected the sections on it, so both cannot hold for those four. I kept the components and their direct tests as they were and rewrote only those four to assert the sections are absent from the Business screen.
Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

The Business page draws neither section; the Knowledge home draws both. The sample data (DEMO_PERSONAS, DEMO_CONSTITUENTS) stays in BusinessScreen.tsx and the demo of the Knowledge pages reads it from there.

## What it costs to change later

Reverting means putting the two props back on the Business page and the four tests as they were, about one hundred lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The Business page's read (load.ts) still reads every persona although nothing draws them there any more; its own test expects that read, so slice s6, which owns the rest of that page, may drop it (author)
