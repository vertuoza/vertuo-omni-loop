---
id: s1-01-limit-wait-extends-cancel-proof
prd: 2949
slice: s1
rank: high
bears-on: BR-PRODUCT-134
raised: 2026-11-16
wave: 1
---

## The question, in plain words

The check that proves a cancelled job is never picked up again now also covers jobs that wait out a provider limit. Does that wider check still prove the same rule?

## The decision, in plain words

We added the waiting jobs to the same check: a job whose cancel was asked before it hit the limit queues nothing, and a waiting copy that someone cancels is never picked up by any machine. The earlier cases are kept as they were.

## The intro, for fun

A rule's proof grew a new chapter while nobody was watching.

## The punchline, for fun

Same promise, longer receipt: a cancel still means stop.

## The options, in plain words

A. A. Keep the limit cases in the same proof files: they prove the same rule for one more ending
B. B. Move the limit cases into a check of their own, leaving the rule's proof as it was
C. C. Keep them, and amend the rule's words to name a limit's wait

## What I had to decide

Confirm that supabase/checks/runner_resume.sql and apps/galaxy/src/runners/runners.resume.migration.test.ts still prove BR-PRODUCT-134 once they also cover a limit's wait (PRD 2949 s1), or say which case the rule should name.

## What I did meanwhile

The extended check runs in the supabase workflow; the rule's text is unchanged.

## What it costs to change later

Low: answering B only moves the limit cases into a check of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether BR-PRODUCT-134 should say in words that it covers a limit's wait too, not only a lost runner (author)
