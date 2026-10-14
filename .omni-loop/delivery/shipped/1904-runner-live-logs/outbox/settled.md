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

<!-- omni-outbox-settled: s3-01-long-lines-cut-on-the-runner -->

## s3-01-long-lines-cut-on-the-runner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-long-lines-cut-on-the-runner
prd: 1904
slice: s3
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

A job's log can hold a line longer than the app stores, such as raw install output. The spec says the app refuses such lines but not what the runner does with them, and a refused report would stop the runner.

## The decision, in plain words

The runner cuts any line longer than the app stores to that length before it sends it, so a report is never refused for a long line. The full line stays in the log on the machine.

## The intro, for fun

Some log lines arrive wearing a very long scarf.

## The punchline, for fun

We trim the scarf at the door; the rest stays in the closet.

## The options, in plain words

A. A. The runner cuts a line too long for the app to the app's length before sending it (as built).
B. B. The app accepts any line and cuts it itself, so an older runner never trips on a long line.

## What I had to decide

Whether a line too long for the app is cut by the runner (as built), or the app should accept and cut it itself.

## What I did meanwhile

Long lines show cut in the Terminal panel; the whole line is still in the job's log file on the runner.

## What it costs to change later

One constant on the runner: changing the length or moving the cut to the app is a small change, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The cut keeps the first 600 characters; whether a marker should show the line was cut was not decided (author).

```

<!-- /omni-outbox-settled: s3-01-long-lines-cut-on-the-runner -->

<!-- omni-outbox-settled: s4-01-unlisted-job-link-reads-nothing -->

## s4-01-unlisted-job-link-reads-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-unlisted-job-link-reads-nothing
prd: 1904
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

When someone opens a shared Terminal link for a job the Runners page no longer lists, the spec does not say whether the panel should still try to read that job's log.

## The decision, in plain words

The panel opens and says the job's log was cleared, without asking the server for any line, since a job that left the page keeps no lines.

## The intro, for fun

An old link to a job that has since left the building.

## The punchline, for fun

The panel waves politely at the empty room and says so.

## The options, in plain words

A. A. Say the log was cleared and read nothing (as built).
B. B. Read the server anyway, and say cleared only when it answers no line.
C. C. Not open the panel at all, and drop the parameter from the address.

## What I had to decide

Keep A, or choose B to read the server anyway and show whatever it answers.

## What I did meanwhile

A link to a job no longer listed opens the panel with the cleared line and no reads.

## What it costs to change later

One condition in the panel; changing it is a one-line edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec says an unlisted job holds no lines, and the screen says Cleared when the job is no longer listed.

```

<!-- /omni-outbox-settled: s4-01-unlisted-job-link-reads-nothing -->

<!-- omni-outbox-settled: s4-02-terminal-replaces-history-entry -->

## s4-02-terminal-replaces-history-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-terminal-replaces-history-entry
prd: 1904
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

Opening and closing the Terminal panel changes the page's address, and the spec does not say whether the browser's Back button should close the panel.

## The decision, in plain words

Opening or closing the panel rewrites the current address in place, so Back leaves the Runners page as before and never just closes the panel.

## The intro, for fun

Every panel opened could have left a breadcrumb in the browser's history.

## The punchline, for fun

No breadcrumbs: Back still means back.

## The options, in plain words

A. A. Rewrite the address in place; Back leaves the page (as built).
B. B. Add a history entry per opening, so Back closes the panel first.

## What I had to decide

Keep A, or choose B so that Back closes an open panel.

## What I did meanwhile

Back leaves the page; Escape or the close button closes the panel.

## What it costs to change later

One call in the panel; switching is a one-word edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec only says opening sets the parameter and closing removes it.

```

<!-- /omni-outbox-settled: s4-02-terminal-replaces-history-entry -->
