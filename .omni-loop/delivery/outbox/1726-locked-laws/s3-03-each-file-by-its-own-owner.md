---
id: s3-03-each-file-by-its-own-owner
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When a change to a locked law touches several files with different owners, must one person own all of them, or may each file be approved by its own owner?

## The decision, in plain words

Each file may be approved by its own owner, the way GitHub reads owners: the check turns green once every file has an approval from someone who owns it.

## The intro, for fun

Two files, two owners, one locked law.

## The punchline, for fun

Everyone signs for their own corner.

## The options, in plain words

A. Each file approved by one of its own owners (built).
B. One approver who owns every file the law's change touched.

## What I had to decide

Whether law-locked needs one person listed for every file that fired it, or an owner's approval per file.

## What I did meanwhile

lawsAwaitingOwners (kit/lib/outbox/decision-coverage.ts) judges each law alone and holds it while any file that fired it has no approval from one of that file's own person owners. With laws.owners writing one owner list for the whole CODEOWNERS block (s4), both readings agree.

## What it costs to change later

One rule in lawsAwaitingOwners: asking for one approver common to every file is an intersection instead of a per-file test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's words 'a person whom CODEOWNERS lists for every file' read either way.
