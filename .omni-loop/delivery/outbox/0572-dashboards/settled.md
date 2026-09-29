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
