# Settled outbox items — PRD 1923

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-frost-eight-check-in-access-sql -->

## s2-01-frost-eight-check-in-access-sql — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-frost-eight-check-in-access-sql
prd: 1923
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Where should the new database check for FROST EIGHT's board live, and may the cabinet registry's own test be edited by this slice?

## The decision, in plain words

The check for the new board was added to the existing access check that CI already runs, and the registry's own test was updated to hold the two board names, instead of adding a new check file that CI would not run until its workflow is edited.

## The intro, for fun

Two boards walk into a database, and only one check file has a ticket.

## The punchline, for fun

We added the second board to the check CI already runs.

## The options, in plain words

A. A. Extend the existing access check and update the registry's test (built).
B. B. A new check file plus a CI workflow step, leaving the registry's test for another slice.

## What I had to decide

Pick A to keep the check where CI already runs it. Pick B for a separate file with its own CI step, which a later slice or a person must wire.

## What I did meanwhile

The board is proved by CI's existing database job.

## What it costs to change later

A separate file would need a CI workflow edit outside this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a separate check file is preferred (author)

```

<!-- /omni-outbox-settled: s2-01-frost-eight-check-in-access-sql -->

<!-- omni-outbox-settled: s5-01-push-over-the-line-counts -->

## s5-01-push-over-the-line-counts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-push-over-the-line-counts
prd: 1923
slice: s5
rank: medium
bears-on: none
raised: 2026-10-14
wave: 3
---

## The question, in plain words

On FROST EIGHT a kart that another kart bumps over the start line by a hair was never given its lap, and its place fell back by a whole lap. Should a bump that carries a kart over the line or a gate count as part of the move?

## The decision, in plain words

Yes: after karts are pushed apart, each kart's laps and gates are counted over the push as well, so a bump across the line counts like a drive across it.

## The intro, for fun

A tiny nudge at the line once cost a rival a whole lap.

## The punchline, for fun

Now a nudge over the line counts, like any other step.

## The options, in plain words

A. A. Count the push in the race loop, after the karts are pushed apart (built).
B. B. Widen the lap check in the rivals' module, as the gates' check already is, which is outside this slice's territory.

## What I had to decide

Confirm that a push counts towards laps and gates in the shared race loop, or ask for the line's check to be widened in the rivals' module instead.

## What I did meanwhile

The race loop counts a push over a gate or the line, on COMET RING as well; all of today's tests pass unchanged and the five rivals finish three laps on seeds 1, 7 and 42 at every level on FROST EIGHT.

## What it costs to change later

Changing it later is removing a few lines of the race loop, or moving them to the rivals' module.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The nearest-fit alternative, widening the line's own check in the rivals' module, is outside this slice's territory, so the fix sits in the race loop. (author)

```

<!-- /omni-outbox-settled: s5-01-push-over-the-line-counts -->

<!-- omni-outbox-settled: s5-02-circuit-names-its-board -->

## s5-02-circuit-names-its-board — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-circuit-names-its-board
prd: 1923
slice: s5
rank: medium
bears-on: none
raised: 2026-10-14
wave: 3
---

## The question, in plain words

The registry of circuits and the registry of games each name OMNI KART's two time tables, but COMET RING's circuit id is not its table's id. How should the circuit say which table its times go to?

## The decision, in plain words

Each circuit now carries the name of its table beside its own id, so COMET RING keeps its id and sends its times to the existing table, and FROST EIGHT sends its times to the new one.

## The intro, for fun

Two lists, one race track, and a name tag that did not match.

## The punchline, for fun

So each circuit now wears its table's name badge.

## The options, in plain words

A. A. A circuit keeps its id and carries its table's id in a field of its own (built).
B. B. The circuit ids become the table ids (kart, kart-frost-eight), which changes what slice s4 stores and sends.

## What I had to decide

Confirm that a circuit keeps its own id and carries its table's id as a separate field, or ask for the circuit ids to become the table ids.

## What I did meanwhile

The register holds both circuits with a `board` field; the test holds them equal to the registry's two tables by table and name, in order.

## What it costs to change later

Changing it later is a rename of one field and the stored `track` option values, which are small text values.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's done-when says to compare the register to the registry by id and name; COMET RING's id (comet-ring, set by slice s4 and already stored in options and sent in MULTI's start) differs from its table id (kart), so the comparison is by table id and name. (author)

```

<!-- /omni-outbox-settled: s5-02-circuit-names-its-board -->
