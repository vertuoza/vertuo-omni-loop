---
id: s5-02-room-reads-qa-from-what-exists
prd: 3001
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

The room must say which pull request QA checks, whether it waits for the preview, and what a job spent, and the plan does not say where these come from. Are the choices made here right?

## The decision, in plain words

A job's tokens are its four counts added, shown as 41k tokens or tokens unknown. The pull request QA checks comes from the newest link of that PRD's events and the preview wait from the last log line of the running QA job.

## The intro, for fun

The room had to guess what QA was staring at.

## The punchline, for fun

It looked at the log and the old links, and guessed kindly.

## The options, in plain words

A. A. Keep these sources and the sum of all four counts.
B. B. Count input and output only.
C. C. Have QA's job record its PR and preview wait as parts, and read those.

## What I had to decide

Add the four counts as the Ask page does, read the PR from existing links, and read the preview wait from the log's last line, so no new column or event is needed.

## What I did meanwhile

The room shows these lines from data that already exists.

## What it costs to change later

Changing a word or a source is a small edit in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the spec means cache reads in a job's token total
- (author) whether QA should record the PR it checks so round 1 never falls back to the PRD number
