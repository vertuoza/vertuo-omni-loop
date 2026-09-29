---
id: s3-01-fallow-audit-base-in-ci
prd: 598
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The code-quality check on a pull request needs something to compare against. Should it compare against the branch the pull request goes into?

## The decision, in plain words

The check compares each pull request against the branch it targets, so it only judges what the pull request itself changes, and the job downloads the full history so that comparison is possible.

## The intro, for fun

Every judge needs a before picture to spot what changed.

## The punchline, for fun

We handed it the whole photo album, just in case.

## The options, in plain words

A. Compare against the target branch, with full history (built).
B. Fetch only the target branch at a shallow depth, cheaper but fragile when the branch is far behind.
C. Let the tool guess its base from the checkout, which on a shallow checkout grades nothing reliably.

## What I had to decide

The spec says the audit fails only on findings the change introduces but does not say how CI finds the base; a shallow checkout has no base branch to compare with.

## What I did meanwhile

The fallow job checks out with full history and sets FALLOW_AUDIT_BASE to origin/<base ref>; locally the audit against the feature branch passes.

## What it costs to change later

A constant: two lines of the workflow.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not yet run on GitHub; the first ready feature PR proves it.
