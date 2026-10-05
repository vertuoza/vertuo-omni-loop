---
id: s3-03-mutation-floors-red-on-ci
prd: 1072
slice: s3
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The first run on GitHub's machines scored two parts of the code just under the bars set from the laptop run. Should the bars stay where they are, so the nightly stays red until the tests improve?

## The decision, in plain words

The bars stay. On the busy laptop some changes made the tests too slow and counted as caught; on GitHub's quieter machines the same changes ran to the end and slipped through, so the laptop bars were a little generous.

## The intro, for fun

The laptop was so busy that some bugs got caught just for being slow.

## The punchline, for fun

On a calmer machine they strolled right past, and the scoreboard noticed.

## The options, in plain words

A. Keep the floors, the nightly red for env and outbox until tests are added there, the option built.
B. Measure the floors again from CI's run, rounded down (env 82, outbox 74), a one-time correction a person approves.
C. Add tests to env and outbox now until both hold their laptop floors, a slice of its own.

## What I had to decide

What to do when the proving run's scores fall below s1's floors for two modules: env 82.89 against 88, outbox 74.33 against 75. Every other module holds its floor.

## What I did meanwhile

Left `mutation/floor.json` unchanged (it is s2's territory, and the briefing says never to lower a floor to turn a check green). The proving run's `score` job is red for env and outbox only; the workflow itself ran end to end. The gap is timeouts: env had 20 timed-out mutants on the laptop and 0 on CI (24 survived instead of 15), outbox 152 against 60.

## What it costs to change later

Two numbers in `mutation/floor.json`. Until one of the options lands, every night is red for env and outbox, which hides a real fall in another module behind a known red.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether CI's scores are steady from night to night: one run does not show it
- (author) whether the floors are meant to be measured where the nightly runs, which the spec does not say
