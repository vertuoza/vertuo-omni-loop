---
id: s3-02-claim-all-out-edges
prd: 2949
slice: s3
rank: medium
bears-on: none
raised: 2026-11-16
wave: 2
---

## The question, in plain words

Which machines count as having every account out, so the queue hands them nothing? The spec names a fresh report with every account out until a time still to come, but not the odd reports.

## The decision, in plain words

A machine is skipped only when its report is under two minutes old, lists at least one account, and every account is out until a time still to come. A report with no account listed, an account out with no reset time, or a reset time that does not read as a time leaves the machine judged by its own pause, as before, so it still gets work.

## The intro, for fun

A machine says every account is out, then mumbles about when they come back.

## The punchline, for fun

When in doubt, the machine keeps its job and decides for itself.

## The options, in plain words

A. A. Skip a machine only on a clear, fresh report of every account out until a time to come
B. B. Also skip it when an account is out with no reset time
C. C. Also skip it when its report lists no account at all

## What I had to decide

Confirm that only a clear, fresh report of every account out until a time to come holds work back from a machine, or name another odd report that should hold it back too.

## What I did meanwhile

The claim skips only the clear case; supabase/checks/runner_resume.sql proves each odd report still gets a job and raises no error.

## What it costs to change later

Low: one condition in the claim and a line of the check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an account out with no reset time should hold work back too (author)
