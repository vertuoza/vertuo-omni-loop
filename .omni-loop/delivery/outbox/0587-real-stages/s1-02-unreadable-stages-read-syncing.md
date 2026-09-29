---
id: s1-02-unreadable-stages-read-syncing
prd: 587
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When the page cannot read a PRD's stored stages, what should it say?

## The decision, in plain words

It says Syncing, the same words as a PRD not synced yet, and logs the error for us.

## The intro, for fun

The database hiccupped, and the page had to say something polite.

## The punchline, for fun

It chose Syncing, which is technically hopeful and never rude.

## The options, in plain words

A. Show Syncing, the option built.
B. Show a separate line saying the stage could not be read, with a hint to reload.

## What I had to decide

What a PRD page shows when the read of its stored stages fails.

## What I did meanwhile

A failed read is logged and treated as no stored stage: the header reads Syncing… with nothing lit.

## What it costs to change later

One line in the route: a different word or state for a failed read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often the read fails in production (author)
