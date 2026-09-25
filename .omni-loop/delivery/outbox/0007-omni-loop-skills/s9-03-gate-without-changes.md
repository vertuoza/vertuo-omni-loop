---
id: s9-03-gate-without-changes
prd: 7
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

Before filing the work as shipped, should the final check also look for risky changes nobody explained, or only for open questions?

## The decision, in plain words

It looks only for open questions and for decisions that still need rework. Risky changes are already checked slice by slice while each piece is built.

## The options, in plain words

A. Gate on open items and unreworked drift only (built).
B. Gate with the changes range too, so unaccounted risky changes hold the ready step.

## What I had to decide

omni status can also grade unaccounted risky changes against the default branch (--changes or --base). Spec rule 7 names only open items and unreworked drift. Each slice runs omni check coverage before its sub-PR.

## What I did meanwhile

The gate is omni status with no range flag.

## What it costs to change later

Low: adding a flag to one command line in the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the CI outbox workflow (not built yet) will pass a range, which would make the local gate and CI disagree. (author)
