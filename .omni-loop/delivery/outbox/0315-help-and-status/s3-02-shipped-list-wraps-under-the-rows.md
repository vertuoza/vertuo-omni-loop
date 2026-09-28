---
id: s3-02-shipped-list-wraps-under-the-rows
prd: 315
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When the list of your shipped PRDs runs onto a second line, where should that line start?

## The decision, in plain words

It starts where the numbers of the rows above it start, as the spec's example draws it, not under the first shipped PRD of the list.

## The intro, for fun

The spec's picture and the plan's sentence disagree by exactly four spaces.

## The punchline, for fun

The picture won, and the list now lines up with the rows above it.

## The options, in plain words

A. Start the next lines where the rows' numbers start, as the spec's example draws it: the option built.
B. Start them under the first shipped PRD of the list, four columns further right, as the plan's sentence reads.

## What I had to decide

Where the continuation lines of the `shipped` row of yours start. The spec's example starts them at the same column as the `#` of the rows above, under the count `24:`. The plan's check says the list is wrapped at 80 columns under the first entry, which read literally is four columns further right, under `#301`.

## What I did meanwhile

`shippedRow` in `kit/lib/status/format.mjs` starts every continuation line at column 13, the column the line under the bar and the other rows' numbers start at, and never ends a line on the separator. Pinned against the spec's example in `kit/lib/status/format.test.mjs`.

## What it costs to change later

One indent in `kit/lib/status/format.mjs` and the lines of the tests that pin it. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example and the plan's check place the second line of the shipped list at two different columns; the spec was taken as the source of truth.
