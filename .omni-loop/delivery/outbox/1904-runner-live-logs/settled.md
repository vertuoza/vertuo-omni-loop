# Settled outbox items — PRD 1904

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-lines-check-not-in-workflow -->

## s2-01-lines-check-not-in-workflow — adopted

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
id: s2-01-lines-check-not-in-workflow
prd: 1904
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new database check that proves only team members can read a job's live lines is written, but the automatic database run does not start it yet, because that file lies outside this slice's area.

## The decision, in plain words

The check was written and left for the wave to switch on in the automatic database run after this slice merges, rather than reaching outside the slice to do it here.

## The intro, for fun

A smoke alarm is only useful once someone puts in the battery.

## The punchline, for fun

The alarm is on the ceiling; the battery is one line away.

## The options, in plain words

A. A. Leave it to the wave, which switches the check on after this slice merges (as built).
B. B. Have this slice switch the check on itself, outside its own area.
C. C. Fold the new checks into the runners check the automatic run already starts.

## What I had to decide

Add one step running supabase/checks/runner_job_lines.sql to .github/workflows/supabase.yml, beside the runners check, on the feature branch once s2 merges.

## What I did meanwhile

Until that step exists, the access rules of runner_job_lines are pinned as text by apps/galaxy/src/runners/runners.migration.test.ts, but not proven against a database in CI.

## What it costs to change later

One step of the workflow, a few seconds per run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The check was not run against a local database here: no Supabase or Docker daemon was available (author).

```

<!-- /omni-outbox-settled: s2-01-lines-check-not-in-workflow -->

<!-- omni-outbox-settled: s2-02-fake-store-outside-territory -->

## s2-02-fake-store-outside-territory — adopted

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
id: s2-02-fake-store-outside-territory
prd: 1904
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The tests of the stored lines run against an in-memory copy of the database that lives in a test-only folder next to the slice's files, but not in the list of files this slice may change.

## The decision, in plain words

The in-memory copy was extended with the stored lines, since every service and page test of the runners reads it, rather than writing a second copy inside the slice's own files.

## The intro, for fun

The rehearsal stage sits one door down from the one on the floor plan.

## The punchline, for fun

Same play, same actors, just a different room number.

## The options, in plain words

A. A. Extend the shared in-memory copy (as built).
B. B. Keep a second in-memory copy for the lines inside the slice's own test files.

## What I had to decide

Adopt: apps/galaxy/src/runners/fixtures/store.fake.ts belongs to the runners area as much as runners.* does.

## What I did meanwhile

The fake holds the lines with the same rules as the migration: added once each, trimmed, kept for the 50 most recent ended jobs.

## What it costs to change later

None: a test fixture, shipped in no build.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None known: the fake follows the migration's rules, and the migration's own check proves them against a database once the workflow runs it.

```

<!-- /omni-outbox-settled: s2-02-fake-store-outside-territory -->
