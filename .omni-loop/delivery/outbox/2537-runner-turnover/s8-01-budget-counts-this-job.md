---
id: s8-01-budget-counts-this-job
prd: 2537
slice: s8
rank: medium
bears-on: none
raised: 2026-10-28
wave: 4
---

## The question, in plain words

An account can be given a daily budget of tokens. Which tokens count against it, and when does a new day start?

## The decision, in plain words

Only the tokens the account spent on the current job count, the fresh ones read and written, not the ones reread from its cache. Once they reach the budget the job moves to the next account, and this one rests until midnight, world time.

## The intro, for fun

A budget is a promise you make to your wallet before breakfast.

## The punchline, for fun

For now the wallet only checks the job in front of it.

## The options, in plain words

A. Count this job's input and output tokens on the account, out until midnight UTC, the option built.
B. Keep a count per account per day across every job, beside the account states, so two jobs in a day share one budget.
C. Count every token, cache reads included.

## What I had to decide

What the daily budget of an account in accounts.yml counts: this job's input and output tokens on that account (cache reads aside), against the budget, the account then out until the next midnight UTC; or a count kept across every job of the day.

## What I did meanwhile

kit/lib/runner/job.ts sums the input and output tokens of the job's parts on that account plus the running part, read through the agent's usage; plannedHandoff in kit/lib/runner/turnover.ts hands off on usage once the sum reaches the budget, out until the next 00:00 UTC. Nothing is kept across jobs.

## What it costs to change later

A count across jobs is a small file beside accounts-state.json and one more read before each check; the rule of which tokens count is one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says tokens a day but not which of the four counts, nor whose day: no register, glossary or playbook entry settles it
- through T3 an OpenCode instance gives no tokens yet (s4 reads only Claude transcripts), so its budget cannot trip until its session store is read
