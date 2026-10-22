---
id: s3-04-stranded-app-jobs-are-recognized-before-the-cleanup
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a runner finds a job from an earlier run that never ended cleanly, how does it know the job ran as the GitHub App, given that its own cleanup deletes old files?

## The decision, in plain words

It looks for the job's private token file before the cleanup deletes old files, so a job that ran as the App is released as the App, or not at all, and never as the machine.

## The intro, for fun

The runner checks the guest list before it sweeps the floor.

## The punchline, for fun

Otherwise it would forget who the guest was and let a stranger lock up.

## The options, in plain words

A. A. Read whether the job ran as the App from its token file before the cleanup runs.
B. B. Keep the token files of stranded jobs out of the cleanup, so they can be read afterwards.
C. C. Write a line into the job's log when it starts as the App, and read that line later.

## What I had to decide

Whoever owns the runner. The order is fixed in the sweeper of runner.ts: ranAsApp is read for every stranded job before sweep runs. Another way to remember that a job ran as the App (for example a line in the job's log) is a change in ranAsApp alone.

## What I did meanwhile

The sweeper lists the stranded jobs and marks each with whether it ran as the App, by looking for its token file, then runs the cleanup, then releases each job as the App with whatever token is left, or as nothing. The token file of a released job is forgotten after its release.

## What it costs to change later

Small. Recording the mark somewhere else is a change in one function and its tests; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A job whose token file vanished by other means, such as a person deleting it, cannot be recognized as an App job and would be released with the machine's own login; the PRD does not say how to tell.
- (author) Whether the claim's own record, rather than the token file, should say that a job ran as the App is not settled.
