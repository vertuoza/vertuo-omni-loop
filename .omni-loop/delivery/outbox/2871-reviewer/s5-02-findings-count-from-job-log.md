---
id: s5-02-findings-count-from-job-log
prd: 2871
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Each verdict on the Operation room says how many findings the Reviewer raised and links its review, but the mission's database keeps neither. Where should the mission read them from?

## The decision, in plain words

The mission reads the one line the Reviewer prints when it posts its review, from the end of that job's log, and keeps only the count and the link. When that line is missing, the row says changes were asked without a count and links the pull request.

## The intro, for fun

The Reviewer wrote its score on the back of a receipt.

## The punchline, for fun

The mission copies the number and the link, and throws the receipt away.

## The options, in plain words

A. A. Read the count and the review's link from the Reviewer job's posted line, nothing else of the log (built).
B. B. The runner stores the count and the review's link on the job, and the mission reads those.
C. C. Leave the count out of the sentence, and link the pull request only.

## What I had to decide

Keep reading the posted line from the job's log (A), or have the runner store the count and the review's link on the job itself (B).

## What I did meanwhile

The store reads the log tail of each Reviewer job that ended on a verdict, and `postedOf` keeps the count of findings and a GitHub review link from the last `omni review post` line; nothing else of the log is kept or written to an event. Without the line, the sentence reads `Changes asked, round 1/2.` and the link is the job's PR.

## What it costs to change later

Moving to a stored count is a column on runner jobs, a runner change and a two-line change in the store; nothing stored depends on the log reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives the sentences with a count, but no slice stores the count where the mission reads.
- (author) Whether the posted line stays in the last 200 lines of the log when the Reviewer then follows its pull request's checks after a pass; a pass's sentence carries no count, so only its link would be lost.
