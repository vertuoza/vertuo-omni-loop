# Settled outbox items — PRD 2124

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-as-of-in-who-line -->

## s1-01-as-of-in-who-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-as-of-in-who-line
prd: 2124
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Where should a repository question's 'as of' time appear on its row?

## The decision, in plain words

It is written after 'waits on you' in the same line, because the slice may not change the shared question row.

## The intro, for fun

Every clock needs a face to sit on.

## The punchline, for fun

This one borrowed a neighbour's.

## The options, in plain words

A. A. As built: inside the 'waits on' line.
B. B. A dedicated field on the question and its own chip in the shared row.

## What I had to decide

Where to draw the as-of time of a repository row, the row component being outside this slice's territory.

## What I did meanwhile

Added the time to the forWhom text: 'waits on you · as of 2026-10-16 14:05 UTC'.

## What it costs to change later

A constant and a view field if the time later gets its own place in the row.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the design wants the time in its own chip.

```

<!-- /omni-outbox-settled: s1-01-as-of-in-who-line -->
