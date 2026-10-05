---
id: s2-01-mutation-changed-summary
prd: 1072
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The last line of a mutation run on changed code says how many changes were caught and how many slipped through. Do changes that made the tests hang, or that no test ran at all, belong in those numbers?

## The decision, in plain words

A change that made the tests hang counts as caught, and one no test ran counts as slipped through, the same way the module score counts them, so the line and the score always agree.

## The intro, for fun

Some changes get caught red-handed, some make the tests freeze, and some nobody even looks at.

## The punchline, for fun

The summary line sorts them into two piles, the same two the score uses.

## The options, in plain words

A. A. Two numbers, timeouts in killed and no coverage in survived, as the score counts them, the option built.
B. B. Four numbers: killed, timed out, survived, no coverage.
C. C. Killed and survived as Stryker names them, timeouts and no coverage left out of the line.

## What I had to decide

Whether the summary's two numbers should split out timeouts and uncovered mutants instead of folding them in.

## What I did meanwhile

`pnpm mutation:changed` ends with `mutation: <k> killed, <s> survived in <files>`, where k is killed plus timed out, s is survived plus no coverage, and the files are the mutated files, comma-separated. Mutants that do not compile are left out. Before that line it lists each survivor and uncovered mutant with its file, line, mutator and replacement.

## What it costs to change later

One function, `changedSummary` in `scripts/mutation-changed-plan.ts`, and its test; bug records written before a change keep the old shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the bug-fix skill parses the two numbers or only records the line
