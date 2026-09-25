---
id: s13-01-item-new-json-shape-and-input-flag-rename
prd: 7
slice: s13
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Once the outcome flag needed the name a caller already used for its input file, what should the input file's own flag be called, and should a bad option be caught before anything is written?

## The decision, in plain words

Two decisions, taken together: the input file flag is renamed so the outcome flag can keep the shorter name, and a raised item is now graded the same way the outbox check grades one, before anything is written or adopted.

## The options, in plain words

A. Rename the input file flag and give the outcome flag the shorter name, the option built.
B. Keep the input file flag's old name and give the outcome flag a longer, different name instead.

## What I had to decide

What the input file's own flag should be called once the outcome flag needs the name it used to hold, and whether a raised item should be graded before it is written or adopted.

## What I did meanwhile

Two decisions, side by side. First, the input file flag is renamed, and the outcome flag prints one JSON object with the outcome, the rank, the id, the file, whether it was adopted, and a reason. Second, a rendered item is now graded the same way the outbox check grades one, before anything is written or adopted, so a bad option or a below-floor rank is caught at the source.

## What it costs to change later

A caller still using the old input-file spelling gets a plain usage message naming what is missing, not the written item it expected; nothing is silently lost, but nothing is recorded either until that caller is updated to the new spelling.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a future caller would rather keep the old input flag name and give the outcome flag a different one instead
