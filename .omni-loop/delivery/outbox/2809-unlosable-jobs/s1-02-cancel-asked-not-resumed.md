---
id: s1-02-cancel-asked-not-resumed
prd: 2809
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When someone asks to stop a running job and its machine dies before the job stops, should the job start again on another machine?

## The decision, in plain words

It does not start again: a job someone asked to stop is never resumed, even when its machine is lost before it stopped.

## The intro, for fun

Someone pressed stop, then the machine fell asleep mid-sentence.

## The punchline, for fun

Waking it up somewhere else would ignore the one wish we had in writing.

## The options, in plain words

A. A. A job whose cancel was asked is never resumed, even when its runner is lost first.
B. B. A lost job is resumed whatever was asked; a person cancels the resume if they still want it stopped.

## What I had to decide

The spec lists a cancelled job among those never resumed, and a loss among those always resumed; it does not say which wins for a running job whose cancel was asked (cancel_requested set, its runner not yet stopped) and whose runner is then lost. The trigger reads `new.cancel_requested` and queues nothing then, so a person's cancel is never undone by a resume.

## What I did meanwhile

runner_job_resume_lost() returns before queuing when `cancel_requested` is true; supabase/checks/runner_resume.sql proves it (Q1, cancel asked, then lost with its runner: no resume).

## What it costs to change later

One condition in the trigger's function, changed by a follow-up migration; no row to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person ever asks to cancel a job hoping it restarts elsewhere is not known. (author)
