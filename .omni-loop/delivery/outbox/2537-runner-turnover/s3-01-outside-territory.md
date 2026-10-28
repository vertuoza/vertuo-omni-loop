---
id: s3-01-outside-territory
prd: 2537
slice: s3
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

For a job's parts to reach the Runners page, the runner itself had to read them and send them, which lives in files the plan gave to other slices. Should this slice have touched them?

## The decision, in plain words

We made the four small changes the turnover cannot work without, outside the slice's own files: the runner sends the parts and masks every account's secret, the job command hands the job its accounts, the record of which accounts are out is read again at each look so both programs see it, and the weekly clean-up also removes the parts file and the handoff note with the job's log.

## The intro, for fun

The plan drew a fence, and the parts had to climb over it to reach the page.

## The punchline, for fun

We climbed four times, small steps, and wrote each one down.

## The options, in plain words

A. A. Keep the four changes as built, each with its test.
B. B. Move the runner's reporting and the job command's wiring to s6, leaving s3's turnover running on the machine with nothing sent until s6 merges.
C. C. Keep the reporting but drop the sweep and book changes, and open a bug for each.

## What I had to decide

Whether the four changes outside the territory stand: kit/lib/runner/runner.ts (parts in every report, refused once means sent again without and never after, turnover's reason on a failed job, every account's secret masked), kit/bin/commands/runner.ts (omni runner job --account passes the file's accounts as its turnover), kit/lib/runner/accounts.ts (the account book reads accounts-state.json at every look and before every mark, so the runner sees an account the job's process marked out and neither drops the other's mark) and kit/lib/runner/sweep.ts (a job file with two extensions, job-<id>.parts.json and job-<id>.handoff.md, is swept with the log, as L-GDPR-4 asks of the note).

## What I did meanwhile

Built all four with tests beside each (runner.test.ts, kit/bin/commands/runner.test.ts, accounts.test.ts, sweep.test.ts). No sibling of wave 3 owns runner.ts, accounts.ts or sweep.ts; s4 also edits kit/bin/commands/runner.ts, in another function (t3-signin), so the merge should be clean.

## What it costs to change later

Each change is a few lines and a test: undoing one is a revert of that hunk. Undoing the runner's part would leave the parts on the machine only; undoing the book's reread would let the runner start a job on an account a job just marked out, which then turns over at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- s6 (wave 4) owns runner.ts next and builds the pause on the same book: it may prefer to read the accounts' states another way. (author)
- Whether the plan should have listed runner.ts and the job command in s3's territory, or a later slice should carry the reporting. (author)
