---
id: s2-04-rule-proof-tests-extended
prd: 3001
slice: s2
rank: high
bears-on: BR-PRODUCT-140
raised: 2026-11-17
wave: 1
---

## The question, in plain words

Three tests that prove existing product rules were extended so the new QA check is covered. Do these additions keep each rule meaning what it meant?

## The decision, in plain words

Each test gained cases for the new QA check and lost none: the rules read as before, now with QA among the loop's own checks.

## The intro, for fun

Three old guards were handed a new name to watch for.

## The punchline, for fun

None of them was asked to look away from anything.

## The options, in plain words

A. Keep the added cases: each rule now covers qa as one of the loop's own skills.
B. Move the qa cases into new test files, leaving the rule-proof files untouched.

## What I had to decide

Three files that enforce product rules changed, each by addition only. kit/lib/runner/line.test.ts (N-PRODUCT-19, a runner job for one of the loop's own skills never loads the repository's tool servers, and the runner refuses any other line) gains a case: /omni:qa 3001 and /omni:qa 3001 --round 2 run, and a repository's own /qa is refused as the loop's own skill. apps/galaxy/src/runners/runners.skills.migration.test.ts (BR-PRODUCT-140, a repository's Runner skills block never lists a folder named like one of the loop's own skills) adds qa to the skills that joined the fixed list after its migration, as repair was added. apps/galaxy/src/runners/runners.service.test.ts (BR-ACCESS-7, a runner's fresh-token refusals) gains two cases on a job's tokens and changes none of BR-ACCESS-7's. No case was removed or loosened. High by rule, not judgement: the plan asks a high item of any slice that changes a rule-proof test, and check coverage accounts a law-proof change only with a high item, so a person answers it. Jev was asked first and said not hard to revert (0.60).

## What I did meanwhile

The three files stand with their added cases; every earlier case is unchanged.

## What it costs to change later

Reverting a few test lines; no data and no behaviour depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the rules' owners want qa named in the rules' own text too (author)
