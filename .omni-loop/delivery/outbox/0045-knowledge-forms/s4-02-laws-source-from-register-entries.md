---
id: s4-02-laws-source-from-register-entries
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Once every install creates the knowledge folder, how should the install decide whether a repository has product rules that bind the agents?

## The decision, in plain words

It looks for at least one written principle, rule or invariant, instead of only checking that the folder exists.

## The options, in plain words

A. The install reads laws from the registers only when they hold at least one principle, rule or invariant.
B. Keep PRD 39's rule, where the folder existing means laws. A reinstall then reads laws from empty registers, which changes nothing until an entry is written.
C. The install stops guessing and always writes none; a person switches it on by hand.

## What I had to decide

PRD 39's `detectLawsSource` returns `knowledge` whenever `.omni-loop/knowledge` exists. A first install detects it before any form is written, so it still reads `none`. But decision 13 makes every install create that folder, so any later `omni init --force` would switch `laws.source` to `knowledge`, even in a repository whose registers are empty. This is spec decision 14, added while re-planning and never put to the PRD author.

## What I did meanwhile

The spec (decision 14) and the plan (s4, in `kit/lib/init/detect.mjs`) change the detection to registers that hold at least one entry. PRD 39's tests change only where they assert `laws.source` on a bare knowledge folder. Nothing is built yet: s4 is in wave 4.

## What it costs to change later

One function and its tests. If B or C is chosen, s4 drops the change, and nothing else in the plan depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a repository with an empty register folder ever means to adopt laws soon, and so should read as having them (author).
