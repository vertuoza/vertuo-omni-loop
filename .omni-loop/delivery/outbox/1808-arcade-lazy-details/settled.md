# Settled outbox items — PRD 1808

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-three-calls-count-the-dossier -->

## s1-01-three-calls-count-the-dossier — adopted

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
id: s1-01-three-calls-count-the-dossier
prd: 1808
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

Opening a planet must cost at most three database calls. Does that limit cover only reading the planet's dossier, or also finding the planet and its log?

## The decision, in plain words

The dossier is read in three calls. Finding the planet and its log reuses the map's saved copy, which still asks the database four small questions to know the copy is current.

## The intro, for fun

Three calls sounded like a budget, until the planet had to be found first.

## The punchline, for fun

The dossier kept to its three; the map's checks came along for the ride.

## The options, in plain words

A. A. The limit covers the dossier: three calls for it, and the map's usual checks to find the planet and its log.
B. B. The limit covers the whole answer: one database function returns everything, at the price of a migration.

## What I had to decide

Whether the three-call limit covers the dossier only, as built, or the whole answer.

## What I did meanwhile

Each opened planet makes three dossier calls plus the four small checks the map's saved copy makes on every page, far from the 430 calls a page load made before.

## What it costs to change later

Option B needs a new database function that returns the workspace, the planet's log and its dossier at once: a migration, and a second copy of how the log is built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long the four extra calls take on production is not measured yet (author).

```

<!-- /omni-outbox-settled: s1-01-three-calls-count-the-dossier -->

<!-- omni-outbox-settled: s2-01-chart-refusals -->

## s2-01-chart-refusals — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-chart-refusals
prd: 1808
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The spec says who may read the star chart, but not what the game is told when someone else asks, or when the chart cannot be read.

## The decision, in plain words

A person in no workspace is refused as not allowed, and a chart that cannot be read comes back as a server failure in the game's own words. A build that has no knowledge at all says so, rather than out of reach.

## The intro, for fun

Somebody knocks on the observatory door without a crew badge.

## The punchline, for fun

We say no politely, and say sorry when the telescope is broken.

## The options, in plain words

A. A. 403 for an outsider, 500 out of reach, 'none' only without a config (as built)
B. B. 404 for an outsider, so the route does not say a chart exists
C. C. 200 with a null chart when out of reach, so the game reads one shape

## What I had to decide

Whether these answers suit the game, which reads them when the star chart opens.

## What I did meanwhile

The star chart route answers 403 to an outsider, 500 with THE STAR CHART IS OUT OF REACH when the chart or the membership cannot be read, and 'none' only when no Omni Loop config sits above the app.

## What it costs to change later

A constant per answer in one controller and its tests; the game's hook (s4) reads any non-200 as out of reach.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The out-of-reach status could as well be 503; nothing in the knowledge picks one (author)

```

<!-- /omni-outbox-settled: s2-01-chart-refusals -->
