---
id: s1-01-timings-baseline-owed
prd: 657
slice: s1
rank: high
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The speed of the PRD list and the dashboards today has not been measured yet, because measuring needs someone signed in. Who takes that measurement, and when?

## The decision, in plain words

The measuring tool is built and the table waits with an empty before column. A person signed in to the site runs it once on the live site before this work goes live, and pastes the result into the table.

## The intro, for fun

A stopwatch is ready, the runners are ready, but nobody holds the key to the stadium.

## The punchline, for fun

Once this work ships, today's slow times are gone for good, so the before photo has to be taken first.

## The options, in plain words

A. A person signed in to the live site runs the timing tool once with their own session before the feature merges, and pastes its table into the timings page under Before.
B. Skip the before column: merge without a baseline and judge the speed target on the after numbers alone.

## What I had to decide

Whether a person runs the timing tool with their own session on the live site before the feature pull request merges, and pastes its table into timings.md under Before.

## What I did meanwhile

timings.md reads 'owed: run before merge' in every Before cell. The script, apps/galaxy/scripts/timings.mjs, is built and tested; run without a cookie it prints how to copy one from the browser, and it stops rather than time a signed-out page.

## What it costs to change later

Once the feature merges and deploys, the before numbers can no longer be measured on production, so acceptance criterion 11 would compare against nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No signed-in session cookie was available to the agent, and none should be: a session cookie signs in as a person. (author)
