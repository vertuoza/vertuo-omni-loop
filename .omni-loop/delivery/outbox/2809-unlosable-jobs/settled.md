# Settled outbox items — PRD 2809

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-budget-drops-the-bundle -->

## s2-01-budget-drops-the-bundle — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-budget-drops-the-bundle
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When a runner has too many saved jobs on its disk, should the oldest save go whole, or should only its big folder go while its small saved copy stays?

## The decision, in plain words

The oldest save goes whole: its folder and its saved copy are both removed, and its record says what was lost, as the design describes.

## The intro, for fun

Every disk fills up one day, and somebody has to choose what gets thrown out first.

## The punchline, for fun

Spring cleaning, with a receipt for everything that went in the bin.

## The options, in plain words

A. A. The oldest save goes whole, folder and bundle; its manifest names what was lost (built)
B. B. Only the folder goes; the bundle stays until its keep date, so nothing committed or uncommitted is lost, only ignored files
C. C. The bundle goes first and the folder stays, since the folder alone can still be pushed by hand

## What I had to decide

Keep A, or choose B: on a runner over its keep budget, remove only the oldest kept folder and keep its bundle (a few MB) until its keep date, so the resume can still take the work back.

## What I did meanwhile

Over `--keep-budget`, `keepWithin` (kit/lib/runner/sweep.ts) removes the oldest kept folder and its bundle `<folder>.checkpoint.bundle`, and rewrites its manifest with `lost: { at, why }`; the manifest stays until `keepUntil`. Both the folder and the bundle count toward the budget.

## What it costs to change later

A constant: B is a few lines in `dropKept` (keep the bundle, count its bytes only) and a test change. No stored shape changes: the manifest already carries `bundle` and `bundleBytes`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person reads "the oldest kept folder is removed" as the save going, or only the folder (author)

```

<!-- /omni-outbox-settled: s2-01-budget-drops-the-bundle -->

<!-- omni-outbox-settled: s2-02-snapshot-author -->

## s2-02-snapshot-author — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-snapshot-author
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When the runner saves a job's unfinished edits as a commit, whose name should that commit carry when the runner no longer knows which app the job ran as?

## The decision, in plain words

The commit carries the job's app when the runner knows it. When it does not, after a restart, it carries the runner's own name, never a person's.

## The intro, for fun

A note left on the fridge still needs a signature, even when the writer has left the house.

## The punchline, for fun

Signed: the robot who tidied up, and nobody pretending otherwise.

## The options, in plain words

A. A. The job's app when known, else the runner's own name and an address that cannot receive mail (built)
B. B. Always the job's app, its name kept on the runner for the sweep after a restart
C. C. Always the runner's own name, so every snapshot reads as the runner's

## What I had to decide

Keep A, or choose B: sign a snapshot made after a restart as the job's app too, by keeping the app's name and email in the job's token file while it runs.

## What I did meanwhile

`saveJob` (kit/lib/runner/checkpoint.ts) authors the snapshot commit with `job.github`'s login and email at a job's end; for a folder the sweep finds after a restart it uses `omni runner <name>` <`<name>@runner.omni.invalid`>. A resume that fast-forwards onto the snapshot pushes that commit, so the name shows on GitHub.

## What it costs to change later

A constant: B adds the login and email to the token file the runner already writes per job and reads them back in the sweeper. No stored shape on the server changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a commit signed by an `.invalid` address is refused by any repository's push rules (author)

```

<!-- /omni-outbox-settled: s2-02-snapshot-author -->

<!-- omni-outbox-settled: s2-03-failed-save-keeps-folder -->

## s2-03-failed-save-keeps-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-failed-save-keeps-folder
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

If the runner tries to save a job's unfinished work and the save itself breaks, should it keep the job's folder anyway, or remove it as it did before this feature?

## The decision, in plain words

It keeps the folder, with a note saying the save failed and why. The folder still goes after seven days, or sooner when the disk budget is full.

## The intro, for fun

Sometimes the box you were packing breaks before the move is finished.

## The punchline, for fun

So the furniture stays in the old flat, with a note on the door.

## The options, in plain words

A. A. Keep the folder, its manifest saying the save failed (built)
B. B. Remove the folder as before, the failure printed only
C. C. Keep the folder and stop the runner taking new jobs until a person looks

## What I had to decide

Keep A, or choose B: a save that fails removes the folder as before, and only the runner's printed line says so.

## What I did meanwhile

`saveJob` (kit/lib/runner/checkpoint.ts) catches any failure of the listing, snapshot or bundle, writes the manifest with `bundle: null`, `branches: []` and `failed: 'the save failed: <first line of the error>'`, and keeps the folder; it counts toward the keep budget and goes at its keep date like any kept folder.

## What it costs to change later

A constant: B is one branch in `saveJob`. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a save should be tried again on a later sweep: today a folder kept after a failed save is never saved again, and goes at its keep date (author)

```

<!-- /omni-outbox-settled: s2-03-failed-save-keeps-folder -->

<!-- omni-outbox-settled: s1-02-cancel-asked-not-resumed -->

## s1-02-cancel-asked-not-resumed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-cancel-asked-not-resumed
prd: 2809
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When someone asks to stop a running job and its machine dies before the job stops, should the job start again on another machine?

## The decision, in plain words

It does not start again: a job someone asked to stop is never resumed, even when its machine is lost before it stopped.

## The intro, for fun

Someone pressed stop, then the machine fell asleep mid-sentence.

## The punchline, for fun

Waking it up somewhere else would ignore the one wish we had in writing.

## The options, in plain words

A. A. A job whose cancel was asked is never resumed, even when its runner is lost first.
B. B. A lost job is resumed whatever was asked; a person cancels the resume if they still want it stopped.

## What I had to decide

The spec lists a cancelled job among those never resumed, and a loss among those always resumed; it does not say which wins for a running job whose cancel was asked (cancel_requested set, its runner not yet stopped) and whose runner is then lost. The trigger reads `new.cancel_requested` and queues nothing then, so a person's cancel is never undone by a resume.

## What I did meanwhile

runner_job_resume_lost() returns before queuing when `cancel_requested` is true; supabase/checks/runner_resume.sql proves it (Q1, cancel asked, then lost with its runner: no resume).

## What it costs to change later

One condition in the trigger's function, changed by a follow-up migration; no row to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person ever asks to cancel a job hoping it restarts elsewhere is not known. (author)

```

<!-- /omni-outbox-settled: s1-02-cancel-asked-not-resumed -->
