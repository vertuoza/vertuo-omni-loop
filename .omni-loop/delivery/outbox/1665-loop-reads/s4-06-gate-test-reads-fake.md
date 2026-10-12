---
id: s4-06-gate-test-reads-fake
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

One test of the next-step command, outside this slice's ground, stood in for GitHub with empty answers. Once the command read the Omni page instead, that test failed, so I changed it: is that fine?

## The decision, in plain words

The test now hands the command the shared empty stand-in for the Omni page's answers. Its three checks on approvals are unchanged and pass.

## The intro, for fun

The understudy learned new lines, and the old script still had the old ones.

## The punchline, for fun

One line of the old script changed, the play is the same.

## The options, in plain words

A. A. Hand the gate test the shared empty fake (built).
B. B. Route its fetch by URL so the loop's reads answer empty lists from the same stub.

## What I had to decide

kit/lib/next/gate.test.ts (PRD 1299's approval gate of omni next) stubbed gh to answer `[]`; once next reads LoopReads, its fetch, which answers the approval body to every URL, reached the loop's reads too and the answer fell outside the contract (exit 1). Built: it passes `reads: fakeLoopReads()` to main(), and its two header comments say so. No assertion changed.

## What I did meanwhile

The three gate tests pass; the full suite is green.

## What it costs to change later

Two lines in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether other tests outside the kit's command tests reach omni next or omni care through main() with a gh stub was checked only by the full suite, which is green.
