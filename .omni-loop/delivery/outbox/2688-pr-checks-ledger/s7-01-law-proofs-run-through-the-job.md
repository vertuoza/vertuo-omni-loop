---
id: s7-01-law-proofs-run-through-the-job
prd: 2688
slice: s7
rank: high
bears-on: BR-PRODUCT-6
raised: 2026-11-10
wave: 3
---

## The question, in plain words

Two locked rules of the gate were proven by tests that started the old outbox check on the outside background service, which is now gone. Do the rules' owners accept that the same tests now start the check through its new job?

## The decision, in plain words

The two proofs keep every case and every expected result, and only how the check is started changed. Both still pass.

## The intro, for fun

The gate's two proofs moved house; every piece of furniture came along.

## The punchline, for fun

Same rooms, same locks, only the front door is new.

## The options, in plain words

A. A. As built: the two proofs run the new job, with the same cases and the same expected results.
B. B. Keep the proofs on a test-only copy of the old background function.

## What I had to decide

A CODEOWNER (@pierrederval or @dervalp) approves the feature pull request on GitHub, as the locked rules ask (BR-PRODUCT-6 and N-PRODUCT-4, proven in apps/omni-app/src/outbox-check/outbox-check.test.ts). Answer A to keep the proofs as moved, B to have them rewritten.
Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

The proofs run through the job, and the feature pull request stays red on the two rules until a CODEOWNER approves it.

## What it costs to change later

B means keeping a test-only copy of a background function the App no longer serves, only to drive two tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan names this change and its two rules (s7, law lines); the job's own tests prove both rules a second time.
