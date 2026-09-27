---
id: s5-04-demo-sample-invented-releases
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

When the app runs without its database, on a developer's machine, the release notes page shows a sample. What should that sample hold?

## The decision, in plain words

The real initial release, word for word, then six invented releases over the following weeks, so the sample shows how older weeks fold away.

## The intro, for fun

A sample page needs a past, and this project only has one week of it so far.

## The punchline, for fun

So the sample borrows a few weeks from the future, and promises nothing about them.

## The options, in plain words

A. The real initial release, then invented releases over five weeks: the option built.
B. Only the real initial release: nothing invented, but no folded week to see.
C. The real initial release, then entries that read plainly as placeholders.

## What I had to decide

The spec asks for a built-in demo sample, and for screenshots of `/releases` from it; it does not say what the sample holds. Showing a folded week takes more than four weeks of releases, and only one week exists.

## What I did meanwhile

`apps/galaxy/src/releases/demo.ts`: the 21 pinned notes, word for word, each dated when its shipped folder reached main (its test holds them to the shipped notes), then releases 0.0.2 to 0.0.7 (PRDs 262, 270, 284, 291, 305 and 318) from 28 September to 20 October 2026, each passing the note rules. 0.0.2 is the before/after page's own example. Only development and `OMNI_LOOP_DEMO=1` builds show it.

## What it costs to change later

The sample rows in one file and its test. Nothing in production reads them; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The invented releases carry PRD numbers that real PRDs may take later; in development they could be read as real.
