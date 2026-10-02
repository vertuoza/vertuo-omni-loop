---
id: s6-04-supabase-hint-not-text
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

When the database refuses an import of personas, the tool repeats the database's hint. If that hint ever came back as something other than text, should the tool print a meaningless placeholder, or leave the hint out?

## The decision, in plain words

It leaves such a hint out. A hint that is text, as every hint the database sends today is, prints exactly as before.

## The intro, for fun

The database left a note, folded into a paper plane.

## The punchline, for fun

The tool now reads notes, not paper planes.

## The options, in plain words

A. Read a hint that is not text as no hint, as item s4-01 does for the outbox.
B. Print it written out in full, so a hint of another shape is still shown.
C. Keep printing it as before, placeholder included.

## What I had to decide

scripts/personas-import.ts wrote the refusal's hint with `String(body.hint)`, which prints an object as `[object Object]`, and the linter refuses that (no-base-to-string). Any fix moves that one output.

## What I did meanwhile

The hint is read through `plainText` (kit/lib/outbox/plain-text.ts, from item s4-01): a truthy text, number or boolean prints as before, and anything else reads as no hint.

## What it costs to change later

A constant: one line in scripts/personas-import.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Supabase documents its hint as text or null; nothing says what a hint of another shape should print.
