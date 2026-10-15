---
id: s3-01-knowledge-page-edges
prd: 1990
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Three edges of the knowledge and page checks were not settled: a plan repository whose targets come from a product page, the knowledge files changed inside a skill's own working copy, and a sign-in whose short-lived key ran out but can be renewed. What should the sync status say for each?

## The decision, in plain words

A product's target list is skipped because reading it needs the page, and knowledge changes in a skill's working copy are not counted. A sign-in that can still be renewed counts as signed in until the page itself refuses it.

## The intro, for fun

Three small corner cases walked into the sync check and each asked to be counted.

## The punchline, for fun

For now none of them nags anyone; one line of code each undoes that.

## The options, in plain words

A. A. As built: skip a product's target list, skip knowledge edits in a skill's working copy, count a renewable sign-in as signed in.
B. B. Count them: read the product's cached target list, judge skill working copies too, and call an expired key not signed in even when it can be renewed.

## What I had to decide

Confirm the three choices, or say which should count as a finding instead.

## What I did meanwhile

The checks stay quiet on these three, so a person is never nagged by a state the spec did not name.

## What it costs to change later

Each is one condition in the knowledge and page gatherers; changing one touches no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a product's targets should be read from its cached list in the knowledge check (author)
- Whether knowledge edits in a skill's working copy should count (author)
