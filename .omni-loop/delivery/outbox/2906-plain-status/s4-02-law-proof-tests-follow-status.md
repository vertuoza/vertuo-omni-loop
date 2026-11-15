---
id: s4-02-law-proof-tests-follow-status
prd: 2906
slice: s4
rank: high
bears-on: BR-PRODUCT-5
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Three tests that prove the rules on approvals and merging were changed so they test the new plain status. Do you accept these changes?

## The decision, in plain words

The tests now check the new status skill, keeping the check that it never runs the question gate and adding one that it changes no pull request, label or approval. One older check is a little looser, so an extra field in the status output is allowed.

## The intro, for fun

The guards of the gate had to learn a new uniform.

## The punchline, for fun

Same guards, same gate, new name on the badge.

## The options, in plain words

A. Accept the tests as they are: Keep the rewritten skill tests, the kept gate guard and the looser status line check.
B. Tighten the status line test: Keep the skill tests, and compare the whole JSON again, status key included.
C. Restore the old tests: Put the old status skill tests back on the dashboard skill, and write the new ones beside them.

## What I had to decide

The old status skill's tests described the repository overview, which moved to the dashboard skill. They were rewritten for the new skill, keeping the gate guard and adding a no-change guard. In the status line test, one exact comparison became a partial one because the JSON gained a status key. The now test only gained new tests.

## What I did meanwhile

The feature pull request is back to draft. Every check passes except the outbox check, which waits for this answer and for an approving review from a code owner of the changed test files.

## What it costs to change later

Cheap: the tests are plain files. A stricter version means comparing the whole JSON again with the new status key included.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the code owners want the status line test to compare the whole JSON again, including the new status key (author).
