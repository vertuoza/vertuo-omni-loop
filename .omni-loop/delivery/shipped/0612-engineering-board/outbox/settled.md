# Settled outbox items — PRD 612

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-checks-and-tests-outside-territory -->

## s1-01-checks-and-tests-outside-territory — adopted

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
id: s1-01-checks-and-tests-outside-territory
prd: 612
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Adding the new settings page meant touching files the plan did not list: the database check list run on every pull request, and three tests that count the sidebar's entries. Is that all right?

## The decision, in plain words

We added the new database check to the list that runs on every pull request, and taught the three sidebar tests about the new Repositories entry. Nothing else outside the plan was changed.

## The intro, for fun

The plan drew a fence, and the sidebar tests lived just over it.

## The punchline, for fun

We stepped over, fixed the count, and stepped back.

## The options, in plain words

A. Keep the four edits, the option built.
B. Move the workflow step to a separate pull request, and keep the three test edits, which the sidebar change forces.

## What I had to decide

Whether slice s1 may change .github/workflows/supabase.yml (one step running supabase/checks/repositories.sql) and three sidebar tests outside its territory (apps/galaxy/src/nav/Sidebar.render.test.ts, apps/galaxy/src/switch/headers.test.ts, apps/galaxy/src/switch/switch.test.ts).

## What I did meanwhile

The four edits are made: one workflow step, and the Repositories entry added to the three tests' expected lists. The plan's done-when asks for the check to pass in the supabase workflow, which needs the step.

## What it costs to change later

Reverting is removing one workflow step and three list entries; the check then never runs in CI and the sidebar tests go red.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant apps/galaxy/src/nav/sidebar to cover Sidebar.render.test.ts, whose name differs only in case (author)

```

<!-- /omni-outbox-settled: s1-01-checks-and-tests-outside-territory -->

<!-- omni-outbox-settled: s1-03-no-access-read-from-the-app -->

## s1-03-no-access-read-from-the-app — adopted

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
id: s1-03-no-access-read-from-the-app
prd: 612
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

How does the Repositories page know the Omni App cannot read a repository, before the collector has even tried?

## The decision, in plain words

Each time the page opens, it asks GitHub which repositories the Omni App can see; a listed repository missing from that answer shows that the App has no access. When GitHub cannot be asked, the page shows the list without those marks.

## The intro, for fun

The page knocks on GitHub's door before the collector does.

## The punchline, for fun

Whoever does not answer gets a polite sticky note.

## The options, in plain words

A. The App's live listing on each page load, the option built.
B. Only the collector's recorded error, so the page calls GitHub only for Add repository.

## What I had to decide

Where the no-access mark on Settings → Repositories comes from: the App's live listing of its installation's repositories, read on each page load, or the collector's recorded error.

## What I did meanwhile

The live listing, read server side with galaxy's App credentials. The collector's error shows separately as a failed collection being retried. A workspace with no installation shows the install link above its list, which stays visible.

## What it costs to change later

A second source is a few lines in the page's read; meanwhile one more GitHub call per page load.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether one GitHub call per page load matters at the workspace's scale (author)

```

<!-- /omni-outbox-settled: s1-03-no-access-read-from-the-app -->

<!-- omni-outbox-settled: s2-01-route-test-outside-territory -->

## s2-01-route-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-route-test-outside-territory
prd: 612
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Serving the new collector changed the list of jobs the app answers for, and an existing test that pins that list sits outside this slice's area. Was it right to update that test here?

## The decision, in plain words

We updated the existing test so it expects the new collector beside the three jobs it already listed, and changed nothing else in it.

## The intro, for fun

Adding a new job to the app made an old test count to four instead of three.

## The punchline, for fun

We taught the test to count one higher and left the rest of it alone.

## The options, in plain words

A. A: Update the existing route test in place to list the collector (what was built).
B. B: Move the served-functions assertion into the collector's own folder and leave the route test untouched.
C. C: Widen the plan's territory for this slice to include the route test, and keep the change as built.

## What I had to decide

Whether a test that pins the served functions may be updated by the slice that adds a function, although its file sits outside the slice's territory.

## What I did meanwhile

The route test expects four served functions and seven registered ones (the three failure handlers included); the whole omni-app suite is green.

## What it costs to change later

Reverting is a few lines in one test file; nothing stored or shipped depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 names the served route file but not the test that pins it (author).

```

<!-- /omni-outbox-settled: s2-01-route-test-outside-territory -->

<!-- omni-outbox-settled: s2-02-collector-batch-size -->

## s2-02-collector-batch-size — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-collector-batch-size
prd: 612
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

How much should the collector read in one go, so a long first read of a busy repository never runs out of time?

## The decision, in plain words

It reads at most fifty pull requests per step and twenty steps per repository per run; a longer first read simply carries on at the next run a quarter of an hour later.

## The intro, for fun

Ninety days of pull requests do not fit in one breath.

## The punchline, for fun

So the collector reads fifty at a time and comes back for more.

## The options, in plain words

A. A: Fifty per step, twenty steps per repository per run (what was built).
B. B: One step per repository with no cap, as the spec's wording reads, at the risk of a timeout on a large backfill.
C. C: Smaller batches of twenty, for a tighter time limit, at the cost of more steps.

## What I had to decide

The batch size per step and the number of steps per repository per run for the collector.

## What I did meanwhile

Fifty pull requests per step, twenty steps per repository per run: up to a thousand pull requests per repository every fifteen minutes. The cursor only moves past what was written.

## What it costs to change later

Two constants in the collector; changing them needs no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec sets no bound on one step's work; the numbers come from three calls per pull request and a Vercel function's time limit, not from a measurement (author).

```

<!-- /omni-outbox-settled: s2-02-collector-batch-size -->

<!-- omni-outbox-settled: s3-01-sidebar-tests-outside-territory -->

## s3-01-sidebar-tests-outside-territory — adopted

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
id: s3-01-sidebar-tests-outside-territory
prd: 612
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Adding Engineering to the sidebar meant touching three tests the plan did not list, the ones that count the sidebar's entries on every page. Is that all right?

## The decision, in plain words

We taught those three tests about the new Engineering entry, exactly as the Repositories entry did before. Nothing else outside the plan was changed.

## The intro, for fun

The sidebar grew one line, and three tests noticed.

## The punchline, for fun

We told them politely, and they counted to one more.

## The options, in plain words

A. A. Keep the three test edits, the option built.
B. B. Widen the plan's territory for sidebar changes to name these tests, and keep the edits.

## What I had to decide

Whether slice s3 may change three sidebar tests outside its territory: apps/galaxy/src/nav/Sidebar.render.test.ts, apps/galaxy/src/switch/headers.test.ts and apps/galaxy/src/switch/switch.test.ts, as s1 did for the Repositories entry (item s1-01, adopted).

## What I did meanwhile

Each of the three tests now expects the Engineering entry after Workspace, and headers.test.ts also checks /app/engineering sits in the app shell with the title Engineering.

## What it costs to change later

Reverting is removing the Engineering entry from three expected lists; the sidebar tests then go red, since the sidebar change forces them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant apps/galaxy/src/nav/sidebar to cover Sidebar.render.test.ts, whose name differs only in case (author)

```

<!-- /omni-outbox-settled: s3-01-sidebar-tests-outside-territory -->

<!-- omni-outbox-settled: s3-02-top-five-ties-in-login-order -->

## s3-02-top-five-ties-in-login-order — adopted

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
id: s3-02-top-five-ties-in-login-order
prd: 612
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When several people have the same count at the edge of a top-5 list, who gets the last places?

## The decision, in plain words

Each list shows exactly five people at most, most first. People with the same count are listed in alphabetical order of their GitHub name, and whoever falls past fifth is left out.

## The intro, for fun

Six people tie for fifth place, and the podium has one step left.

## The punchline, for fun

The alphabet broke the tie, so it is good news for anyone named Aaron.

## The options, in plain words

A. A. At most five, ties in alphabetical order of login, the option built.
B. B. Everyone tied at the fifth count is shown, so a list may run past five.
C. C. At most five, ties broken by who reached the count first.

## What I had to decide

How the three top-5 people lists (most opened, most merged, most reviews) break ties, and whether a tie at fifth place may show more than five people.

## What I did meanwhile

topFive() in apps/galaxy/src/engineering/tally.ts sorts by count, most first, then by login A to Z, and cuts at five; the acceptance criteria's at most five people holds.

## What it costs to change later

A constant change in one function and its test: a different tie-break, or showing everyone tied at fifth.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether people tied at fifth place should all be shown, or marked as tied (author)

```

<!-- /omni-outbox-settled: s3-02-top-five-ties-in-login-order -->

<!-- omni-outbox-settled: s3-03-empty-state-only-with-nothing-tracked -->

## s3-03-empty-state-only-with-nothing-tracked — adopted

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
id: s3-03-empty-state-only-with-nothing-tracked
prd: 612
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The Engineering board has an empty state. Should it show when nothing is tracked, or also when repositories are tracked but not collected yet?

## The decision, in plain words

The empty state shows only when the workspace tracks no repository. A workspace that tracks repositories not collected yet sees the board with zeros, each tracked repository listed in the table.

## The intro, for fun

The board opens its shop before the first delivery truck arrives.

## The punchline, for fun

The shelves say zero, and the sign says open.

## The options, in plain words

A. A. Empty only with no tracked repository; zeros otherwise, the option built.
B. B. Empty also while no tracked repository has been collected yet.

## What I had to decide

When /app/engineering shows its empty state (No tracked repositories yet → Settings → Repositories): the spec says both with nothing collected yet and, in its acceptance criteria, for a workspace with no repositories.

## What I did meanwhile

engineeringOf() in apps/galaxy/src/engineering/tally.ts returns the empty state when the tracked list is empty; otherwise the board, zeros kept. Settings → Repositories already says not collected yet on each row that waits.

## What it costs to change later

A one-line change in engineeringOf() and one read of the collection time per repository, which the tracked read can add.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether tracked repositories waiting for their first collection should read as empty, or as zeros (author)

```

<!-- /omni-outbox-settled: s3-03-empty-state-only-with-nothing-tracked -->

<!-- omni-outbox-settled: s1-02-statistics-keys-per-workspace -->

## s1-02-statistics-keys-per-workspace — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-09-29T12:24:59Z
- Channel: feature pull request #613
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/613#issuecomment-5890257063
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1
- Stays here: laws.source is none here, and the per-workspace keys are recorded where they live, in the repositories migration and the spec; nothing lasting beyond this PRD's storage shape.

### The answer, as it was given

```text
A. One copy per workspace, keyed with workspace_id, the option built.
```

### The item, as it was raised

```text
---
id: s1-02-statistics-keys-per-workspace
prd: 612
slice: s1
rank: high
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Two workspaces could track the same repository. Should each keep its own copy of that repository's pull requests, or should they share one?

## The decision, in plain words

Each workspace keeps its own copy: a pull request is stored once per workspace that tracks its repository, and only for a repository that workspace lists.

## The intro, for fun

Two workspaces walk into the same repository.

## The punchline, for fun

Each leaves with its own receipt.

## The options, in plain words

A. One copy per workspace, keyed with workspace_id, the option built.
B. One shared copy per repository, keyed on repo and number, read through the workspaces that track it.

## What I had to decide

The keys of pull_requests (workspace_id, repo, number) and pull_request_reviews (workspace_id, repo, number, reviewer), and their foreign keys to repositories and pull_requests, where the spec says unique on repo and number.

## What I did meanwhile

Keys include workspace_id, so row-level security stays one is_member check per row, and a foreign key ties each pull request to a listed repository (lower-case owner/name), with cascade on delete.

## What it costs to change later

Changing the keys later is a migration on two tables the collector writes; while they are empty, a cheap one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's unique on repo and number meant across workspaces (author)

```

<!-- /omni-outbox-settled: s1-02-statistics-keys-per-workspace -->
