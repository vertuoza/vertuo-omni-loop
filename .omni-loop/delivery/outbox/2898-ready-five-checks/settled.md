# Settled outbox items — PRD 2898

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-ready-label-made-by-a-person -->

## s1-01-ready-label-made-by-a-person — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-ready-label-made-by-a-person
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The new label that starts the full checks on a draft has to exist before a skill can put it on a pull request. Should the install create it with the other loop labels, or a person once per repository?

## The decision, in plain words

A person creates it, as for the label a runner puts on a dead claim. The setting may rename it and the kit reads the usual name when it is left out, so turning the gate on is one label to make by hand.

## The intro, for fun

A label nobody created is a sticker with no glue.

## The punchline, for fun

For now, a person brings the glue.

## The options, in plain words

A. A person creates the label once; the kit reads its usual name: what was built.
B. Create it at install with the other loop labels, with the yes of the locked install law's owner.

## What I had to decide

`labels.readyCheck` is new. Created at install, it needs a style in `kit/lib/init/labels.ts` and new names in `kit/bin/init.test.ts` and `kit/bin/update.test.ts`: none of them is in s1's territory, and `kit/bin/init.test.ts` proves the locked N-PRODUCT-13, whose file stays its owner's. PRD 2175 met the same choice for `labels.released` and made the key optional. Optional, `omni config labels` does not print it when it is not set, which s1's done-when listed.

## What I did meanwhile

`labels.readyCheck` is optional; `readyCheckLabel()` reads `DEFAULT_READY_CHECK_LABEL` (`omni:ready-check`) when it is left out. `omni init` does not create it. s4, which adds the label, may create it when it is missing, or name it as a human step.

## What it costs to change later

Creating it at install is a style line, the label in two install test lists (one of them a locked law's proof, so its owner's yes) and the key defaulted.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s4 should create the label itself when it is missing, rather than name it as a human step

```

<!-- /omni-outbox-settled: s1-01-ready-label-made-by-a-person -->

<!-- omni-outbox-settled: s1-02-excuses-flag-tests-own-file -->

## s1-02-excuses-flag-tests-own-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-excuses-flag-tests-own-file
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
excuses: [kit/bin/item-excuses.test.ts]
---

## The question, in plain words

The tests of the new way to name the exact files a question excuses needed a home. The existing test file of that command proves a locked rule, so may they live in a new file beside it?

## The decision, in plain words

Yes. They sit in a new test file of their own next to the command's tests, and the file that proves the locked rule is left exactly as it was.

## The intro, for fun

Two roommates, one sacred shelf.

## The punchline, for fun

The new tests got their own shelf.

## The options, in plain words

A. Keep the new tests in a file of their own beside the command's tests: what was built.
B. Fold them into the file that proves the locked rule, with its owner's yes.

## What I had to decide

`omni item new --excuses <path>` is tested through `main()`, as every command is. `kit/bin/item.test.ts` is in s1's territory, but it proves N-PRODUCT-3, and the testing form keeps a law's proof file its owner's: tests of other behaviour go in a file of their own. The plan names no other test file for the command.

## What I did meanwhile

Wrote `kit/bin/item-excuses.test.ts` beside it, outside s1's territory; this item names it in its excuses field. `kit/bin/item.test.ts` is untouched.

## What it costs to change later

Moving the tests is a file rename, or folding them into the proof file once its owner agrees.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner of the locked rule would rather keep every test of the command in one file

```

<!-- /omni-outbox-settled: s1-02-excuses-flag-tests-own-file -->

<!-- omni-outbox-settled: s1-03-full-jobs-default-none -->

## s1-03-full-jobs-default-none — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-full-jobs-default-none
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The check that the full tests and lint ran needs the names of the jobs that run everything. What should it do in a repository that names none, and how does it recognise a job split into parallel parts?

## The decision, in plain words

A repository that names no job gets that check marked as not judged, with the reason, so it can never pass by accident. A job split into parts counts only when every part succeeded, and a job with another name never counts, even one with a similar name.

## The intro, for fun

Asked to check the full tests, the checker first asks which ones.

## The punchline, for fun

No answer, no pass.

## The options, in plain words

A. No job by default, so the check is not judged until a repository names its own: what was built.
B. Default to test and lint, the names this repository uses.
C. Also count a run whose name ends with the job's name, for jobs run through a shared workflow.

## What I had to decide

`ready.full` has no default the kit can know: job names are each repository's. With `[]` as the default, check 2 reads `not judged · ready.full names no CI job` (BL-GATE-1). A job's run is a check run named exactly the job (`test`) or a leg of its matrix (`test (1)`); `quick` and `test shard 1/3` are other jobs. This repository sets `ready.full: [test, lint]` in s10.

## What I did meanwhile

`ready.full` defaults to `[]`; check 2 matches a run by the job's exact name or by `<job> (`, and every leg must succeed.

## What it costs to change later

A default and one matching line in `kit/lib/ready/checks.ts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a repository runs its full suite under a job name that a reusable workflow prefixes, as caller / job, which this matching does not read

```

<!-- /omni-outbox-settled: s1-03-full-jobs-default-none -->

<!-- omni-outbox-settled: s1-04-loosening-reads-per-file -->

## s1-04-loosening-reads-per-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-loosening-reads-per-file
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The check that no test was loosened has to decide how closely it reads a change. Should it count tests and assertions file by file, treat a new timeout as a raised one, and read the quality floors and baselines where this repository keeps them?

## The decision, in plain words

It counts file by file, so a test moved to another file reads as removed and a new timeout reads as raised, both leaning toward asking a person rather than letting something slip. It reads the floors and baselines where the spec names them, with no new setting for now.

## The intro, for fun

A detector that squints at one file at a time sees every crumb.

## The punchline, for fun

Some crumbs are just a test that moved house.

## The options, in plain words

A. Count file by file and read the floors and baselines where the spec names them: what was built.
B. Compare test counts across all changed files, so a moved test is no finding.
C. Make the floors and baselines a setting each repository fills in.

## What I had to decide

The spec lists the weakenings but not how they are measured. The detector (`kit/lib/ready/loosening.ts`) counts declarations, `expect(` calls, skip markers, suppressions and timeouts in each file at both ends, so a renamed test and a stronger assertion are clean, but a test moved between files fails check 4 until an item excuses it. A timeout key or a trailing test timeout new in a file counts as raised. The floor and baseline ground is `READY_LOOSENING_GROUND` in `kit/lib/config.ts` (`mutation/floor.json`, `fallow/`, `layering/`), the one file allowed to carry repository literals, not a config key: the spec names no setting for it.

## What I did meanwhile

Built the per-file detector, and the ground as a constant the rule reads unless its facts pass another.

## What it costs to change later

Comparing across files is a change inside the detector; a `ready.floors` and `ready.baselines` setting is one schema key each, the constant becoming their default.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often a pull request moves tests between files, which would make the per-file count ask more than it should

```

<!-- /omni-outbox-settled: s1-04-loosening-reads-per-file -->

<!-- omni-outbox-settled: s3-01-ready-mission-from-records -->

## s3-01-ready-mission-from-records — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-ready-mission-from-records
prd: 2898
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The command that checks a pull request is ready needs to know whether its PRD belongs to a running or paused mission, but only the Omni page knows a mission's state. Where should it read that from?

## The decision, in plain words

It reads the repository's own mission records and says whether one names the PRD. It cannot tell running from paused or finished, and the answer is only printed beside the verdict: it never changes the five checks.

## The intro, for fun

A mission is on the Omni page; the checkout only holds its postcard.

## The punchline, for fun

So the command reads the postcard and says so.

## The options, in plain words

A. A. Read the mission records of the repository and print the answer beside the verdict (built).
B. B. Ask the Omni page for the mission's state and hold when it cannot be reached.
C. C. Refuse to run omni ready outside a mission.

## What I had to decide

Print `ready.checks` and whether a mission record of this repository names the PRD, as one line, and leave the verdict to the five checks. The gate that calls omni ready decides whom to ask.

## What I did meanwhile

A PRD in a paused or finished mission reads as in a mission; the gate in s4 asks only for PRDs under ready.checks, so no pull request is held for it.

## What it costs to change later

A small page call later, if the state must be read: one function in kit/lib/mission/membership.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a mission's running or paused state is recorded by the Omni page; no kit command reads it yet. (author)

```

<!-- /omni-outbox-settled: s3-01-ready-mission-from-records -->

<!-- omni-outbox-settled: s7-01-report-read-from-acceptance-run-text -->

## s7-01-report-read-from-acceptance-run-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-report-read-from-acceptance-run-text
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The App reads the proof of each success criterion from the acceptance check the build writes on the latest commit, but the spec does not say where in that check the proof sits. Where should the App look?

## The decision, in plain words

It reads the proof from the check's detailed text, then its summary, written alone or in a block marked as JSON. With no proof there, the third check reads not finished or not judged, never passed.

## The intro, for fun

Two teams built a letterbox and a postman on the same day, without meeting.

## The punchline, for fun

We agreed the letters go through the slot, not the chimney.

## The options, in plain words

A. A. Read the proof from the check's detailed text, then its summary, alone or in a JSON block: what was built.
B. B. Read it only from the detailed text, as plain JSON, and treat anything else as unreadable.
C. C. Read it from a file the build keeps beside its run, not from the check itself.

## What I had to decide

The `acceptance` check run is written by s5 (CI) and by s8 (the runner fallback), in the same wave or a later one, so its shape was not settled when s7 was built. `apps/omni-app/src/ready-check/facts.ts` (`reportText`) reads `output.text` first, then `output.summary`, and takes the whole text when it starts with `{`, else the first fenced json block. The parse is the kit's `parseAcceptanceReport`, so a malformed report is `not judged · <why>`. s5 and s8 should write the report as the run's `output.text`, JSON alone, so `omni ready` (s3) and the App read it the same way.

## What I did meanwhile

Built the reader as above, with the AC-8 test writing the report as `output.text`. Nothing else in the App reads the run.

## What it costs to change later

One small function in one file, and its test: a constant's worth of change if s5 writes it elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether s5 writes the report in `output.text`, in an artifact, or in the summary; s3's reader must agree with it too

```

<!-- /omni-outbox-settled: s7-01-report-read-from-acceptance-run-text -->

<!-- omni-outbox-settled: s7-02-waiting-missions-gate-too -->

## s7-02-waiting-missions-gate-too — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-waiting-missions-gate-too
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

With the gate set to missions only, the App checks the PRDs of running or paused missions, but a mission can also be waiting on a person. Does a waiting mission count?

## The decision, in plain words

Yes: a mission waiting on a person is still under way, so its PRD keeps its ready check. Draft, delivered and stopped missions do not count.

## The intro, for fun

The bus stopped at a red light. Is it still on its route?

## The punchline, for fun

We said yes, and kept the passengers on board.

## The options, in plain words

A. A. A running, waiting or paused mission gates its PRDs: what was built.
B. B. Only a running or paused mission does, as the spec words it; a waiting one gets no check until it runs again.

## What I had to decide

The missions table holds `draft`, `running`, `waiting`, `paused`, `delivered` and `stopped` (`20270122093000_missions.sql`). The spec says "a running or paused mission". A mission most often waits on a person while its feature PR is open, which is when the check matters, so `LIVE_MISSIONS` in `apps/omni-app/src/ready-check/store.ts` is `running`, `waiting`, `paused`. s3 decides the same for `omni ready` in `kit/lib/mission/`; the two should agree.

## What I did meanwhile

Built the store with the three states and a test pinning the query.

## What it costs to change later

One constant and one test line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the spec's "running or paused" meant to leave a waiting mission out
- (author) what s3 reads as a live mission for `omni ready`

```

<!-- /omni-outbox-settled: s7-02-waiting-missions-gate-too -->

<!-- omni-outbox-settled: s7-03-ready-check-refreshes-when-ci-ends -->

## s7-03-ready-check-refreshes-when-ci-ends — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-ready-check-refreshes-when-ci-ends
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The spec runs the App's ready check on each new commit, when the build has barely started, so it would read not finished until the next commit. Should it also run when the build ends?

## The decision, in plain words

Yes: when a group of checks finishes on a pull request's latest commit, the App runs its ready check again. When the result has not changed it posts nothing new, so it never repeats itself.

## The intro, for fun

A referee who blows the whistle before the match starts is not much of a referee.

## The punchline, for fun

Ours now waits for the final whistle, and only speaks when the score changed.

## The options, in plain words

A. A. Run the check again when a group of checks finishes on the head, posting only a change: what was built.
B. B. Run it on new commits, labels and reviews only, as the spec words it.
C. C. Run it again only when the build's own checks finish, never the App's.

## What I had to decide

The App already receives `check_suite.completed` (for the touches and the main watch), so no subscription changes. `toReadyRefreshes` in `apps/omni-app/src/webhook/webhook.ts` refreshes the `pr-ready` job of each pull request a completed suite names, into the default branch only. The App's own suite completing refreshes it too; `postReady` in `apps/omni-app/src/ready-check/ready-check.ts` reads the latest `omni / ready` run of the commit and posts nothing when it would say the same, so it never loops, and it updates a run still in progress rather than adding one. The ledger debounces refreshes of one pull request into one run.

## What I did meanwhile

Built both, with tests: a completed suite refreshes the ready job alone, a sub-PR's suite refreshes nothing, and a second run with the same verdict writes nothing.

## What it costs to change later

One filter in the webhook and its test; taking it out leaves the check refreshed by pushes, labels and reviews only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how much GitHub budget the extra runs spend on a busy repository: each run of an ungated pull request reads its pull request and its base's settings, about six calls

```

<!-- /omni-outbox-settled: s7-03-ready-check-refreshes-when-ci-ends -->

<!-- omni-outbox-settled: s7-04-not-finished-shows-in-progress -->

## s7-04-not-finished-shows-in-progress — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-04-not-finished-shows-in-progress
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

When the verdict is not finished, how should the App's ready check look on the pull request, knowing it must never look green?

## The decision, in plain words

While evidence is still coming it shows as in progress and is updated in place; when nothing more will come and a check could not be judged, it shows as neutral. Ready is green, not ready is red.

## The intro, for fun

A kettle that is not boiling yet is neither hot nor cold.

## The punchline, for fun

So we gave it a little yellow light instead of a thumbs-up.

## The options, in plain words

A. A. In progress while evidence comes, neutral when only not judged, green and red otherwise: what was built.
B. B. The same, but not judged shows red, so a required check holds the pull request.
C. C. Every not finished verdict shows neutral, never in progress.

## What I had to decide

`runState` in `apps/omni-app/src/ready-check/output.ts`: `ready` completed `success`, `not ready` completed `failure`, `not finished` with any check `not finished` as `in_progress`, else completed `neutral`. GitHub reads `neutral` as passing for a required check, so a repository that made `omni / ready` required would let a not judged verdict through; the kit's own gate is `omni ready`, which leaves this check out. The sweep's delayed post (`apps/omni-app/src/jobs/delayed.ts`) does not cover `pr-ready`: it would post on pull requests whose gate is off.

## What I did meanwhile

Built as above, with tests of each state and of a run in progress completed in place.

## What it costs to change later

A table of four rows in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person would rather see not judged as red, so a required check holds it

```

<!-- /omni-outbox-settled: s7-04-not-finished-shows-in-progress -->

<!-- omni-outbox-settled: s7-05-database-check-needs-its-ci-step -->

## s7-05-database-check-needs-its-ci-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-05-database-check-needs-its-ci-step
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The new database check proves only workspace members read the ready verdicts and only the App writes them, but the build runs each database check by name from a file outside this slice's area. Who adds the line that runs it?

## The decision, in plain words

The slice wrote the check and ran it by hand on a local database, where it passed, and left the build's file alone. It runs in the build once someone adds its line there.

## The intro, for fun

We installed a smoke alarm and tested the button ourselves.

## The punchline, for fun

Someone still has to wire it to the building's panel.

## The options, in plain words

A. A. Leave the build's file to the wave or a later slice, the check committed and proven by hand: what was built.
B. B. Add the line in this slice, outside its area, with an item excusing that file.

## What I had to decide

`.github/workflows/supabase.yml` lists every `supabase/checks/*.sql` as its own step; it is in no slice's territory of PRD 2898. s7 ran `supabase/checks/ready_verdicts.sql` with the migration in one rolled-back transaction on the local database: it passed and left nothing behind. The step to add, after the missions check: `run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/ready_verdicts.sql`. The wave, or s10, may add it with an item that excuses the workflow file.

## What I did meanwhile

Left the workflow untouched; the check is committed and passes locally.

## What it costs to change later

Two lines in one workflow file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the wave adds the step when it merges, or a person prefers s10 to

```

<!-- /omni-outbox-settled: s7-05-database-check-needs-its-ci-step -->

<!-- omni-outbox-settled: s5-01-acceptance-check-carries-the-report -->

## s5-01-acceptance-check-carries-the-report — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-acceptance-check-carries-the-report
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The proof of each success criterion travels as a check on the latest change, and the ready gate and the Omni App read it from there. Where in the check does the proof sit, and who writes the check when a runner, not the continuous checks, still has to run the screen tests?

## The decision, in plain words

The check carries the full proof as its detailed text, with a short table on top for people. When the screen tests wait on a runner, the continuous checks write no check at all and keep the proof as a downloadable file, so the App writes the one check once the runner is done.

## The intro, for fun

Two couriers, one parcel, and a label that says who signs for it.

## The punchline, for fun

Whoever finishes last seals the box.

## The options, in plain words

A. The check's detailed text is the proof; while a runner still has to run the screen tests, no check is written and the proof is kept as a file for the App: what was built.
B. Always write the check from the continuous checks, marked as waiting, and let the App add a second one once a runner is done.

## What I had to decide

s1's `kit/lib/ready/report.ts` fixes the report's format and the check run's name, `acceptance`, but not where in the check run the report sits; s3 (`omni ready`'s `gh` reader) and s8 (the App's runner fallback) read it, in the same wave or later. A check run can only be completed by the app that created it, and the ready rule's check 1 counts every check run of the head commit: a run CI left going for a runner would stay `in_progress` there forever, and a second `acceptance` from the App would sit beside it.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

`scripts/acceptance-report.ts post` writes the check run `acceptance` with `output.text` the report exactly as `renderAcceptanceReport` prints it (so `parseAcceptanceReport(output.text)` reads it), `output.summary` one table row per criterion, conclusion `success`, `failure` or `neutral` (no `AC-<n>` criterion). When an `e2e` criterion is `pending` (`e2e.ci` false, no key, no `e2e.url`), it posts nothing and the `acceptance-report` artifact of the `checks` run holds the report for s8.

## What it costs to change later

The few lines of `postCheckRun` and `verdictOf` in `scripts/acceptance-report.ts`, and the readers s3 and s8 write against them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how s3 and s8, built beside this slice, read the check run: if either expects the report elsewhere, one of them changes

```

<!-- /omni-outbox-settled: s5-01-acceptance-check-carries-the-report -->

<!-- omni-outbox-settled: s5-02-e2e-folder-a-workspace -->

## s5-02-e2e-folder-a-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-e2e-folder-a-workspace
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
excuses: [pnpm-workspace.yaml]
---

## The question, in plain words

The end-to-end test tool needs a home with its own list of packages, and the plan let this slice change that folder but not the file that names the parts of the repository. May that file name the new folder too?

## The decision, in plain words

Yes. The test folder is declared as one more part of the repository, with one added line, the way the kit's own guide for end-to-end tests says to set it up.

## The intro, for fun

A new room in the house needs a line on the floor plan.

## The punchline, for fun

One line, and the movers know where the boxes go.

## The options, in plain words

A. Declare the test folder as a part of the repository, with one line in the file that lists them: what was built.
B. Install the test tool with the repository's own packages instead, and keep only its settings in the test folder.

## What I had to decide

The spec says the e2e package is installed with its config in `e2e/`, and the plan gives s5 `e2e/`, `package.json` and `pnpm-lock.yaml`, but not `pnpm-workspace.yaml`. pnpm reads its workspaces only from `pnpm-workspace.yaml`, and `/omni:validate-e2e` (step 4) declares `e2e.dir` a workspace with its own `package.json`, since the dependency gate refuses a folder with its own manifest that is not one. Installing the framework in the root `package.json` instead would keep the edit inside the territory, but `/omni:validate-e2e` would then find no `e2e/package.json` and set the project up again.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Added `- 'e2e'` to the `packages` of `pnpm-workspace.yaml`, beside a comment; `e2e/package.json` is `@omni/e2e`, with `e2e`, `@e2e-dev/web`, `@e2e-dev/html-reporter`, `@openrouter/ai-sdk-provider` and `ai` at exact versions. The lockfile gained the new workspace's lines; its existing peers resolved to `@opentelemetry/api` 1.9.0, a version the lockfile already held.

## What it costs to change later

One line in `pnpm-workspace.yaml` and the workspace's lockfile lines; moving the framework to the root `package.json` instead is a few lines there and a reinstall.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the maintainers want the e2e framework installed on every machine that installs the repository, as a workspace makes it

```

<!-- /omni-outbox-settled: s5-02-e2e-folder-a-workspace -->

<!-- omni-outbox-settled: s5-03-preview-script-reads-the-label -->

## s5-03-preview-script-reads-the-label — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-preview-script-reads-the-label
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
excuses: [scripts/preview-debounce.sh]
---

## The question, in plain words

The preview of a pull request is built by a small script that refuses every draft, and the plan let this slice change the workflow that calls it but not the script. May the script let a draft through when it carries the label that asks for the full checks?

## The decision, in plain words

Yes. The script now reads the pull request's labels and builds the preview of a draft that carries that label, and still refuses every other draft.

## The intro, for fun

The doorman let only finished guests in.

## The punchline, for fun

Now a guest with the right badge gets in early.

## The options, in plain words

A. Let the script build a labelled draft's preview: what was built.
B. Leave the script as it was and build the labelled draft's preview from a second script of this slice.

## What I had to decide

s5's done-when asks that a draft labelled `omni:ready-check` runs the preview. `.github/workflows/preview-debounce.yml` is in the territory, but `scripts/preview-debounce.sh` stops on any draft (`stop "a draft"`), before the wait and again after it, and is not. A second script would copy its wait, its project choice and its Vercel call.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

`scripts/preview-debounce.sh` reads the labels with the pull request (`read_pr` prints them fifth) and lets a draft through when they hold `PREVIEW_READY_LABEL`, default `omni:ready-check`, at both reads. Its tests in `scripts/preview-debounce.test.ts` cover a labelled draft, a draft labelled otherwise and a label removed while it waited.

## What it costs to change later

A few lines in `scripts/preview-debounce.sh` and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person would rather keep the preview script for ready pull requests only and give labelled drafts their own

```

<!-- /omni-outbox-settled: s5-03-preview-script-reads-the-label -->

<!-- omni-outbox-settled: s5-05-criterion-tests-from-changed-files -->

## s5-05-criterion-tests-from-changed-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-05-criterion-tests-from-changed-files
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

A success criterion is proven by a test that carries its number, but every feature numbers its criteria from one again, so an old feature's test could pass for this one's. Which tests count as proof?

## The decision, in plain words

Only tests in the test files this feature's pull request added or changed. A test written for an older feature never counts, even with the same number.

## The intro, for fun

Every class has a pupil number one.

## The punchline, for fun

Only this class's number one answers the roll call.

## The options, in plain words

A. Count only the numbered tests in files the pull request changed: what was built.
B. Count a numbered test only when its group of tests also names the feature, as the screen tests do with their tag.

## What I had to decide

The spec says a `test` criterion is proven by a vitest test titled `AC-n: …` that passed on the latest commit; it tags only the `e2e` tests with `prd-<n>`. Every PRD numbers its criteria from AC-1, and the whole suite runs on every graded commit, so a title alone matches other PRDs' tests.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

`scripts/acceptance-report.ts` takes an `AC-<n>: …` test from the shards' JSON reports only when its file is in `git diff --name-only <base>...<head>`, and only for numbers the spec holds; an `e2e` result only when tagged `prd-<n>`.

## What it costs to change later

One filter in `testResults` of `scripts/acceptance-report.ts`; a tag rule instead also needs `/omni:brainstorm` and the testing form to say how a test names its PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a criterion may be proven by a test an earlier pull request wrote, which this rule never counts

```

<!-- /omni-outbox-settled: s5-05-criterion-tests-from-changed-files -->

<!-- omni-outbox-settled: s5-06-labelled-draft-ready-runs-nothing -->

## s5-06-labelled-draft-ready-runs-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-06-labelled-draft-ready-runs-nothing
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Once a draft carries the label, its full checks and preview run on its latest change. When that draft is then marked ready, should they all run again on the same change?

## The decision, in plain words

No: marking a labelled draft ready runs nothing more, since its latest change was already checked in full, and any later change runs everything again. Adding any other label never runs or stops anything.

## The intro, for fun

The exam was taken on Friday.

## The punchline, for fun

Monday's diploma does not mean sitting it again.

## The options, in plain words

A. Run nothing more when a labelled draft is marked ready: what was built.
B. Run the full checks and the preview again when it is marked ready, as for any pull request.

## What I had to decide

The spec says the label starts the full checks, the e2e job and the preview on the draft's latest commit, again on each push, that only gated PRs pay for it, and that ready still comes last; it does not say what marking the draft ready does. The gate marks it ready only after five passes on that very commit. The `checks` workflow now hears `labeled`, so every other label would also start a run, and in a shared group a run that does nothing cancels the one that grades (issue 1167).

Decided by: Jev (hardToRevert 0.52) · agent said false

## What I did meanwhile

In `.github/workflows/checks.yml` and `.github/workflows/preview-debounce.yml`, `ready_for_review` on a labelled pull request, `labeled` with another label, and `labeled` on a pull request already ready run no job and sit alone in a concurrency group named by the run id; the graded runs share the `ready` group. The tests evaluate the expressions event by event.

## What it costs to change later

One clause in each workflow's gate and group, written twice per file, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person reading a ready pull request expects its checks to show as run on being marked ready

```

<!-- /omni-outbox-settled: s5-06-labelled-draft-ready-runs-nothing -->

<!-- omni-outbox-settled: s5-07-e2e-job-waits-for-settings -->

## s5-07-e2e-job-waits-for-settings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-07-e2e-job-waits-for-settings
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The screen tests run in the continuous checks only when the repository’s settings say so, and those settings are still off here, their change belonging to the last step of this feature. Should this step turn them on?

## The decision, in plain words

No: the screen-test job reads the settings and, while they are off, runs nothing and says why, so the proof waits for a runner. The last step of this feature turns them on, with the address of the previews and the secret that opens them.

## The intro, for fun

The oven is installed and plugged in.

## The punchline, for fun

Someone still has to turn the knob.

## The options, in plain words

A. Leave the settings to the last step and run nothing until they are on: what was built.
B. Turn the settings on in this step, outside its share of the work.

## What I had to decide

The spec builds e2e in CI here and s5's done-when calls the e2e job the one that runs AC-9's scenario, but `.omni-loop/config.yml` is s10's territory, and this repository's `e2e` block keeps `ci: false`, `url: null`, `deployment: null` and `bypassEnv: null`. Two projects preview each commit here, so without `e2e.deployment` the newest deployment of either would be taken.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

The e2e job's plan step answers `not-ci` here, so it runs nothing and the `e2e` criteria stay `pending` (`no runner has run the e2e scenarios yet`). For CI to run AC-9, s10 sets `e2e.ci: true`, `e2e.url: github-deployment`, `e2e.deployment` to the arcade's preview (`proof.deployment` names it) and `e2e.bypassEnv: VERCEL_AUTOMATION_BYPASS_SECRET`; the repository needs the secrets `OPENROUTER_API_KEY` and `VERCEL_AUTOMATION_BYPASS_SECRET`.

## What it costs to change later

Four config lines in s10 and two repository secrets; nothing in this slice changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether both secrets are already set on this repository for the checks workflow

```

<!-- /omni-outbox-settled: s5-07-e2e-job-waits-for-settings -->
