---
id: s8-03-plugin-test-gains-law-skill-tests
prd: 1342
slice: s8
rank: high
bears-on: BR-PRODUCT-89
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The test file that proves the loop never starts too many agents at once also holds the checks on how every skill is written, and this work added new checks to it. Is it all right to add to that file?

## The decision, in plain words

Yes: the new checks only cover the new rule-testing skill and the two fix skills, and the checks proving the agent limit were left exactly as they were.

## The intro, for fun

Someone added a new chapter to a rulebook that a judge keeps on the bench.

## The punchline, for fun

The judge's own page was not touched, but the bench still wants a signature.

## The options, in plain words

A. A. Add the tests to the file the plan names, leaving the agent-limit tests untouched (built).
B. B. Move this slice's tests to a file of their own, so the law's proof file does not change.

## What I had to decide

Whether the shape tests of /omni:enforce and the fix skills' law step go in kit/test/plugin.test.ts, the file BR-PRODUCT-89 names as its proof, or in a test file of their own.

## What I did meanwhile

A new describe block at the end of kit/test/plugin.test.ts holds nine tests for this slice; no line of the tests proving BR-PRODUCT-89 changed, and the whole file passes.

## What it costs to change later

A constant: move the new describe block to its own file under kit/test, which then no law names.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names kit/test/plugin.test.ts as this slice's territory and the spec puts the skill tests there; nothing says whether adding to a law's proof file without touching its tests needs an answer, so it is raised.
