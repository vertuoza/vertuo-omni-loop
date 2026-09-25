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

Once the outcome flag takes the name a caller already used for its input file, should the input file get a new name, and should a bad option be caught before anything is written?

## The decision, in plain words

The input file flag is renamed so the outcome flag can keep the obvious name, and a raised item is now graded the same way the outbox check grades one before anything is written or adopted.

## The options, in plain words

A. Rename the input file flag and give the outcome flag the shorter name, the option built.
B. Keep the input file flag's old name and give the outcome flag a longer, different name instead.

## What I had to decide

What the input file's own flag should be called once the outcome flag needs the name it used to hold, and whether a raised item should be graded before it is written.

## What I did meanwhile

The input file flag is renamed, the outcome flag prints one JSON object with the outcome, the rank, the id, the file, whether it was adopted, and a reason, and a rendered item is graded the same way the outbox check grades one before anything is written.

## What it costs to change later

Every caller of the old input file flag must pass the new name instead; a script or skill still using the old name gets a plain usage error naming the unknown flag.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a future caller would rather keep the old input flag name and give the outcome flag a different one instead
