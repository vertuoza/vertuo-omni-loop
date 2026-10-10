---
id: s6-03-plugin-test-gains-design-memory-tests
prd: 1407
slice: s6
rank: high
bears-on: BR-PRODUCT-89
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The test file that proves the loop never starts too many agents at once also holds the checks on how every skill is written, and this work added checks for locking screens to it. Is it all right to add to that file?

## The decision, in plain words

Yes: the new checks cover only the design craft command and the slice builder, and the checks proving the agent limit were left exactly as they were.

## The intro, for fun

Another chapter went into the rulebook the judge keeps on the bench.

## The punchline, for fun

The judge's page is untouched, but the bench still asks for a signature.

## The options, in plain words

A. A. Add the tests to the file the plan names, leaving the agent-limit tests untouched (built)
B. B. Move this slice's tests to a file of their own, so the law's proof file does not change

## What I had to decide

Whether the checks of locking, the review against a locked screen and the slice builder reading the screen library go in the test file the plan names, which also proves BR-PRODUCT-89, or in a test file of their own.

## What I did meanwhile

A new describe block in kit/test/plugin.test.ts holds twelve tests for this slice, and the pixel-perfect block gained the lock command and the language section; no line of the tests proving BR-PRODUCT-89 changed, and the whole file passes.

## What it costs to change later

A constant: move the new describe block to its own file under kit/test, which then no law names.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names kit/test/plugin.test.ts as this slice's test file, as it did for PRD 1342, whose same question was answered A (author)
