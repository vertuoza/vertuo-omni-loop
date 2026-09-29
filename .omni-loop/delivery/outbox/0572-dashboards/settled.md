# Settled outbox items — PRD 572

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-stage-links-same-repository -->

## s1-01-stage-links-same-repository — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-stage-links-same-repository
prd: 572
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a pull request says which PRD it belongs to, should we also understand links that point at a PRD kept in another repository?

## The decision, in plain words

We only understand the short form that points at a PRD in the same repository, in any letter case. A PRD kept in another repository, as multi-repository PRDs are, gets no started or shipped event for now.

## The intro, for fun

A pull request waves at its PRD, but only if they live under the same roof.

## The punchline, for fun

Long-distance relationships are on the roadmap, not in this release.

## The options, in plain words

A. Same-repository links only (Refs #n, Closes #n), any case.
B. Also follow links that name another repository, and read the PRD issue there.
C. Same-repository links, exact case only, as the kit writes them.

## What I had to decide

Whether stage events should also follow links to a PRD issue in another repository.

## What I did meanwhile

Phase-0 and feature PRs whose PRD issue lives in another repository give no prd-started or prd-shipped row; their merges still count as pr-merged.

## What it costs to change later

A second link pattern and a gh issue view against that repository; rows already written stay valid.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often multi-repository PRDs link their phase-0 and feature PRs across repositories today (author)

```

<!-- /omni-outbox-settled: s1-01-stage-links-same-repository -->

<!-- omni-outbox-settled: s2-01-dashboards-check-in-workflow -->

## s2-01-dashboards-check-in-workflow — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-dashboards-check-in-workflow
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new database check for the dashboards only runs when the database workflow names it. Should this slice add it there, even though that workflow is not in its part of the plan?

## The decision, in plain words

I added one step to the database workflow so the new check runs on every pull request, like the others.

## The intro, for fun

A safety check nobody runs is just a very tidy wish.

## The punchline, for fun

So it now runs with its siblings, every single time.

## The options, in plain words

A. Keep the step, so the check runs on every pull request.
B. Remove the step and leave the check for a person to run by hand.

## What I had to decide

Whether the check file supabase/checks/dashboards.sql gets a step in .github/workflows/supabase.yml, a file outside s2's territory.

## What I did meanwhile

Added one step, 'What the dashboards read', after the outbox sends check; the rest of the workflow is untouched.

## What it costs to change later

Removing the step is one deletion; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant another slice to wire the check in (author)

```

<!-- /omni-outbox-settled: s2-01-dashboards-check-in-workflow -->

<!-- omni-outbox-settled: s2-02-season-in-brussels-days -->

## s2-02-season-in-brussels-days — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-season-in-brussels-days
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The Season period on the boards could start at midnight in Brussels or at midnight in London, which is when the game's points reset. Which one should the boards use?

## The decision, in plain words

The boards count the season's days in Brussels time, like the other periods, so the tiles always add up to the charts; the game's points still reset at midnight London time.

## The intro, for fun

Two midnights walk into a month, one hour apart.

## The punchline, for fun

The boards picked the local one and kept the charts honest.

## The options, in plain words

A. Brussels days for the season too, so tiles and charts agree.
B. The exact UTC month for the reads, so the season's edges match the game's to the hour.

## What I had to decide

Whether the season period's window is the UTC month (as the game scores) or its days read in Brussels time (as the charts draw them).

## What I did meanwhile

periodWindow('season') is the UTC month's calendar days, each read in Brussels, up to today: its reads start at the Brussels midnight of the 1st, one or two hours before the UTC month.

## What it costs to change later

One function, periodWindow in src/dashboard/board/period.ts; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether anyone compares a board's season numbers with a UTC-bounded count (author)

```

<!-- /omni-outbox-settled: s2-02-season-in-brussels-days -->

<!-- omni-outbox-settled: s2-03-people-column-unreadable -->

## s2-03-people-column-unreadable — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-people-column-unreadable
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When one of the numbers behind the People table cannot be loaded, should the whole table disappear, or only that column?

## The decision, in plain words

Only that column: its cells show a question mark and one line under the table names what could not load; the list of members still shows.

## The intro, for fun

One missing number should not make a whole team vanish.

## The punchline, for fun

So the team stays, and the gap wears a question mark.

## The options, in plain words

A. Keep the members, mark only the failed column.
B. Hide the whole table whenever any of its numbers fails.

## What I had to decide

How the People table shows a failed read of points, contributions or answered counts, when the members themselves could be read.

## What I did meanwhile

The table renders every member; a failed column's cells read '?' (said 'could not load'), and a line lists the failed columns. The table alone says it could not load when the roster fails.

## What it costs to change later

The People view in src/dashboard/board/Board.tsx and peopleRows in tally.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a question mark reads clearly to someone scanning the table (author)

```

<!-- /omni-outbox-settled: s2-03-people-column-unreadable -->

<!-- omni-outbox-settled: s2-04-board-dividers-listed -->

## s2-04-board-dividers-listed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-board-dividers-listed
prd: 572
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new boards draw faint lines between table rows and behind the charts, and a test elsewhere in the app lists which lines may stay faint. Should they join that list, though the test belongs to another part of the app?

## The decision, in plain words

I added the boards' two kinds of faint line to the list, the way the old week chart and rankings table are listed, so they stay quiet dividers.

## The intro, for fun

Some lines are meant to be seen, and some only to keep the peace.

## The punchline, for fun

The boards' lines signed up for peacekeeping duty.

## The options, in plain words

A. Keep them listed as quiet dividers.
B. Draw them with the strong line colour and leave the test's list alone.

## What I had to decide

Whether the board's grid lines and table cell borders keep --ask-line (dividers) by being listed in apps/galaxy/src/ask/outlines.test.ts, a file outside s2's territory, or switch to --ask-line-strong.

## What I did meanwhile

Added 'dashboard/board/board.css .board-grid' and '.board-table td' to DIVIDERS; also dropped a hover opacity on the chart bars that the same test forbids.

## What it costs to change later

Two lines in a test's list, or two colour tokens in board.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner of that test wants new pages to extend its list (author)

```

<!-- /omni-outbox-settled: s2-04-board-dividers-listed -->

<!-- omni-outbox-settled: s3-01-demo-fleet-opens-on-picker -->

## s3-01-demo-fleet-opens-on-picker — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-demo-fleet-opens-on-picker
prd: 572
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

In the demo, the visitor plays without a fleet. Should the Fleet page open on the list of fleets to pick from, or straight on one fleet's board?

## The decision, in plain words

The demo Fleet page opens on the list of fleets with the line asking to pick one, exactly as a real member without a fleet sees it; one click shows a full board.

## The intro, for fun

The demo visitor walks in with no team shirt on.

## The punchline, for fun

So the page hands them the whole rack to choose from.

## The options, in plain words

A. Open on the list of fleets, as a member without a fleet sees it.
B. Open straight on the first demo fleet's board.
C. Make the demo visitor a member of a demo fleet, on every page.

## What I had to decide

Whether /app/fleet in the demo, with no ?fleet, shows the picker (the demo you, DAM-DEV, plays solo) or defaults to a demo fleet's board so every part shows without a click.

## What I did meanwhile

demoFleetBoard follows the same rule as a real member: the demo you is solo, so with no ?fleet the page shows the picker and 'Pick a fleet to see its board'; ?fleet=builders shows every part of the board.

## What it costs to change later

One default in demoFleetBoard (src/dashboard/fleet/fleet.ts) and its render test; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the demo is meant to show every part of every page with no click at all (author)

```

<!-- /omni-outbox-settled: s3-01-demo-fleet-opens-on-picker -->

<!-- omni-outbox-settled: s4-01-old-home-parts-kept-unused -->

## s4-01-old-home-parts-kept-unused — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-old-home-parts-kept-unused
prd: 572
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Home no longer shows the week of merges or the season's rankings. Should their old building blocks be deleted now, or left in place unused for a while?

## The decision, in plain words

They are left in place, unused, and nothing shows them. Removing them also means changing a colour check shared by other pages, which this piece of work does not own.

## The intro, for fun

The old week chart packed its bags, but its suitcase is still in the hall.

## The punchline, for fun

Nobody trips on it, and a tidy-up can carry it out later.

## The options, in plain words

A. A. Leave the week folder and the rankings view unused for now; a follow-up deletes them.
B. B. Delete them in this slice, editing the shared outline test outside its ground.
C. C. Keep them for good as a reusable chart for another page.

## What I had to decide

Whether the week chart's folder, no longer drawn anywhere, is deleted in this slice.

## What I did meanwhile

Home stops drawing the week chart, the rankings, Outbox settled and the season counts. The week folder stays on disk unused, since the outline test in src/ask checks its stylesheet; the rankings folder stays because Workspace and Fleet import rankFleets from it.

## What it costs to change later

A follow-up that deletes the week folder and its two lines in the shared outline test, plus Rankings.tsx, rankings/load.ts and rankings/demo.ts if nothing else draws them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a later slice or page means to reuse the old week chart (author)

```

<!-- /omni-outbox-settled: s4-01-old-home-parts-kept-unused -->

<!-- omni-outbox-settled: s4-02-waiting-tile-above-board -->

## s4-02-waiting-tile-above-board — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-waiting-tile-above-board
prd: 572
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Where does the Waiting for you tile sit on Home now that the board brings its own row of four tiles?

## The decision, in plain words

It stays its own tile, right under your hero and above the board's period switch, since it counts what waits now and not what happened in the period.

## The intro, for fun

Five tiles walked into a row; one of them was not about the past week.

## The punchline, for fun

So it got its own seat, closest to the door.

## The options, in plain words

A. A. Its own tile under the hero block, above the board.
B. B. A fifth tile in the board's row on Home only.
C. C. A line beside the hero's name instead of a tile.

## What I had to decide

Whether Waiting for you joins the board's tile row or sits apart from it.

## What I did meanwhile

Home shows the hero block, then Waiting for you as a single tile, then the board: the period switch, its four tiles, the charts, Your team and the repositories.

## What it costs to change later

Moving one component on Home; no data or stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How it reads on a phone next to the board's tiles, pending the manual browser pass (author)

```

<!-- /omni-outbox-settled: s4-02-waiting-tile-above-board -->

<!-- omni-outbox-settled: s4-03-home-page-check-allows-period-switch -->

## s4-03-home-page-check-allows-period-switch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-home-page-check-allows-period-switch
prd: 572
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

An older check says Home must hold no navigation at all, and the new period switch is a small one. Should the check allow it?

## The decision, in plain words

The check now allows exactly one navigation on Home, the period switch, and still refuses any other, such as the old section cards.

## The intro, for fun

An old rule said no signposts on Home, then three little period buttons moved in.

## The punchline, for fun

They got a permit, one sign only, no billboards.

## The options, in plain words

A. A. Allow the period switch as Home's one navigation in the check.
B. B. Draw the period switch without a navigation landmark, leaving the old check as it was.
C. C. Drop the no-navigation part of the old check.

## What I had to decide

How the old no-navigation check on Home treats the board's period switch, since that check lives outside this slice's ground.

## What I did meanwhile

The Home check in src/switch now expects the period switch as the page's only navigation; everything else it checked is unchanged.

## What it costs to change later

One line in one test; nothing shipped depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the period switch should rather be marked up as a plain list than as a navigation (author)

```

<!-- /omni-outbox-settled: s4-03-home-page-check-allows-period-switch -->
