# Settled outbox items — PRD 2175

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-dead-claim-defaults-outside-config -->

## s1-01-dead-claim-defaults-outside-config — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-dead-claim-defaults-outside-config
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Where should the defaults of the two new settings live, the released label's name and the 240-minute quiet time, when a repository does not set them?

## The decision, in plain words

The kit applies them itself when a setting is left out, so every repository's settings read exactly as before; the catch is that asking the kit to print either setting answers that it is not set until a repository sets it.

## The intro, for fun

Two new settings walked in, and every seat at the table already had a name card.

## The punchline, for fun

So they wait by the door, and the kit tells them apart by heart.

## The options, in plain words

A. The kit applies both defaults itself when a setting is left out, as it already does for the hook size limit.
B. Every repository's settings carry both defaults, the new label is created at setup with the others, and the tests that pin those lists are updated.

## What I had to decide

Keep the defaults in the kit's code (A), or write them into every repository's parsed settings (B) and update the tests that pin the full lists of labels and limits.

## What I did meanwhile

A config that leaves `labels.released` or `limits.claimDeadMinutes` out reads `omni:released` and 240 minutes on the board, the Engineering board and `omni board`, through `releasedLabel()` and `deadClaimRules()`. `omni config labels.released` and `omni config limits.claimDeadMinutes` exit 2 until a repository sets them, so s2 and s3 read the label through `releasedLabel()` in code, or name the default in the skill text.

## What it costs to change later

B is two schema defaults in `kit/lib/config.ts`, plus `kit/lib/init/labels.ts` (a style for the label, which `omni init` would then create) and the tests that pin the label and limit lists: `kit/lib/config.test.ts`, `kit/lib/schema/config.test.ts`, `kit/lib/init/labels.test.ts`, `kit/bin/init.test.ts`, `kit/bin/update.test.ts`. None is in this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3's wave skill text must read the released label through `omni config`: the plan does not say how it reads it (author).

```

<!-- /omni-outbox-settled: s1-01-dead-claim-defaults-outside-config -->

<!-- omni-outbox-settled: s1-02-engineering-board-quiet-claims-need-update-time -->

## s1-02-engineering-board-quiet-claims-need-update-time — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-engineering-board-quiet-claims-need-update-time
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

The Engineering board's Loop health panel cannot see when a pull request was last updated, so should it count quiet claims now, or wait until that time is stored?

## The decision, in plain words

The panel counts a released claim as stale at once, and a quiet claim only when the pull request's update time is known, which the stored rows do not carry yet; so until then it shows released claims and cold ones, never quiet ones.

## The intro, for fun

The panel can read the label, but nobody told it what time it is upstairs.

## The punchline, for fun

It will not guess, so quiet claims wait for their clock.

## The options, in plain words

A. Count released claims now and quiet ones only when an update time is known; store none here.
B. A follow-up stores each pull request's last update time, so the panel counts quiet claims too.

## What I had to decide

Keep the panel as built (A), or store the update time in a later change so quiet claims show too (B).

## What I did meanwhile

The panel uses the kit's own rule, so it never shows a claim `omni board` would read as in flight; it may miss a quiet claim the board already reads as stale.

## What it costs to change later

B is a nullable column on `pull_requests`, the collector writing it, and the loader reading it: a migration, outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the collector in the GitHub App can read the update time on the same call it already makes (author).

```

<!-- /omni-outbox-settled: s1-02-engineering-board-quiet-claims-need-update-time -->

<!-- omni-outbox-settled: s2-01-lost-job-release-report -->

## s2-01-lost-job-release-report — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-lost-job-release-report
prd: 2175
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

When a runner restarts and finds a job it lost, the app has already closed that job. How does the job's row still learn which claims the runner released afterwards?

## The decision, in plain words

The app takes one more report on a closed job when it only says which claims were released, or why that failed, and it changes nothing else of the job; any other late report is still refused.

## The intro, for fun

The job was already marked lost, and then its runner came back with news.

## The punchline, for fun

So the app opens the door a crack: news about claims only, nothing else gets in.

## The options, in plain words

A. A. The app takes a late report on a closed job that only carries the released claims and the release's error, and nothing else.
B. B. No late report: a lost job's claims are released on GitHub, but its row on the Runners page says nothing about them.
C. C. Released claims are stored apart from the job, by a route of their own, so a job's record is never written after it closed.

## What I had to decide

Keep the narrow late report for a closed job (A), or drop the late report and show nothing on a lost job's row (B), or record released claims in their own place apart from the job (C).

## What I did meanwhile

`runnersService.update` (apps/galaxy/src/runners/runners.service.ts) takes a report on an ended job whose status is the one it ended on and whose only other keys are `released` and `releaseError`, and writes only `runner_jobs.released` and `runner_jobs.release_error`. Every other report on an ended job is refused 409, as before. The runner sends that report only after the sweep released something or failed (`releaseLost` in kit/lib/runner/runner.ts), and a refusal or no answer prints one line and stops nothing.

## What it costs to change later

B is a few lines in the service and in `releaseLost`, plus their tests; the claims are still released on GitHub, only the row stays silent. C is a new table or route, a migration and the page's read: a slice of its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the sweep releases a lost job's claims and that each final report carries what was released, but a lost job's last report was already made by the app; it does not say how that report reaches a closed job.
- (author) An app older than this PRD answers 409 to the late report, so a runner newer than the app releases the claims but its row shows nothing.

```

<!-- /omni-outbox-settled: s2-01-lost-job-release-report -->

<!-- omni-outbox-settled: s2-02-which-jobs-count-as-lost -->

## s2-02-which-jobs-count-as-lost — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-which-jobs-count-as-lost
prd: 2175
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

How does a runner know which of its jobs the app marked lost, so it can release their claims during its hourly clean-up?

## The decision, in plain words

A job counts as lost when its work folder is still on the machine while no slot of the runner holds it: that is what a runner that died or restarted leaves behind. A job that never started its session made no claim, so it releases nothing.

## The intro, for fun

The runner woke up from a restart and found a folder nobody was sitting at.

## The punchline, for fun

Whoever left it is not coming back, so their claims go back on the shelf.

## The options, in plain words

A. A. A job counts as lost when its work folder is left on the machine and no slot holds it.
B. B. The runner asks the app for the jobs it marked lost on this runner, and releases those.

## What I had to decide

Keep reading a lost job from the work folder left on the machine (A), or ask the app for the jobs it marked lost on this runner (B).

## What I did meanwhile

`strandedJobs` (kit/lib/runner/sweep.ts) lists the `~/wt/<repo>-job-<id>` folders of checkouts held whose job no slot holds; the sweeper (kit/lib/runner/runner.ts) reads them before the sweep removes them, then releases each, reason `runner lost`. The end path releases only when the job's session started (`live` is not null): a refused line, a repository not held, a worktree or plugin failure release nothing and make no `gh` call.

## What it costs to change later

B is a new runner route on the app (the jobs it marked lost for this runner, not yet released), its contract and service tests, and a call in the sweeper instead of `strandedJobs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the hourly sweep calls the release for a job the server marked lost, but the runner has no route that tells it which jobs those are; the folder a job leaves is the only trace the runner itself holds.
- (author) A job whose folder was already removed (by hand, or by a sweep of a kit older than this PRD) is never released by the runner; the board's 240-minute quiet rule covers it.

```

<!-- /omni-outbox-settled: s2-02-which-jobs-count-as-lost -->

<!-- omni-outbox-settled: s3-01-claim-command-registered-outside-territory -->

## s3-01-claim-command-registered-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-claim-command-registered-outside-territory
prd: 2175
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

The new command that decides whether a stale claim is reused could only be switched on by adding one line to the kit's list of commands, a file the plan did not give this slice. Was that line allowed?

## The decision, in plain words

I added the one line to the list of commands, so the command runs and the checks that every command a skill names exists stay green; nothing else in that file changed.

## The intro, for fun

The new command was built, tested and ready, but its name was missing from the guest list at the door.

## The punchline, for fun

So it wrote its own name on the list, in one line, and left a note saying so.

## The options, in plain words

A. A. Keep the one line in the list of commands, outside the planned ground, as built.
B. B. Treat the planned ground as wrong and add the list of commands to it in the plan, with the same code.

## What I had to decide

Keep the one-line registration of `claim` in `kit/bin/commands/index.ts` (A), or treat the plan's territory as wrong and widen it to that file (B).

## What I did meanwhile

`kit/bin/commands/index.ts` imports `claim` from `./claim.ts` and lists it in `COMMAND_TABLE`, beside `check`. `kit/bin/omni.ts` (in the territory) names its PRD by position, and `kit/lib/help/entries.ts` has its entry. Without the line, `kit/test/plugin.test.ts`'s unknown-command guard fails on the wave skill's `omni claim check`, and that law-proof file stays unchanged.

## What it costs to change later

A constant: one import and one key in `kit/bin/commands/index.ts`. Widening the territory is a plan edit and nothing in the code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the command is registered in `kit/bin/omni.ts`, but the command table lives in `kit/bin/commands/index.ts`; whether the planner meant that file is not written down.

```

<!-- /omni-outbox-settled: s3-01-claim-command-registered-outside-territory -->
