---
id: s3-03-one-test-outside-and-a-local-id-reader
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Adding the new check meant touching one test outside this slice's ground, and reading a product PRD's name before the slice that teaches the kit those names has landed. Are both acceptable?

## The decision, in plain words

Yes, kept small: the test that lists every function the App serves now lists the new one, and the check reads a name like mobile-12 with its own short reader until the kit's shared one lands.

## The intro, for fun

The new check arrived before its name tag printer did.

## The punchline, for fun

So it wrote its own name tag, in the same handwriting, for now.

## The options, in plain words

A. A. Keep the test change and the local reader until s2 lands (built).
B. B. Wait for s2 and use its parser in this slice before merging.

## What I had to decide

Confirm the change to apps/omni-app/src/outbox-check/inngest-route.test.ts, and that productPrdOf() in apps/omni-app/src/approved-check/state.ts is swapped for s2's kit/lib/ids parser once it lands.

## What I did meanwhile

inngest-route.test.ts lists APPROVED_FUNCTION_ID and counts 11 registered functions (7 served). productPrdOf() reads 'Part of <key>-<n>' with the key rule of 20261203090000_product_prd_ids.sql (lowercase kebab-case, each part starting with a letter, at most 40 characters). entries/inngest.ts still says it serves six functions; that file is s4's ground.

## What it costs to change later

Swapping the reader for the kit's is an import and a deleted regular expression; reverting the test change is three lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) kit/lib/ids is s2's territory and runs in parallel, so this slice could not use its parser.
- (author) The comment in apps/omni-app/entries/inngest.ts naming six functions is now stale.
