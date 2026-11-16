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
- Stays here: A local setup choice that is cheap to reverse and guarantees nothing lasting to people; no product behaviour or law hangs on who creates the label.

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
- Stays here: A one-off test file placement following the existing testing form; nothing lasting for the product to guarantee, and moving it is a rename.

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
- Became: BR-GATE-2

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
- Became: ADR-0153

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
- Became: ADR-0154

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
- Became: ADR-0155

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
- Became: BR-GATE-3

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
- Became: BR-GATE-4

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
- Became: BR-GATE-5

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
- Became: ADR-0028

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
- Became: ADR-0156

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
- Stays here: A one-off territory call for this slice that follows the kit's own e2e setup guide; cheap to change and nothing lasting beyond what the guide already says.

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
- Stays here: A one-slice choice to edit a script outside the slice's territory rather than copy it; cheap to change, and the behaviour already lives in the spec's done-when.

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
- Became: BR-GATE-6, P-GATE-1

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
- Became: N-GATE-1

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
- Stays here: A sequencing choice between two steps of one feature, reversible with four config lines; it sets no lasting rule or build decision for the knowledge base.

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

<!-- omni-outbox-settled: s4-01-review-gate-finding-as-comment -->

## s4-01-review-gate-finding-as-comment — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s4
- Wave: 3
- Became: ADR-0157

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-review-gate-finding-as-comment
prd: 2898
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

When the Reviewer's pass is blocked by a red ready check, where should the failing check be written down?

## The decision, in plain words

The Reviewer leaves the pull request a draft and posts the failing check as one signed comment, because its review is already posted for that round and cannot hold a second one. A check still running or unreadable ends the run on a stop line instead of asking for changes.

## The intro, for fun

The five checks are lined up, and one of them just dropped the ball.

## The punchline, for fun

The Reviewer writes it down, signs it, and keeps the draft a draft.

## The options, in plain words

A. A. One signed pull request comment naming the failing check; not finished or not judged ends on a stop line.
B. B. Post it as a second review round carrying the check as a finding on a changed line.

## What I had to decide

A person decides whether a red ready check should instead open a new round of the review.

## What I did meanwhile

The draft stays a draft and the check is named on the pull request.

## What it costs to change later

A reword of two skill paragraphs and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a red verdict ends changes with the failing check as its finding but not where that finding is posted when the round's review already exists (author).

```

<!-- /omni-outbox-settled: s4-01-review-gate-finding-as-comment -->

<!-- omni-outbox-settled: s9-01-ready-panel-route-wiring -->

## s9-01-ready-panel-route-wiring — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s9
- Wave: 3
- Stays here: A sequencing choice about slice scope with a small, known follow-up edit; nothing lasting about how the product behaves or is built.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-ready-panel-route-wiring
prd: 2898
slice: s9
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The Ready panel is built and drawn by the PRD page, but nothing yet reads the saved verdict and hands it to the page, so no panel shows. Should a later change connect it?

## The decision, in plain words

I built the panel, its words and its read of the saved verdict, and gave the page a place for it. I did not connect the page's loader, because that file is outside this slice's area.

## The intro, for fun

A lamp is installed and the bulb is in the box.

## The punchline, for fun

Someone has to screw it in.

## The options, in plain words

A. A. Leave the route as it is; connect it in a follow-up slice or PR (what was built).
B. B. Widen this slice's area to the route file and connect it now.

## What I had to decide

Connect the page's route to the verdict read in a follow-up slice: call readLatestVerdict with the PRD's repository and number, pass readyView(row) as the ready prop of DossierPage.

## What I did meanwhile

The panel never shows: with no verdict handed to it, it draws nothing, as the spec says.

## What it costs to change later

One small edit in the page's route file and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which repository of a PRD with several repositories holds the feature PR (author)

```

<!-- /omni-outbox-settled: s9-01-ready-panel-route-wiring -->

<!-- omni-outbox-settled: s8-01-acceptance-line-runs-no-agent -->

## s8-01-acceptance-line-runs-no-agent — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s8
- Wave: 3
- Became: ADR-0158

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-acceptance-line-runs-no-agent
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

When the screen tests cannot run in the continuous checks, a runner of the team runs them instead. Should that be a skill a person can also send from the Omni page, or a line only the Omni App sends?

## The decision, in plain words

A line only the Omni App sends. The runner runs the screen tests itself, with no assistant session, and the Send box refuses it, so the list of skills a person sends stays as it is.

## The intro, for fun

Some jobs need a thinker; this one only needs someone to press play.

## The punchline, for fun

So the runner presses play itself and lets the assistant sleep.

## The options, in plain words

A. A. A line only the App sends, run by the runner with no assistant: what was built.
B. B. A skill a person can send too, listed with the others, with its own folder and a database change.

## What I had to decide

Pick A to keep the line the App's own, or B to make it a skill a person sends too.

## What I did meanwhile

Built A. The kit's `APP_SKILLS` and the page's `APP_RUNNER_SKILLS` (`['acceptance']`) hold `/omni:acceptance <prd> --pr <n> --sha <sha>`; `checkRunnerLine` takes it, the claim's `RunnerJobSchema` takes it (`isAppLine`), and Send's `checkLine` refuses it. `kit/lib/runner/job.ts` runs it through `runAcceptance` (`kit/lib/runner/acceptance.ts`): fetch and detach on the commit, install, find the target, `e2e run --tag prd-<n>` with `E2E_TELEMETRY_DISABLED=1` and every key, token, secret and the preview's bypass masked, then one `omni-acceptance:` result line. `RUNNABLE_SKILLS`, the database's fixed skill list and the Runners guide are unchanged, so the plan's runner-skill migration was not needed and none was written.

## What it costs to change later

Making it a skill later is a plugin skill folder, its help entry, the name in `RUNNABLE_SKILLS` and `RUNNER_SKILLS`, the Runners guide's list and a migration of the fixed list; the runner's code stays.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) an account whose `takes` lists skills never takes the line, since `takes` names only the skills a person sends: a runner whose every account is limited that way fails the job
- (author) `e2eResultsOf` in `kit/lib/runner/acceptance.ts` reads the e2e run's report as `scripts/acceptance-report.ts` does; the two readers live apart because the kit cannot import the repository's scripts

```

<!-- /omni-outbox-settled: s8-01-acceptance-line-runs-no-agent -->

<!-- omni-outbox-settled: s8-02-app-writes-acceptance-while-it-waits -->

## s8-02-app-writes-acceptance-while-it-waits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s8
- Wave: 3
- Became: BR-GATE-7

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-app-writes-acceptance-while-it-waits
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

While the screen tests wait for a runner, should the proof of the success criteria already show on the pull request as still running, or show nothing until the runner is done?

## The decision, in plain words

It shows as still running, written by the Omni App, and names what it waits for: no runner has run the screen tests yet. It is never green while it waits, and it turns green or red once the runner is done.

## The intro, for fun

A blank scoreboard tells nobody the match is still on.

## The punchline, for fun

Ours says the match is on, and who has not turned up yet.

## The options, in plain words

A. A. Show the proof as running while it waits, naming what it waits for: what was built.
B. B. Show nothing until the runner is done, check 3 saying only that no proof is there yet.

## What I had to decide

Pick A to keep the proof shown as running while it waits, or B to show nothing until the runner is done.

## What I did meanwhile

Built A in `apps/omni-app/src/ready-check/runner-fallback.ts`: once CI kept the `acceptance-report` artifact with an `e2e` criterion `pending`, the App posts the `acceptance` check run `in_progress` (external id `omni-acceptance`), its text the report, and updates the same run to `success` or `failure` from the runner's result. Check 1 then reads `not finished` (`still running: acceptance`) and check 3 `not finished` with `AC-<n>: no runner has run the e2e scenarios yet`, in the App's `omni / ready` and in `omni ready` alike. `reportOf` in `apps/omni-app/src/ready-check/facts.ts` now reads the report of a run still going, as `kit/lib/ready/gh-facts.ts` already did. s5-01 kept CI from writing a run that would stay going: this run is the App's, so the App completes it.

## What it costs to change later

Showing nothing until done is one branch in `runnerFallback` and the old `reportOf`; check 3 would then read `no acceptance report on the latest commit yet` while it waits.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) a run that waits forever, with no runner in the workspace, stays in progress on that commit until a new one: truthful, but a reviewer may read it as stuck

```

<!-- /omni-outbox-settled: s8-02-app-writes-acceptance-while-it-waits -->

<!-- omni-outbox-settled: s8-03-one-runner-job-per-commit -->

## s8-03-one-runner-job-per-commit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s8
- Wave: 3
- Became: BR-PRODUCT-146

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-03-one-runner-job-per-commit
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

When a runner's run of the screen tests ends without a result, say the preview never came up, should the App send it to a runner again on the same change, or wait for the next change?

## The decision, in plain words

It waits for the next change. One run is sent per change; when it gives no result, the proof stays not finished and says how the run ended and that a new change runs it again.

## The intro, for fun

Ringing the same doorbell all night rarely opens the door.

## The punchline, for fun

We ring once, leave a note, and come back with the next delivery.

## The options, in plain words

A. A. One run per change; a run without a result waits for the next change: what was built.
B. B. Try again on the same change, up to a set number of times.

## What I had to decide

Pick A to send one run per change, or B to try again on the same change a set number of times.

## What I did meanwhile

`runnerFallback` reads the App's latest job of the line `/omni:acceptance <prd> --pr <n> --sha <head>` (`ReadyStore.appJob`, sent by the app only) and queues one through `../retro/runner-queue.ts` only when there is none, so a replay finds it again. A job that ended with no result line, or a failed one, leaves each `e2e` criterion `pending`, its why the run's own (`standingReport`). A person's job of the same line is never read as the App's.

## What it costs to change later

Retrying is a count of the App's ended jobs of the line and a second insert under a limit, in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) how often a runner's run fails for a reason a second try on the same change would fix

```

<!-- /omni-outbox-settled: s8-03-one-runner-job-per-commit -->

<!-- omni-outbox-settled: s8-04-preview-address-needs-a-grant -->

## s8-04-preview-address-needs-a-grant — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s8
- Wave: 3
- Stays here: This is a deferred, interim choice that waits on a person's call about App permissions. It sets no lasting rule or design, so it belongs in the ledger, not the knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-04-preview-address-needs-a-grant
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

To run the screen tests on a pull request's preview, the runner must ask GitHub for the preview's address, and the Omni App's jobs are not allowed to read it today. Should the App's jobs be allowed to read deployments?

## The decision, in plain words

Not in this change: with a fixed test address the fallback works now, and with the preview the runner tries, fails naming why, and the proof stays not finished saying so. Allowing it is a person's call on what the App may read.

## The intro, for fun

The runner has the map, but nobody gave it the address.

## The punchline, for fun

It knocks, says it cannot get in, and waits politely.

## The options, in plain words

A. A. Keep the jobs' rights; the fallback runs on a fixed address, and says why on a preview: what was built.
B. B. Let the App's jobs read deployments, once every installation accepted it.

## What I had to decide

Pick A to keep the jobs' rights as they are, or B to let the App's jobs read the previews' addresses.

## What I did meanwhile

With `e2e.url: github-deployment`, `runAcceptance` asks `gh api repos/<slug>/deployments?sha=<sha>` with the job's token, which holds only `contents`, `pull_requests`, `issues` and `metadata` (`APP_PERMISSIONS`, apps/galaxy/src/public-api/keys/github-app.ts), and the App's manifest (`apps/omni-app/app.yml`) asks no `deployments` either. GitHub refuses, the job's log ends `omni-acceptance: failed — the preview's address could not be read: …`, and check 3 reads `not finished` with `the runner's e2e run gave no result (…); a new commit runs it again`. A fixed `e2e.url` runs as built. This repository runs its scenarios in CI (s5-07), so it never needs the fallback.

## What it costs to change later

B is `deployments: read` in the manifest and in `APP_PERMISSIONS`, its line in `test/app-yml.test.ts`, and each installation's owner accepting the new permission; asking it before every installation accepts would fail every job's token.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a product that runs its scenarios on a runner keeps a fixed test address, or needs its previews

```

<!-- /omni-outbox-settled: s8-04-preview-address-needs-a-grant -->

<!-- omni-outbox-settled: s1-05-config-rule-tests-list-new-defaults -->

## s1-05-config-rule-tests-list-new-defaults — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T05:52:37Z
- Channel: feature pull request #2902
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2902#issuecomment-6908569428
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-23
- Raised: 2026-11-15
- Slice: s1
- Wave: 1
- Stays here: an approval of this PRD's lists of defaults in two tests; BR-PRODUCT-23 itself is unchanged

### The answer, as it was given

```text
A. Let the lists name the new defaults, the rules' own tests unchanged: what was built.
```

### The item, as it was raised

```text
---
id: s1-05-config-rule-tests-list-new-defaults
prd: 2898
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-11-15
wave: 1
---

## The question, in plain words

Two test files that prove rules about the settings file also list every default of some of its sections. The new ready settings add defaults there, so may those lists grow by the new entries, with the rules' own tests left as they are?

## The decision, in plain words

Yes. The lists now name the new defaults, and nothing those files prove about the rules changed: no assertion was removed or weakened.

## The intro, for fun

Adding a chair to the table means counting one more chair.

## The punchline, for fun

The house rules about chairs stay exactly as written.

## The options, in plain words

A. Let the lists name the new defaults, the rules' own tests unchanged: what was built.
B. Make the new settings optional with no default, so these files stay as they were and the defaults are read in code.

## What I had to decide

`kit/lib/config.test.ts` (the proof of BR-PRODUCT-23) and `kit/lib/schema/config.test.ts` (with it, the proof of BR-PRODUCT-117) hold tests that compare whole defaults with `toEqual`: the top-level key list, the `e2e` section and the `acceptance` section. The spec names `acceptance.kind`, `e2e.ci`, `e2e.repo` and a `ready` section, each printed by `omni config` with its default, so those lists change. Making the keys optional, as PRD 2175 did for `labels.released`, would leave the files untouched but `omni config` would print no default, which s1's done-when asks for.

## What I did meanwhile

Added `'ready'` to the key list, `ci: false, repo: null` to the two `e2e` lists and `kind: 'test'` to the `acceptance` list. The new settings' own tests are in `kit/lib/config-ready.test.ts`. No test of BR-PRODUCT-23 or BR-PRODUCT-117 changed.

## What it costs to change later

Four lines in two test files; going the optional way instead is a reader per key and the same four lines reverted.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner of these rules would rather the new keys stay optional, so these files never change

```

<!-- /omni-outbox-settled: s1-05-config-rule-tests-list-new-defaults -->

<!-- omni-outbox-settled: s5-04-e2e-settings-read-the-environment -->

## s5-04-e2e-settings-read-the-environment — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T05:52:37Z
- Channel: feature pull request #2902
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2902#issuecomment-6908569428
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: ADR-0057
- Raised: 2026-11-15
- Slice: s5
- Wave: 2
- Stays here: how this PRD's e2e config reads three settings by name; ADR-0057 is unchanged

### The answer, as it was given

```text
A. Read the three settings by name from the shared reader: what was built.
```

### The item, as it was raised

```text
---
id: s5-04-e2e-settings-read-the-environment
prd: 2898
slice: s5
rank: high
bears-on: ADR-0057
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The end-to-end tests need three settings from the machine they run on, and the repository reads such settings in one shared place only. How should the test settings get them?

## The decision, in plain words

They take them from the one shared reader of the machine's settings, by name, without adding a new group of settings to it. The secret is sent only to the address under test.

## The intro, for fun

Three notes on the fridge, and one rule about who may read the fridge.

## The punchline, for fun

The tests asked the one who holds the key to the kitchen.

## The options, in plain words

A. Read the three settings by name from the shared reader: what was built.
B. Add a named group for the end-to-end settings to the shared reader, and read them through it.
C. Give the end-to-end tests a reader of their own, listed beside the others in the guard that checks them.

## What I had to decide

`e2e/e2e.config.ts` needs `APP_URL`, the variable `e2e.bypassEnv` names, and `e2e.model`. The environment guard (`scripts/env-guard.test.ts`, ADR-0057) refuses `process.env` outside the env modules, and a new module for the e2e runtime would be a new entry in that guard, a file the access area's locked N-PRODUCT-17 governs. A new group in `kit/lib/env/read.ts` is outside the territory. The e2e framework itself reads no `APP_URL`: its docs say a config reads it.

Decided by: Jev (hardToRevert 0.56) · agent said false

## What I did meanwhile

`e2e/e2e.config.ts` takes `processEnv()` from `kit/lib/env/read.ts` and reads `APP_URL` and the bypass variable from it; the model comes from `.omni-loop/config.yml` through `loadConfig`. No guard changed.

## What it costs to change later

Three lines in `e2e/e2e.config.ts`; a group in `kit/lib/env/read.ts` instead is one `envGroup` and its listing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the decision record on reading the environment means a program's configuration file may read a variable by name from the shared reader

```

<!-- /omni-outbox-settled: s5-04-e2e-settings-read-the-environment -->

<!-- omni-outbox-settled: s1-06-ci-check-counts-skipped-runs -->

## s1-06-ci-check-counts-skipped-runs — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-11-16T05:52:37Z
- Channel: feature pull request #2902
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2902#issuecomment-6908569428
- Basis: contradiction-marker — the answer says "not", which reads as a change to the recorded choice
- Closed: yes — reworked by #2936, the sub-pull request that brought the build back in line
- Rank: high
- Bears on: ADR-0006
- Raised: 2026-11-15
- Slice: s1
- Wave: 4
- Stays here: the rework writes it into the spec's check 1 sentence and the rule's code, where it lives

### The answer, as it was given

```text
Go with A, which is not built yet: change check 1 so skipped and neutral check runs are left out, and only failure, cancelled, timed_out and action_required are red; check 2 still proves the full suite ran. Update the spec's check 1 sentence to match.
```

### The item, as it was raised

```text
---
id: s1-06-ci-check-counts-skipped-runs
prd: 2898
slice: s1
rank: high
bears-on: ADR-0006
raised: 2026-11-15
wave: 4
---

## The question, in plain words

Check 1 (CI green) fails as soon as one CI job was skipped, and every pull request here skips some jobs on purpose, so no mission's pull request could ever be marked ready. Should a skipped or neutral job stop counting against check 1?

## The decision, in plain words

Nothing changed yet: check 1 follows the spec word for word, so a skipped job is not green. On the last commit of pull request 2872 it would read not green, naming five skipped jobs and the neutral approval check.

## The options, in plain words

A. A. Skipped and neutral jobs are left out; failed, cancelled and timed-out jobs are red (recommended).
B. B. Keep the spec as written, and change CI so a labelled draft skips no job.
C. C. Check 1 counts only the jobs that the full-suite setting names.

## What I had to decide

Whether check 1 counts a skipped or neutral check run as red. Recommended: count only failure, cancelled, timed_out and action_required as red, treat skipped and neutral as not counted, and keep check 2 (each ready.full job succeeded) as the guard that the real suite ran.

## What I did meanwhile

Check 1 stays as the spec reads it, so omni / ready would read not ready on every gated pull request of this repository until it is changed.

## What it costs to change later

One function in kit/lib/ready/checks.ts (ciCheck) and its tests, and the spec's check 1 sentence; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a run that only skipped or was cancelled is not green, but this repository's CI skips jobs on purpose on every pull request.

```

<!-- /omni-outbox-settled: s1-06-ci-check-counts-skipped-runs -->
