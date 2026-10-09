---
id: s2-02-comment-test-names-a-high-item
prd: 1342
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

One older test outside this slice's area expected a note in the plan to cover a change to a law, which the new rule no longer allows. Should that test change here?

## The decision, in plain words

Yes. The test now covers the change with a question ranked high, which is exactly what the new rule asks, and it checks the same thing it always did: a covered change is not reported.

## The intro, for fun

An old test still believed a note in the plan was enough to touch a law.

## The punchline, for fun

It has been gently told the rules changed, and it took the news well.

## The options, in plain words

A. A. Update the one test here, so the feature branch stays green
B. B. Revert it and leave the fix to another slice, the branch red meanwhile

## What I had to decide

`kit/lib/outbox/comment.test.ts` ('excludes a risky change an account names') accounted a `law-text` change with `spec <where>`, which the spec now refuses. The file is outside s2's territory. Edit it here, or leave it red for another slice?

## What I did meanwhile

Changed that one test to seed an item ranked `high` (`writeItem`) and account the change with `item s5-01-adr`. Its assertion is unchanged; no other line of the file moved.

## What it costs to change later

One test fixture; reverting it is a two-line edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The wave's territory check may flag `kit/lib/outbox/comment.test.ts` as outside s2's territory.
