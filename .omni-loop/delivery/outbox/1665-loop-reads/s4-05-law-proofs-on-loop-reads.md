---
id: s4-05-law-proofs-on-loop-reads
prd: 1665
slice: s4
rank: high
bears-on: BR-PRODUCT-72
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The tests that prove three of the loop's rules now feed them the Omni page's answers instead of GitHub's, and one rule now finds a bug's record only in the plan's own repository. Do these tests still prove the rules as you meant them?

## The decision, in plain words

I kept every check of those tests and only changed where their facts come from. The bug rule still takes its record from the changes that close the bug, but now only those of the plan's own repository, because the page names them by number alone.

## The intro, for fun

Same exam, same answers, new paper.

## The punchline, for fun

One question now only accepts answers from the home team.

## The options, in plain words

A. A. The proofs as moved, the record read from the plan repository only (built).
B. B. The proofs as moved, and the closing changes' repository added to the page's answer first, so a record in a target is listed again.
C. C. Keep the bug list on GitHub's own tool until the page carries the repository.

## What I had to decide

kit/bin/care.test.ts proves BR-PRODUCT-72 and kit/bin/next.test.ts proves BR-PRODUCT-87 and BR-PRODUCT-88; check coverage reads any change to a law's proof as needing a person. Both files now build the shared fake LoopReads from the same data their gh fixtures held; every assertion of the law tests is unchanged except that a failed check's link is now null. BR-PRODUCT-72's behaviour narrowed: care list's bug records come from LoopIssueDetail.closedBy (settled item s2-02: closing changes of the issue's own repository, by number), so a record PR opened in a target repository is no longer listed; the gh read took each record's repository from its link.

## What I did meanwhile

Ran both files green on the fake; the law test BR-PRODUCT-72 lists acme/plan#51 as the record, as before.

## What it costs to change later

For the narrowing: the repository added to closedBy in the contract (s2-02's option C) and one line in care.ts. For the proofs: none.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a bug's record PR is ever opened outside the plan repository was not checked against /omni:mega-bug-fix's practice; its skill says the record PR is in the plan repository.
