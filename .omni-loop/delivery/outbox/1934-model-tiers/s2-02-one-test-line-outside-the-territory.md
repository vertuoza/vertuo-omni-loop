---
id: s2-02-one-test-line-outside-the-territory
prd: 1934
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Giving every slice a tier made one older test, outside this slice's ground, stop compiling. Was it right to add the one missing line there?

## The decision, in plain words

I added the one line that test needed, saying its slices advise no tier, rather than making the tier optional on every slice.

## The intro, for fun

A new field arrived and one old test forgot to set a place for it at the table.

## The punchline, for fun

One chair added, nobody else moved.

## The options, in plain words

A. A. Keep the tier always present, with the one fixture line outside the territory, as built.
B. B. Make the tier optional on a slice and drop the fixture line.

## What I had to decide

Whether to make a slice's tier always present (as the spec's done-when writes it) and add `tier: null` to the one hand-built fixture in kit/lib/flow/plan-rules.test.ts, or make the field optional and leave that file alone.

## What I did meanwhile

The tier is always present on a parsed slice, and kit/lib/flow/plan-rules.test.ts gains the line `tier: null,` in its slice builder: a territory breach of one line, reported at merge, changing no assertion.

## What it costs to change later

A constant: making the field optional later is a one-word type change and dropping that line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the s3 slice or a later PRD builds more slices by hand in tests, which would each need the same line (author).
