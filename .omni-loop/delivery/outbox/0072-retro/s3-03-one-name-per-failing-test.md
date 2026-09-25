---
id: s3-03-one-name-per-failing-test
prd: 72
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The four test tools each name a failing test in their own way, and one test must carry the same name from run to run to be counted twice. How should the names be made alike?

## The decision, in plain words

A test is named by its file, its groups and its title, joined the same way whatever tool ran it, without the line numbers one tool adds. Only tests that finally failed count, not a test that failed and then passed on a retry within the same run.

## The intro, for fun

Four tools, four accents, and one test that has to be recognised in all of them.

## The punchline, for fun

The retro taught them one spelling, and the line numbers were left in the cloakroom.

## The options, in plain words

A. One naming for all four tools, line numbers left out, only final failures counted, the option built.
B. The same naming, also counting a test that failed and then passed on a retry within one run.
C. Each tool's own naming as printed, line numbers included, so one test may carry several names.

## What I had to decide

How `readTestLog` in `apps/omni-app/src/retro/kinds/ci-logs.mjs` names a test. A `failing-test:<test>` finding counts one name across red runs, and its id, hence its retro issue found again by its marker, is built from that name. The spec says only "test names parsed from failed-job log tails for Vitest, Jest, Playwright and pytest".

## What I did meanwhile

The separators ` › ` and ` > ` both become ` > `, and whitespace is collapsed. Vitest: its `FAIL  <file> > <suite> > <test>` lines (a file that failed to load, by its file alone), or the `×` lines under their `❯ <file>` when the tail was cut before them. Jest: each `● <suite> › <test>` under its `FAIL <file>`, a "Test suite failed to run" named by its file, `● Console` and warnings skipped. Playwright: the tests its summary lists under "N failed", the project kept (`[chromium]`), `:line:col` and `(retry #n)` dropped, the flaky ones not counted. pytest: the `FAILED <node id>` lines of the short summary, `ERROR` lines not counted. Counts come from each tool's summary line; a log no reader recognises gives no name and no count. Fixtures for all four and an unknown format are in `kinds/ci.fixtures/`.

## What it costs to change later

One pure module and its tests. Once retros have opened issues, a different naming changes the `failing-test` ids: a finding then gets a second issue, and the first stays open until someone closes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a test that failed and then passed on a retry inside one run (Playwright's flaky) should count toward a failing test; here it does not.
- (author) Whether pytest's errors in setup or collection should count as failing tests; here they do not.
