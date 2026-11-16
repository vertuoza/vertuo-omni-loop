---
id: s3-01-claim-extends-keeper-proof
prd: 2949
slice: s3
rank: high
bears-on: BR-PRODUCT-135
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The proofs that a resumed job waits for the machine holding its saved work now also cover long chains of waits, and the new order that hands recovery out first. Do the wider proofs still prove the same rule?

## The decision, in plain words

We extended the same proofs: the saved work is now looked for along the whole history of the job, not only its two latest tries, and the queue hands out every resumed job before any new one. The earlier cases are kept as they were.

## The intro, for fun

The rule about waiting for the right machine just learned to count past two.

## The punchline, for fun

Same promise, longer memory: the saved work still goes home first.

## The options, in plain words

A. A. Keep the new cases in the same proof files: they prove the same rule over longer chains
B. B. Move the new cases into a check and a test of their own, leaving the rule's proof as it was
C. C. Keep them, and amend the rule's words to name the whole chain and the recovery-first order

## What I had to decide

Confirm that supabase/checks/runner_resume.sql, apps/galaxy/src/runners/runners.claim-resume.migration.test.ts and apps/galaxy/src/runners/runners.resume-claim.test.ts still prove BR-PRODUCT-135 once they also cover a whole chain of waits and the recovery-first order (PRD 2949 s3), or say what the rule should name.

## What I did meanwhile

The extended check and tests pass; the rule's text is unchanged. Each new case was seen failing against the previous claim before the new one made it pass.

## What it costs to change later

Low: answering B only moves the new cases into a check and a test of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether BR-PRODUCT-135 should say in words that it reads the job's whole history, now that waits make it longer than three tries (author)
