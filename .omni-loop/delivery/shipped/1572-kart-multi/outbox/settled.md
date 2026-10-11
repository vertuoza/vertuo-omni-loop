# Settled outbox items — PRD 1572

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-kart-grid-check-ci-step -->

## s2-01-kart-grid-check-ci-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-kart-grid-check-ci-step
prd: 1572
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The new check that proves who may join the kart grid has to run on every pull request, but the file that lists the checks is outside this slice's lane. Who adds the line?

## The decision, in plain words

The check and the rule are written, but the line that makes the pull request checks run it is left for the feature branch, so the slice stays in its lane.

## The intro, for fun

A referee who is not on the rota still has to be called onto the pitch.

## The punchline, for fun

Until someone whistles for the check, it plays only in the changelog.

## The options, in plain words

A. A. Leave the list of checks alone in this slice and add the line when the feature branch is finished (built).
B. B. Widen this slice's lane to the list of checks and add the line here.

## What I had to decide

Add one named step for supabase/checks/kart_grid.sql to the supabase workflow's check job, in the feature PR or in a later slice, before the feature PR is marked ready. The conventions say a check CI does not run proves nothing.
Decided by: Jev (hardToRevert 0.66) · agent said false

## What I did meanwhile

The check file is committed and was run against a stand-in database during the build, but CI does not run it yet.

## What it costs to change later

One step of about three lines in .github/workflows/supabase.yml; no migration, no data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice could not run the check against a real Supabase database here: no local Supabase CLI. The realtime.messages grants and partitions are assumed to be those of a stock Supabase project (author).

```

<!-- /omni-outbox-settled: s2-01-kart-grid-check-ci-step -->

<!-- omni-outbox-settled: s3-01-grid-arrival-clock -->

## s3-01-grid-arrival-clock — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-grid-arrival-clock
prd: 1572
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The grid picks who starts the race, and who holds one of the four places, from the order players arrived in, and each browser says when it arrived by its own clock. What should the arrival be counted by?

## The decision, in plain words

A player's arrival is the moment their own browser joined the grid, by that browser's own clock, and a tie goes to the smaller player id. A browser with a wrong clock can look earlier or later than it is, which only changes who starts the race.

## The intro, for fun

Everybody swears they were first in the queue.

## The punchline, for fun

For now, each player's own watch is the referee.

## The options, in plain words

A. A. Each browser's own clock when it joined, a tie by player id (built).
B. B. The order Supabase Presence reports joins in, which needs no clock but is not documented as stable.
C. C. A counter kept by whoever is first on the grid, which breaks when they leave.

## What I had to decide

Decided by: the slice, with no spec line settling it. Reversible: the arrival is one field of the player's Presence entry, so counting it another way changes one function and no stored data.

## What I did meanwhile

Players are ordered by their own browser's clock, and equal moments by player id.

## What it costs to change later

Swapping to a server-given order touches the grid's join and one test file; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the workspace's players' clocks are close enough in practice (author)

```

<!-- /omni-outbox-settled: s3-01-grid-arrival-clock -->

<!-- omni-outbox-settled: s4-01-kart-late-arrival-race-on -->

## s4-01-kart-late-arrival-race-on — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-kart-late-arrival-race-on
prd: 1572
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

How should a player who joins the grid in the middle of a race know that a race is on, since they never received its start?

## The decision, in plain words

The grid reads a race as on for as long as it keeps hearing the racers' positions, and says how many racers it hears. Three seconds after the last position it reads the grid again.

## The intro, for fun

A latecomer opens the door of a room where everyone is already running laps.

## The punchline, for fun

The grid listens for engines and counts the ones it hears.

## The options, in plain words

A. Listen to the racers' own position messages: a race is on while any arrive, within the last three seconds
B. Add a message the starter sends again every few seconds while the race lasts, at a cost in the shared message budget
C. Keep a race flag in the presence entry of each racer, which adds a field to what every player tracks

## What I had to decide

Pick how a late arrival learns a race is on. A relies on the positions the racers keep sending, so it needs no new message and no extra traffic. The cost is a delay of up to three seconds before the grid reads a race as over.

## What I did meanwhile

A late arrival reads RACE ON with the number of racers it hears, and cannot start a race.

## What it costs to change later

Changing it later is a constant or one extra message, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the line RACE ON · <n> RACERS but not how it is known (author)

```

<!-- /omni-outbox-settled: s4-01-kart-late-arrival-race-on -->

<!-- omni-outbox-settled: s5-01-s5-live-test-edit -->

## s5-01-s5-live-test-edit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-s5-live-test-edit
prd: 1572
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

An earlier test said a race against other players sends nothing to the score at the finish; this step makes it send the time, so that test had to change although its file is outside this step's list. Is that edit fine?

## The decision, in plain words

Rewrote that one test to say the time is sent once at the finish, and put all the new tests in a new file inside this step's own area.

## The intro, for fun

A test swore the finish line was silent; the finish line begs to differ.

## The punchline, for fun

One old promise rewritten, the rest filed in the right drawer.

## The options, in plain words

A. A. Rewrite that one old test and keep every new test in this step's own area (built).
B. B. Delete the old test and rely on the new file's tests alone.
C. C. Leave the old test failing and ask for the territory to be widened.

## What I had to decide

The old test contradicted the slice's own done condition, so it could not stay as it was.

## What I did meanwhile

The edit stays in place; the new tests live in kart/hub.finish.test.ts.

## What it costs to change later

A reviewer must read one rewritten test in a file outside the slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reviewer prefers the test moved out of live.test.ts altogether (author)

```

<!-- /omni-outbox-settled: s5-01-s5-live-test-edit -->
