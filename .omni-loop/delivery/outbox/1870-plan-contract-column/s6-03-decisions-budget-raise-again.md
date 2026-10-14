---
id: s6-03-decisions-budget-raise-again
prd: 1870
slice: s6
rank: high
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Main added ten more decision records since you raised the decision list's limit to 15 KB, and the list is over it again. Do you raise the limit to 16 KB?

## The decision, in plain words

The limit is raised to 16 KB, because main alone now needs about 15.3 KB and this PRD adds one more record to the list.

## The intro, for fun

You built a bigger shelf, and main filled it before lunch.

## The punchline, for fun

Sixteen kilobytes, until the next ten records.

## The options, in plain words

A. A. Raise the limit of the decision list to 16 KB (16384 bytes), as built.
B. B. Keep the 15 KB limit and trim the decision list's page until it fits again.

## What I had to decide

Answer A to raise the ceiling of the `decisions` form again. Budget raise: `form:decisions` to 16384 bytes.

## What I did meanwhile

The ceiling in `.omni-loop/budgets/context.json` is raised to 16384 bytes. Measured: 15654 bytes on main alone (its ceiling 14336), 15762 bytes with this PRD's record. The context check stays red on the feature pull request until this is answered; nothing else waits on it.

## What it costs to change later

Lowering the ceiling again means trimming the decision list's page (`.omni-loop/knowledge/adr/README.md`) or how it lists records: an edit of one page, no code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) main grows the list with every knowledge pull request and is itself over its own ceiling, so whether the team wants a raise per PRD or a trim of the list is theirs to say
