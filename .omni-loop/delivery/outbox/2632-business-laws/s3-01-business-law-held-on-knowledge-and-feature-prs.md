---
id: s3-01-business-law-held-on-knowledge-and-feature-prs
prd: 2632
slice: s3
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

Which pull requests into the main branch should wait for the product manager when they change a business law?

## The decision, in plain words

A feature pull request and a knowledge pull request wait for the product manager, whatever the repository's law setting. A pull request from any other branch is not held, as for the other laws today.

## The intro, for fun

A rule only the manager may change needs every change to walk through a guarded door.

## The punchline, for fun

Two doors are guarded now; the side door is still the one nobody watches.

## The options, in plain words

A. A. Hold a business law on feature and knowledge pull requests only, the knowledge one found by its branch name (built).
B. B. Hold it on every pull request into the main branch, reading each one's changed files before skipping it; the gate law's test changes, approved by its owner.
C. C. A, and also hold fix and enforce pull requests under every law setting.

## What I had to decide

Answer A to keep it. B makes the check read the changed files of every pull request into the main branch before it skips one, which changes the proof of BR-PRODUCT-6 and N-PRODUCT-4 (apps/omni-app/src/outbox-check/outbox-check.test.ts asserts a skipped pull request reads no compare): only @pierrederval or @dervalp approve that. C widens A to fix and enforce branches under laws.source none.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Built as A: checkTarget gates a knowledge PR under any laws.source by its branch alone, and law-locked holds a changed business-laws.md on it and on every graded feature PR, until a CODEOWNER of the file (or laws.owners) approves the head.

## What it costs to change later

B costs one more GitHub read (the compare) for every pull request into the main branch the check would skip, and an owner's approval of the change to a locked law's test. C costs a read of the changed files on fix and enforce PRs the check skips today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A business law changed on another branch (a chore branch, or a feature branch with no PRD folder) merges unheld until B is chosen; the register laws have the same gap today. (author)
- The skipped knowledge PR now opens its check in progress and reads its comments and changed files before it completes skipped, where it completed skipped at once before. (author)
