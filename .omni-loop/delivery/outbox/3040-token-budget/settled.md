# Settled outbox items — PRD 3040

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-budget-edge-rules -->

## s1-01-budget-edge-rules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-budget-edge-rules
prd: 3040
slice: s1
rank: medium
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

When both caps are reached at once, or a stop is still unanswered but the cap was raised some other way, or a raise was not enough, what should a mission do?

## The decision, in plain words

When both caps are reached, the fleet's cap is named first, so one stop pauses the whole fleet. A mission goes back to work as soon as every cap has room again, answered or not, and a raise that leaves no room asks once more.

## The intro, for fun

Two caps, one mission, and a meter that only goes up.

## The punchline, for fun

The fleet's cap speaks first, because it pauses everyone in one go.

## The options, in plain words

A. A. The fleet's cap first; room under every cap means the mission works again, answered or not; a raise that leaves no room asks again.
B. B. The mission's own cap first, so its own budget is the one the person sees when both are reached.
C. C. An unanswered stop holds the mission until a person answers it, even after the cap gained room.

## What I had to decide

Keep A, or pick B or C: each is a constant in one small function, changed in a line and a test.

## What I did meanwhile

The mission's run follows A: the fleet's cap first, room means work, a short raise asks again.

## What it costs to change later

Low: one pure function, no stored data depends on the order.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say which cap a stop names when both are reached at the same run.
- (author) The spec does not say what happens to an unanswered stop once a pushed brief raises the budget; the mission resumes, and the stop stays unanswered for the next slice to show or close.
- (author) A Resume tomorrow with no known oldest job waits a whole 24 hours from now, and never wakes before now.

```

<!-- /omni-outbox-settled: s1-01-budget-edge-rules -->
