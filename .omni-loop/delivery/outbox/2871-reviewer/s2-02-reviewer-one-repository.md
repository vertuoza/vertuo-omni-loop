---
id: s2-02-reviewer-one-repository
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The spec says a feature built across several repositories gets its fix through the multi-repository fix, but not how the Reviewer reviews such a feature, whose code lives in other repositories. Should the Reviewer review those now, or stop on them for now?

## The decision, in plain words

For now the Reviewer reviews one repository's feature pull request and stops, saying why, on a feature that spans repositories. Under a mission that feature is then held for a person, as any stopped job is.

## The intro, for fun

The Reviewer got one pull request to read, and some features come in a box of five.

## The punchline, for fun

It reads the one it was handed and says plainly it does not open the box.

## The options, in plain words

A. Review one repository's feature pull request, and stop on a feature that spans repositories (built).
B. Review every target repository's feature pull request too, one review each, passing only when every one passes, and hand findings to the multi-repository fix.

## What I had to decide

Spec section 2's table names `/omni:ultra-yolo-fix` as the fix for a multi-repository PRD, but section 1 describes reviewing one feature PR, and the plan's s2 done-when names no target repository. A multi-repository PRD's code is on its targets' feature PRs, not the plan repository's. `/omni:review` stops with `review: PRD <n> spans repositories: …` when `omni prd <n>` prints a `repos:` line; a mission reads that as stopped, sends it once more, then stops the PRD with why (BR-PRODUCT-139).

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

The skill stops in one line on a `repos:` PRD, before any read of GitHub or any review is posted.

## What it costs to change later

A constant: option B adds a section to the skill (each target's PR through `omni review post --repo`, already there) and changes no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether missions build multi-repository PRDs today, and so whether option B is needed before this PRD ships.
