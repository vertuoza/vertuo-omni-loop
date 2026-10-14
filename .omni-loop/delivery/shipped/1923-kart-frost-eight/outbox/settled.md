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

<!-- omni-outbox-settled: s6-01-frost-eight-scenery-in-art-snow -->

## s6-01-frost-eight-scenery-in-art-snow — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-frost-eight-scenery-in-art-snow
prd: 1923
slice: s6
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

The spec puts each circuit's scenery in the circuit register, but this step was not allowed to touch the register or the track file. Where should FROST EIGHT's trees, chalets, pylons, snowmen, signs and stands live?

## The decision, in plain words

They are drawn from fills in a new drawing file of the kart folder, placed once from a fixed seed on any circuit that has a snowy floor. Moving them into the register later is a rename, not a rebuild.

## The intro, for fun

Somebody has to decide where the snowmen stand.

## The punchline, for fun

For now they stand wherever the seed says, and they do not complain.

## The options, in plain words

A. A. Drawing code, keyed on the floor, props placed from a fixed seed (built).
B. B. Move props into FROST EIGHT's source and the register, with new prop kinds and sprites in the design package.

## What I had to decide

Keep the scenery in the drawing code keyed on the circuit having a floor, or move it into the register's scenery field once a third circuit needs its own.

## What I did meanwhile

FROST EIGHT looks as specified; COMET RING is untouched.

## What it costs to change later

A third circuit with a floor would share this look until the register carries scenery.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a third circuit is planned is not stated anywhere (author).

```

<!-- /omni-outbox-settled: s6-01-frost-eight-scenery-in-art-snow -->

<!-- omni-outbox-settled: s7-01-grid-view-carries-its-circuit -->

## s7-01-grid-view-carries-its-circuit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-grid-view-carries-its-circuit
prd: 1923
slice: s7
rank: medium
bears-on: none
raised: 2026-10-14
wave: 5
---

## The question, in plain words

The grid must show the name of the circuit it will race, but only the grid's own code knows it, and that code was outside this slice. Was it right to widen the slice by one small change there?

## The decision, in plain words

The grid's code now also says which circuit it will race, and shows a best time only for players who chose that same circuit; a player on the other circuit shows NO TIME. The change is a few lines and a constant to undo.

## The intro, for fun

Two circuits, one grid, and everyone has an opinion about the snow.

## The punchline, for fun

The grid now knows where it is going.

## The options, in plain words

A. A. The grid view carries the circuit's id, and a player on another circuit shows NO TIME (built).
B. B. The grid view carries the circuit's id, and every player shows the best they sent, whichever circuit it was on.
C. C. The arcade reads each entry itself and the grid's code stays as it was.

## What I had to decide

Confirm the grid's code may carry the circuit, or say which other way the screen should learn it.

## What I did meanwhile

The grid shows the circuit of its first arrival, and a time only for players on it.

## What it costs to change later

Undoing it means removing one field from the grid's view and showing every player's own best again, a few lines and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says each player's best on the grid is their time on the grid's circuit; whether a player who picked the other circuit shows NO TIME or their own circuit's time is not said (author).

```

<!-- /omni-outbox-settled: s7-01-grid-view-carries-its-circuit -->

<!-- omni-outbox-settled: s2-02-comet-ring-times-start-over -->

## s2-02-comet-ring-times-start-over — agreed

- Verdict: agreed
- Approved by: nicojustdev
- Approved at: 2026-10-14T14:16:48Z
- Channel: feature pull request #1928
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-14
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Given in the Claude Code session that built PRD 1923, on 2026-10-14, by nicojustdev:

"reset les scores de la premiere map"

Then, asked where the reset goes (a pull request of its own into main, or this PRD), the pick:

"Dans le PRD 1923 (#1928)" — A.
```

### The item, as it was raised

```text
---
id: s2-02-comet-ring-times-start-over
prd: 1923
slice: s2
rank: high
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Should COMET RING's best times start over, and should that happen with FROST EIGHT or on its own?

## The decision, in plain words

COMET RING's times start over when FROST EIGHT ships: a second migration empties COMET RING's board in every workspace, as the person asked during the build.

## The intro, for fun

COMET RING got curves and a tunnel, so its old lap times belong to another track.

## The punchline, for fun

Both boards open on a blank page the same day.

## The options, in plain words

A. Reset COMET RING's board in this PRD, so it applies when FROST EIGHT merges (built).
B. Reset it in a pull request of its own into main, independent of FROST EIGHT.
C. Keep COMET RING's times as they are.

## What I had to decide

Pick A to start both boards empty the day FROST EIGHT ships. Pick B to reset COMET RING now, apart from FROST EIGHT. Pick C to keep today's times.

## What I did meanwhile

Built: supabase/migrations/20261208110000_arcade_kart_comet_ring_times.sql deletes the arcade_scores rows whose game is kart, and nothing else; the spec and the before/after page say COMET RING's times start over.

## What it costs to change later

Every crew loses its COMET RING best times when the feature PR merges; a revert does not bring them back, and only the weekly export keeps them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a crew wants its old COMET RING times shown anywhere after the reset; the spec does not ask for it. (author)

```

<!-- /omni-outbox-settled: s2-02-comet-ring-times-start-over -->
