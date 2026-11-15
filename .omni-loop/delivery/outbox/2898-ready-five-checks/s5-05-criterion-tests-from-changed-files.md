---
id: s5-05-criterion-tests-from-changed-files
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

A success criterion is proven by a test that carries its number, but every feature numbers its criteria from one again, so an old feature's test could pass for this one's. Which tests count as proof?

## The decision, in plain words

Only tests in the test files this feature's pull request added or changed. A test written for an older feature never counts, even with the same number.

## The intro, for fun

Every class has a pupil number one.

## The punchline, for fun

Only this class's number one answers the roll call.

## The options, in plain words

A. Count only the numbered tests in files the pull request changed: what was built.
B. Count a numbered test only when its group of tests also names the feature, as the screen tests do with their tag.

## What I had to decide

The spec says a `test` criterion is proven by a vitest test titled `AC-n: …` that passed on the latest commit; it tags only the `e2e` tests with `prd-<n>`. Every PRD numbers its criteria from AC-1, and the whole suite runs on every graded commit, so a title alone matches other PRDs' tests.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

`scripts/acceptance-report.ts` takes an `AC-<n>: …` test from the shards' JSON reports only when its file is in `git diff --name-only <base>...<head>`, and only for numbers the spec holds; an `e2e` result only when tagged `prd-<n>`.

## What it costs to change later

One filter in `testResults` of `scripts/acceptance-report.ts`; a tag rule instead also needs `/omni:brainstorm` and the testing form to say how a test names its PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a criterion may be proven by a test an earlier pull request wrote, which this rule never counts
