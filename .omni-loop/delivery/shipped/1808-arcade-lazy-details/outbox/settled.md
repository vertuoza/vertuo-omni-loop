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

<!-- omni-outbox-settled: s4-01-chart-failed-read-menu-row -->

## s4-01-chart-failed-read-menu-row — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-chart-failed-read-menu-row
prd: 1808
slice: s4
rank: medium
bears-on: none
raised: 2026-10-13
wave: 3
---

## The question, in plain words

When the star chart could not be read, what should the menu's STAR CHART row say, and should its door still open?

## The decision, in plain words

The row shows no tally until the chart has been read, a failed read included, and its door stays open: opening the chart again asks for it again, and the chart itself says it is out of reach.

## The intro, for fun

The star chart missed its first appointment, and the menu had to decide what to tell visitors.

## The punchline, for fun

It kept the door open and said nothing rude: the next knock asks again.

## The options, in plain words

A. A. Blank row, door open, the next open retries (as built)
B. B. OUT OF REACH on the row after a failed read, the door still open to retry
C. C. OUT OF REACH on the row and the door closed until the game is reloaded

## What I had to decide

Whether a failed read of the crew's star chart shows OUT OF REACH on the menu's row and closes its door, or leaves the row blank with the door open so the next open retries.

## What I did meanwhile

The page tells the game only that the crew's chart is to be read when it opens. Until a read succeeds the row has no tally and the door opens on the chart, which shows LOADING then the chart, or THE STAR CHART IS OUT OF REACH when the read failed.

## What it costs to change later

One branch of one function: a different answer changes the row's words and the door's rule, with a test each; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the row shows no tally until the chart has been read, and that a failure is not kept; it does not say what the row shows after a failed read.

```

<!-- /omni-outbox-settled: s4-01-chart-failed-read-menu-row -->

<!-- omni-outbox-settled: s3-01-law-30-test-file-changes -->

## s3-01-law-30-test-file-changes — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-13T11:55:43Z
- Channel: feature pull request #1810
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1810#issuecomment-6144976542
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-30
- Raised: 2026-10-13
- Slice: s3
- Wave: 2
- Stays here: the answer approves where this PRD's tests sit in the law's proof file; the law itself and its check are unchanged, and it states nothing lasting about the product or the playbook

### The answer, as it was given

```text
A. A. Keep the new checks beside the rule's check in the same file, the rule's check unchanged (as built)
```

### The item, as it was raised

```text
---
id: s3-01-law-30-test-file-changes
prd: 1808
slice: s3
rank: high
bears-on: BR-PRODUCT-30
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The file that proves the arcade's rule about people it cannot place (they still read as crew, with the galaxy out of reach) had to change, because the game no longer reads every planet's dossier on load. Is it right that the dossier checks in that file were replaced, while the rule's own check stays as it was?

## The decision, in plain words

The rule's own check is untouched and still passes. The old checks that the first load reads every dossier were replaced by checks that it reads none and sends planets without their logs.

## The intro, for fun

The rule's proof lives in a busy house, and the dossier tenants just moved out.

## The punchline, for fun

The rule kept its room and its key; only the neighbours changed.

## The options, in plain words

A. A. Keep the new checks beside the rule's check in the same file, the rule's check unchanged (as built)
B. B. Move the new first-load checks to a file of their own, so the rule's proof file only loses the old dossier checks

## What I had to decide

Whether the rule's proof file may change around the rule's own check, as built, or whether the new checks should live in a file of their own.
Decided by: Jev (hardToRevert 0.56) · agent said true

## What I did meanwhile

The rule's check runs as before and passes. The file's dossier section now proves the first load reads no dossier, and every planet arrives with an empty log.

## What it costs to change later

Moving the new checks to a file of their own is a small test-only change: one new file, one section removed, no product change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Nothing says whether a rule's proof file may hold checks of other behaviour that change later; the testing form allows it as long as the rule's own checks stay.

```

<!-- /omni-outbox-settled: s3-01-law-30-test-file-changes -->

<!-- omni-outbox-settled: s3-02-law-92-test-file-loses-old-reads -->

## s3-02-law-92-test-file-loses-old-reads — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-13T11:55:43Z
- Channel: feature pull request #1810
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1810#issuecomment-6144976542
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-92
- Raised: 2026-10-13
- Slice: s3
- Wave: 2
- Stays here: the answer approves where this PRD's tests sit in the law's proof file; the law itself and its check are unchanged, and it states nothing lasting about the product or the playbook

### The answer, as it was given

```text
A. A. Remove the old read's checks with the read, the rule's checks unchanged (as built)
```

### The item, as it was raised

```text
---
id: s3-02-law-92-test-file-loses-old-reads
prd: 1808
slice: s3
rank: high
bears-on: BR-PRODUCT-92
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The file that proves the dashboard counts only PRDs and fixes also held the checks of the old read of every planet's dossier at once, which the game no longer uses. Is it right that those old checks left the file with the read they tested, while the dashboard rule's own checks stay as they were?

## The decision, in plain words

The old read of every planet's dossier is gone, and its checks with it. The dashboard rule's checks and the demo dossiers' checks in that file are unchanged and pass.

## The intro, for fun

Spring cleaning in the dossier drawer: one old tool out, the rule's tools untouched.

## The punchline, for fun

Nothing the dashboard counts on was thrown away.

## The options, in plain words

A. A. Remove the old read's checks with the read, the rule's checks unchanged (as built)
B. B. Also add a check that the old read no longer exists

## What I had to decide

Whether removing the old read's checks from the rule's proof file is fine, as built, or whether that file should keep a check that the old read stays gone.
Decided by: Jev (hardToRevert 0.48) · agent said true

## What I did meanwhile

The dashboard rule's checks run as before and pass; the game reads one planet's dossier at a time when it is opened, through the read the planet's page already proves.

## What it costs to change later

Adding a check back is a test-only change of a few lines; bringing the old read back would undo the faster first load.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan asks for the old read to be gone but does not say what its proof file keeps.

```

<!-- /omni-outbox-settled: s3-02-law-92-test-file-loses-old-reads -->

<!-- omni-outbox-settled: s4-02-law-48-test-file-gains-chart-checks -->

## s4-02-law-48-test-file-gains-chart-checks — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-13T11:55:43Z
- Channel: feature pull request #1810
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1810#issuecomment-6144976542
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-48
- Raised: 2026-10-13
- Slice: s4
- Wave: 3
- Stays here: the answer approves where this PRD's tests sit in the law's proof file; the law itself and its check are unchanged, and it states nothing lasting about the product or the playbook

### The answer, as it was given

```text
A. A. Keep the two new checks beside the menu's other star chart checks, the rule's check unchanged (as built)
```

### The item, as it was raised

```text
---
id: s4-02-law-48-test-file-gains-chart-checks
prd: 1808
slice: s4
rank: high
bears-on: BR-PRODUCT-48
raised: 2026-10-13
wave: 3
---

## The question, in plain words

The file that proves the menu's rule about a workspace with no fleets also holds the menu's star chart checks, and it gained two of them. Is it right to add them there, with the rule's own check left as it was?

## The decision, in plain words

The rule's own check is untouched and still passes. Two checks were added beside the other star chart checks: the row shows no tally until the chart has been read, and its door opens before the chart is read.

## The intro, for fun

The rule's proof shares a house with the star chart's checks, and two new ones just moved in.

## The punchline, for fun

The rule's room is as it was; the new neighbours only talk about the stars.

## The options, in plain words

A. A. Keep the two new checks beside the menu's other star chart checks, the rule's check unchanged (as built)
B. B. Move the menu's star chart checks to a file of their own, so the rule's proof file holds only menu checks that never touch the chart

## What I had to decide

Whether new checks of the menu's star chart row may sit in the same file as the proof of the no-fleets rule, as built, or move to a file of their own.
Decided by: Jev (hardToRevert 0.70) · agent said true

## What I did meanwhile

The rule's check runs as before and passes. The file's star chart section now also proves the row's empty tally before the chart is read and its open door.

## What it costs to change later

Moving the two checks to a file of their own is a small test-only change, with no product change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Nothing says whether a rule's proof file may gain checks of other behaviour; the testing form allows it as long as the rule's own checks stay.

```

<!-- /omni-outbox-settled: s4-02-law-48-test-file-gains-chart-checks -->
