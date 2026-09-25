---
id: s8-01-day-14-run-only-where-served
prd: 72
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The retro now waits fourteen days and then looks again. Should every copy of the retro built for a test wait too, or only the one the app really runs?

## The decision, in plain words

Only the retro the app runs waits and looks again after fourteen days. A copy built for another part's test stops after its first look, so those tests stay exactly as they were.

## The intro, for fun

Some tests would rather not wait two weeks for their answer.

## The punchline, for fun

So only the real retro keeps the appointment; the rehearsals go home early.

## The options, in plain words

A. Only the retro the app runs waits fourteen days; copies built for other tests stop after the first look, the option built.
B. Every copy waits; each test that runs the whole retro lets the wait pass at once and expects the second look, and the saved example retro gains its after-merge section.

## What I had to decide

Adding `step.sleepUntil` to the function makes every `@inngest/test` run that does not mock the sleep step hang. `createRetro` is run whole by tests outside s8's territory: `kinds/ci.test.mjs` (s3), `kinds/churn.test.mjs` (s4), `narrate.test.mjs` (s6), `issues.test.mjs` (s7) and `test/prd-50.test.mjs` (s2). With the day-14 run on in all of them, narrate's call count and the PRD 50 golden `retro.md` would change too.

## What I did meanwhile

`createRetro` takes `followUp` (default `false`); the served `retro` passes `followUp: true`, and `retro.test.mjs` pins that the served function sleeps until the merge plus fourteen days (its GitHub stubbed through `installationOctokit`). No file outside the territory changed.

## What it costs to change later

A constant: flip the default to `true`, then mock the `sleep-day-14` step in the five tests above and update narrate's call count and the PRD 50 golden file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reviewer prefers one default for every caller over a switch that only tests leave off.
