# Settled outbox items — PRD 1975

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-beyond-territory -->

## s1-01-beyond-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-beyond-territory
prd: 1975
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Paying merged pull requests needed three small changes in files this slice's plan did not list. Is that acceptable, or should those changes wait for a later slice?

## The decision, in plain words

The three changes were made in this slice, each as small as it could be, so the new points work and the galaxy view keeps loading once they are written.

## The intro, for fun

The map said stay in the yard, but the gate had a loose hinge.

## The punchline, for fun

Three screws tightened, nothing else touched.

## The options, in plain words

A. A. Keep the three changes in this slice, so the arcade keeps loading once a merged pull request's points are written.
B. B. Undo them here and let the last slice carry them, accepting that the arcade fails to load in between.

## What I had to decide

Keep the three changes in this slice (A), or undo them and let a later slice carry them (B).

## What I did meanwhile

The slice ships with the three changes in it.

## What it costs to change later

Undoing them is a small revert: the shared shape of a read, one filter line in the galaxy view, and one database check file. No stored data depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The database check runs only in the repository's continuous integration, not on this machine: it was not run here. (author)
- The three files outside the territory: game/types.ts (the snapshot names the merged pull requests), packages/galaxy/src/galaxy.ts (planet 0 left out of the map; it threw on a PRD number 0 without it) and supabase/checks/game_answered_rounds.sql (the ledger takes PR_MERGED and PR_REVIEWED on planet 0). (author)

```

<!-- /omni-outbox-settled: s1-01-beyond-territory -->

<!-- omni-outbox-settled: s2-01-beyond-territory-fixtures -->

## s2-01-beyond-territory-fixtures — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-beyond-territory-fixtures
prd: 1975
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Making secured zones pay nothing broke tests in files this slice's plan did not list, because they used a secured zone as their example of earning points, and the demo world's ranking lost its shape. Is it acceptable that this slice fixed them?

## The decision, in plain words

Those tests now earn their points another way (a rescue, a closed question, or a merged or reviewed pull request), their checks unchanged otherwise, and the demo world gained one merged pull request so its ranking still shows the player in the middle of the board.

## The intro, for fun

The zone stopped paying, and every test that counted on it came up short.

## The punchline, for fun

They found other work, and the scoreboard still adds up.

## The options, in plain words

A. Keep the fixes in this slice, so every test passes with the new pay.
B. Undo them here and let the last slice carry them, accepting a red test run in between.

## What I had to decide

Keep these fixes in this slice (A), or undo them and let the last slice carry them (B).

## What I did meanwhile

The slice ships with the fixes in it, and the whole test run is green.

## What it costs to change later

Undoing them is a small revert of test examples and one demo pull request; no stored data depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Files outside the territory: game/experience.test.ts, game/cli/score.test.ts, game/sources/github.test.ts, apps/galaxy/src/dashboard/load.test.ts, apps/galaxy/src/dashboard/season.test.ts, apps/galaxy/src/data/load-galaxy.test.ts, packages/galaxy/src/galaxy.test.ts, packages/galaxy/src/xp.test.ts and packages/galaxy/src/demo.ts (one merged feat pull request, so the demo's rankings test still finds the player below the top five).
- (author) The score function now takes an optional rulebook, the real one by default, so the night shift, the revert and the clawback stay tested under the rollback's numbers.

```

<!-- /omni-outbox-settled: s2-01-beyond-territory-fixtures -->
