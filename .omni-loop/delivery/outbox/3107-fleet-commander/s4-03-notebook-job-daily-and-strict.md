---
id: s4-03-notebook-job-daily-and-strict
prd: 3107
slice: s4
rank: medium
bears-on: none
raised: 2026-11-20
wave: 4
---

## The question, in plain words

How often should the notebook job write, which model should it use, and how strict should it be about lines that sound like orders?

## The decision, in plain words

It runs once a day, writing each running mission's lines for the day before and the fleet lines of a mission that ended in the last three days, with the same model as the Commander. Any line with words like should or must, or speaking to someone, is dropped, even when it might have been a useful lesson.

## The intro, for fun

The fleet keeps a diary, but only writes in it after the day is done.

## The punchline, for fun

And it writes like a witness, never like a boss.

## The options, in plain words

A. Daily, the previous day's lines, fleet lines within 3 days, strict screen, tokens not counted, as built.
B. Hourly, so fleet lines arrive within the hour of a mission's end.
C. As built, and count the notebook's model calls against the fleet's daily tokens.

## What I had to decide

Daily schedule at midnight UTC for the previous UTC day; fleet lines for missions delivered or stopped in the last 3 days; at most 5 lines a batch and 6 batches a run, then it carries on a minute later; model anthropic/claude-sonnet-5.5 through the App's OPENROUTER_API_KEY; a fleet over its daily tokens is skipped, but the notebook's own model calls are not counted against those tokens; the instruction screen drops any line with an obligation word, an imperative first word, a second person, or saying all is well.

## What I did meanwhile

Every rule is a constant in apps/omni-app/src/missions/notebook.ts or notebook-run.ts.

## What it costs to change later

Low: each is a constant or a schedule line; counting the notebook's tokens would need a column.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says at most once a day per running mission and when a mission is delivered or stopped, without a time of day or a delay
- (author) The spec does not say whether the notebook's model calls spend the fleet's daily tokens
