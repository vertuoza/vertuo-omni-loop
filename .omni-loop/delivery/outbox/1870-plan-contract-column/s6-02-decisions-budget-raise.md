---
id: s6-02-decisions-budget-raise
prd: 1870
slice: s6
rank: high
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The list of decision records every agent reads is now over its size limit. Do you raise the limit from 14 KB to 15 KB?

## The decision, in plain words

The limit is raised to 15 KB, because the list was already just over 14 KB on main and this PRD adds one more record to it.

## The intro, for fun

Every new decision adds a line to the list, and the list hit its ceiling.

## The punchline, for fun

One more shelf, and the books stand up again.

## The options, in plain words

A. A. Raise the limit of the decision list to 15 KB (15360 bytes), as built.
B. B. Keep the 14 KB limit and trim the decision list's page until it fits again.

## What I had to decide

Answer A to raise the ceiling of the `decisions` form. Budget raise: `form:decisions` to 15360 bytes.

## What I did meanwhile

The ceiling in `.omni-loop/budgets/context.json` is raised to 15360 bytes. The context check stays red on the feature pull request until this is answered; nothing else waits on it. Measured: 14344 bytes on main (ceiling 14336), 14452 bytes with ADR-0106.

## What it costs to change later

Lowering the ceiling again means trimming the decision list's page (`.omni-loop/knowledge/adr/README.md`) or how it lists records: an edit of one page, no code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the list was already over its limit on main, so trimming it is a change outside this PRD's slices; whether the team prefers a raise or a trim is theirs to say
