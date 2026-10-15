---
id: s1-02-contract-source-and-glob-strictness
prd: 1796
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec's example writes a contract's source as 'PRD 412', but the check has always asked for 'PRD #412'. And should a pattern instead of a file name be refused even in a copy imported from another repository?

## The decision, in plain words

We kept the check as strict as it is for rules: a source needs the number sign, so our first contract says 'PRD #1796'. A pattern is refused everywhere, even in an imported copy, while whether a file exists is only asked of this repository's own files.

## The intro, for fun

One small number sign stood between a contract and a green check.

## The punchline, for fun

We kept the sign, and wrote the contract to match it.

## The options, in plain words

A. Keep 'PRD #<n>' and refuse a glob everywhere, as built.
B. Accept 'PRD <n>' without the sign on every entry, and skip the glob check in an imported copy too.

## What I had to decide

How a contract's Source: and Points to: lines are read: whether 'PRD <n>' without '#' leads somewhere, and whether the glob refusal is skipped in an imported copy as the existence check is.

## What I did meanwhile

Source: follows the rule check unchanged ('PRD #<n>', an issue number or a path), so DC-PRODUCT-1 reads 'Source: PRD #1796'; a glob in Points to: is refused in every context, and an imported copy (ctx.copyOf) skips only the existence and directory checks.

## What it costs to change later

Two constants in kit/lib/knowledge/check-knowledge.ts; loosening either later breaks no entry.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's 'PRD 412' example meant the number sign could be dropped for every kind of entry (author)
