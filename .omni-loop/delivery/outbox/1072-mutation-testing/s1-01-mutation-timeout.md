---
id: s1-01-mutation-timeout
prd: 1072
slice: s1
rank: medium
bears-on: none
raised: 2026-10-04
wave: 1
---

## The question, in plain words

How long may a changed copy of the code run its tests before we call it stuck and count it as caught?

## The decision, in plain words

Ten seconds beyond the time its tests normally take. A stuck copy counts as caught, so a longer wait makes the run slower but the score a little more honest.

## The intro, for fun

Some changes to the code do not fail the tests, they just make them wait forever.

## The punchline, for fun

We gave them ten polite seconds before calling it a win.

## The options, in plain words

A. Ten seconds beyond the tests' measured time, the option built.
B. Stryker's default, five seconds, for a quicker run with more risk of counting a slow healthy run as caught.
C. Sixty seconds, for the most honest timeouts at the price of a much longer run.

## What I had to decide

How long a mutant may run beyond its tests' measured time before Stryker counts it as timed out, which counts as detected in the score.

## What I did meanwhile

timeoutMS is 10 000 in stryker.config.mjs: one constant, no migration.

## What it costs to change later

One constant. A higher value makes each run longer (the first try with 60 s spent most of the ids.ts proof waiting on 23 timed-out mutants); a lower one can count a slow but healthy run as caught.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether 10 s is enough on CI's runner, where the tests' time varies differently than on a laptop; the nightly in s3 will show it
