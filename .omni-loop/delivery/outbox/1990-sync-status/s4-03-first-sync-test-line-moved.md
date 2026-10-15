---
id: s4-03-first-sync-test-line-moved
prd: 1990
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

One check written for the first part of this work said the fix option was refused as unknown; now that it exists, is it fine that this part changed that one check, outside its own files?

## The decision, in plain words

The check now asks that the fix option be refused when combined with another output option, so it still proves a wrong mix of options is refused. Nothing else in that file changed.

## The intro, for fun

A test kept insisting the new door was a wall.

## The punchline, for fun

It now checks that you cannot walk through two doors at once.

## The options, in plain words

A. A. Keep the one-line change: --fix combined with --json is the usage error now checked.
B. B. Drop the line from the first part's test, and leave that refusal to this part's own tests.

## What I had to decide

Whether s4 may change one line of kit/bin/sync.test.ts (s1's file, in no wave-2 territory): the assertion that 'omni sync --fix' exits 2 now passes '--fix --json'.

## What I did meanwhile

kit/bin/sync.test.ts 'refuses two output flags at once, and an argument' asserts sync(root, ['--fix', '--json']) exits 2; kit/bin/sync-fix.test.ts also proves --fix refused with --json and --quiet.

## What it costs to change later

One line; reverting it alone would make the test fail against --fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not list kit/bin/sync.test.ts in s4's territory although its last assertion pinned --fix as unknown (author).
