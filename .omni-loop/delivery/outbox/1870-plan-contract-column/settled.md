# Settled outbox items — PRD 1870

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-slice-fixture-outside-territory -->

## s1-01-slice-fixture-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-slice-fixture-outside-territory
prd: 1870
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

One older test builds plan slices by hand and had to learn the new field too, but it sits outside the files this step was given. Should it have been changed here?

## The decision, in plain words

I added the one missing line to that test, saying the slice declares nothing, so the whole kit still builds. Nothing it checks changed.

## The intro, for fun

A new column joined the plan, and one old test forgot to set a place for it.

## The punchline, for fun

One line later, everyone sits at the table again.

## The options, in plain words

A. A. Keep the field required and the one-line fixture fix outside the territory (built).
B. B. Make the new contract field optional so no other file needs touching, and have every reader handle a missing field as well as an empty one.

## What I had to decide

Whether a one-line fix to a test that builds slices by hand may land outside this slice's ground, or the new field should be optional instead.

## What I did meanwhile

Added `contract: null` to the hand-built slices of kit/lib/flow/plan-rules.test.ts, the only file outside the territory the new required field broke at typecheck.

## What it costs to change later

A constant: removing the line, or making the field optional, is a one-line change with no data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan named s1's territory before anyone counted the files that build slices by hand; whether the planner meant to leave them out is not written down (author).

```

<!-- /omni-outbox-settled: s1-01-slice-fixture-outside-territory -->
