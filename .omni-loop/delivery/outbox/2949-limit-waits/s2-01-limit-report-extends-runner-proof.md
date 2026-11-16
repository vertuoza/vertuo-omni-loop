---
id: s2-01-limit-report-extends-runner-proof
prd: 2949
slice: s2
rank: high
bears-on: N-PRODUCT-19
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The test files that prove how a runner ends and reports a job now also hold the tests for how a job that ran out of every provider account reports its limit. Do they still prove the same rule?

## The decision, in plain words

We added the limit tests beside the others, in the same files, as their own cases; no existing test changed except that some failed-report cases now also say a limit is absent where none is due.

## The intro, for fun

A runner that knows when it will be allowed back.

## The punchline, for fun

The old tests still guard the door; the new ones read the clock.

## The options, in plain words

A. Keep the limit tests in the same files, as their own cases: the rule's proof is untouched
B. Move the limit tests to a file of their own

## What I had to decide

Confirm that kit/lib/runner/runner.test.ts and kit/lib/runner/turnover.test.ts still prove their rules with the new limit cases, or ask for the cases to move to a file of their own.

## What I did meanwhile

The new cases run with the files' other tests; the existing cases I touched only gained an assertion.

## What it costs to change later

Low: answering B moves a few test cases to a new file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The PRD, the registers and the glossary do not settle whether these files should list the limit cases among what proves the rule.
