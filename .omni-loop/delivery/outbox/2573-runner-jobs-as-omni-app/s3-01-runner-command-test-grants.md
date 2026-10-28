---
id: s3-01-runner-command-test-grants
prd: 2573
slice: s3
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

The runner command's own tests also start jobs with no GitHub App, which the runner now refuses. Should this slice have fixed them, though they sit outside its listed files?

## The decision, in plain words

I gave the fake server in the runner command's tests an App grant for every job, and rewrote the two tests that expected a job with no App to run, so they now expect it to fail.

## The intro, for fun

A new bouncer at the door meant the old guest list had to change.

## The punchline, for fun

Every fake job now arrives with a badge, except the one meant to be turned away.

## The options, in plain words

A. A. Fix the command's tests in this slice (built).
B. B. Leave them red and widen the plan's territory in a follow-up slice.

## What I had to decide

The command's test file is outside the slice's territory, but the slice's change turns 32 of its tests red, so leaving it would fail the preflight. I changed only its fake server and the tests that assumed a job with no App runs.

## What I did meanwhile

Nothing changes for users; only tests are touched.

## What it costs to change later

A later slice that owns that file would merge on top of this edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant that file to be in this slice's territory (author)
