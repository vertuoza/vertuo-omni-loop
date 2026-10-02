# Settled outbox items — PRD 976

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-hook-test-outside-areas -->

## s2-01-hook-test-outside-areas — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-hook-test-outside-areas
prd: 976
slice: s2
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

One test of a local commit check sits outside every area the plan splits the clean-up into, and the linter found two unused names in it. Who clears them?

## The decision, in plain words

The slice that brings the linter in cleared both itself, the same way and with the same result, so no area has to carry a finding it does not own.

## The intro, for fun

Seventeen areas, one map, and a single test file standing in the gap between them.

## The punchline, for fun

It got tidied on the spot rather than given a country of its own.

## The options, in plain words

A. A. The linter's slice clears the two findings in that test itself, three lines, same behaviour.
B. B. Add the folder to an area's ceiling file and let that area's slice clear it.
C. C. Configure the unused-name rule to ignore names dropped while copying the rest of an object.

## What I had to decide

Whether a file outside every area is cleared by the slice that lands the linter, or given an area of its own.

## What I did meanwhile

The test keeps the same environment for the check it runs; only how it drops two settings changed.

## What it costs to change later

A constant: undo the three-line change and add the folder to an area's ceiling file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no area for the local hooks folder, and says a finding outside every area must fail (author)

```

<!-- /omni-outbox-settled: s2-01-hook-test-outside-areas -->
