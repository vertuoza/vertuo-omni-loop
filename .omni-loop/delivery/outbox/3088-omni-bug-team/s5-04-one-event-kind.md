---
id: s5-04-one-event-kind
prd: 3088
slice: s5
rank: medium
bears-on: none
raised: 2026-11-19
wave: 3
---

## The question, in plain words

The room learns three things about a bug a mission waited on: it is fixed, it will not be fixed, or the PRD went again. Should all three use the one new kind of event the database has for this?

## The decision, in plain words

Yes: all three are bug-fixed events, each with its own sentence and a link to the public issue. The fix and the not-planned news come once per bug; the resume comes once, when the PRD is sent again.

## The intro, for fun

Three pieces of news, one envelope.

## The punchline, for fun

The letter inside says which one, so nobody has to guess from the stamp.

## The options, in plain words

A. All three as bug-fixed events, told apart by their sentence (built).
B. Add a fourth kind for the not-planned news and the resume, with a migration.

## What I had to decide

Which event kind carries the not-planned news and the resume, since the spec names only bug-fixed among the new kinds and the older kinds already have one-per-PRD meanings.

## What I did meanwhile

Recorded all three as bug-fixed, each keyed so a replay records none twice: the news by the first repair that met the bug, the resume by the step sent again. The room's slice reads them by their sentences.

## What it costs to change later

Splitting them later takes a migration widening the kinds and a change to the room's reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's section 7 names the three new kinds but not which one carries the not-planned news or the resume.
