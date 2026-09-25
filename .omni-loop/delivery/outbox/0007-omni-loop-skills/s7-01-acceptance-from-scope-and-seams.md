---
id: s7-01-acceptance-from-scope-and-seams
prd: 7
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The planner must stop and ask when a PRD's acceptance criteria are missing, but our PRD write-ups often have no section by that name. What counts as acceptance criteria?

## The decision, in plain words

A PRD with no acceptance section still passes when its scope and test seams let every piece of work have a clear, checkable finish line. It stops and asks only when that finish line cannot be written.

## The options, in plain words

A. Acceptance section, else scope and test seams, graded by whether every slice's done-when is observable
B. Require a heading named Acceptance criteria in every spec; stop without it
C. Never stop; write the plan and raise the gap as an outbox item

## What I had to decide

Whether /omni:plan may read scope and test seams as acceptance criteria when the spec has no acceptance section, or must stop on every spec that lacks one.

## What I did meanwhile

The skill reads the acceptance section, else scope and test seams, and stops only when a slice's "done when" cannot be written as an observable condition.

## What it costs to change later

One paragraph of the skill; a later spec template with a mandatory acceptance section would make the fallback unused.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's own §2.1 does not say what a spec file must contain; PRD 7's spec has no acceptance section. (author)
