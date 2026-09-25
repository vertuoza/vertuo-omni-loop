---
id: s8-01-territory-graded-in-prose
prd: 7
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the wave merges a slice, how does it tell whether the slice stayed on the ground the plan gave it?

## The decision, in plain words

The wave itself compares the files the slice changed with the ground the slice declared, and only reports a stray file. A dedicated command could take this over later.

## The options, in plain words

A. Compare in the skill prose, report and never fail (built).
B. Add a territory subcommand to the check command in a follow-up slice, over the existing pure grader, and switch the skill to it.
C. Drop the per-slice check and rely on the plan check alone.

## What I had to decide

Upstream graded one slice's diff with a script (check-territory). The kit has the pure function territoryVerdict in kit/lib/inbox/territory.mjs, but no CLI exposes it, and s8's territory is the skill only. Either the skill does the comparison in prose, or a new `omni check territory` command is added.

## What I did meanwhile

The skill reads `gh pr diff <n> --name-only` and the slice row's `territory` from `omni board <prd> --json`; a path is inside when it starts with a territory entry or sits under the PRD's outbox dir. A breach is reported and the merge goes on. `omni plan check <prd>` runs once before merging.

## What it costs to change later

Low: adding the command later replaces one step of prose; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Spec §2.1 rule 3 (policy lives in code) argues for a CLI; no slice in PRD 7's plan owns it. (author)
- The prose rule counts the outbox dir as always inside; territoryVerdict does not know about it. (author)
