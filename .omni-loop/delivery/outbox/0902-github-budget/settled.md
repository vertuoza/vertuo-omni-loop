# Settled outbox items — PRD 902

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-migration-version -->

## s1-01-migration-version — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-05T13:29:46Z
- Channel: feature pull request #903
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/903#issuecomment-5995466338
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1
- Became: playbook/conventions#naming

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-01-migration-version
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The plan named a date for the new database change that another change already uses, so the database would refuse to apply both. Which date should it carry?

## The decision, in plain words

I gave the new database change the next free date, a day after the latest one, so both apply in order.

## The intro, for fun

Two database changes walked in holding the same ticket number.

## The punchline, for fun

One of them politely took the next ticket instead.

## The options, in plain words

A. Keep 20261030090000, the next free version.
B. Pick another free version the reviewer prefers.

## What I had to decide

The plan's territory names `supabase/migrations/20261028090000_github_budget*`, but `20261028090000_agent_tokens.sql` already holds that version, and Supabase keys applied migrations by version. s2's planned `20261029090000_dossier_github*` collides with `20261029090000_constituents.sql` the same way.

## What I did meanwhile

Named the migration `supabase/migrations/20261030090000_github_budget.sql`, the first version after the latest one on the feature branch. It applies cleanly after every other migration on a local `supabase db start`.

## What it costs to change later

A rename of one file before it merges; after it reaches production, a new migration, never a rename. s2 should pick its own free version too (for example 20261031090000).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan's version was meant to sort before s2's on purpose (author): the new name keeps that order only if s2 picks a later one.

```

<!-- /omni-outbox-settled: s1-01-migration-version -->

<!-- omni-outbox-settled: s1-02-budget-check-in-ci -->

## s1-02-budget-check-in-ci — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-05T13:29:46Z
- Channel: feature pull request #903
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/903#issuecomment-5995466338
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1
- Became: playbook/conventions#naming

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-02-budget-check-in-ci
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The new check that proves nobody in a browser can read the GitHub budget is written, but the pipeline that runs database checks lists each one by hand and that list sits outside this slice. Should it be added there?

## The decision, in plain words

I wrote the check and ran it by hand against a fresh local database, where it passed, but left the pipeline's list untouched since it lies outside this slice.

## The intro, for fun

The new guard dog is trained and ready.

## The punchline, for fun

Somebody still has to put it on the night shift roster.

## The options, in plain words

A. Add one step for the new check to the supabase workflow, in the feature branch, before it ships.
B. Leave it to a follow-up that runs every check in the folder in one step.
C. Leave the check as a by-hand script.

## What I had to decide

The plan asks for a check under `supabase/checks/` proving the two tables are readable by no browser role. The `supabase` workflow runs each check as its own named step, and `.github/workflows/supabase.yml` is not in s1's territory.

## What I did meanwhile

Wrote `supabase/checks/github_budget.sql` and ran it, with every other check, against a local database built from all migrations: it passes. The workflow does not run it yet.

## What it costs to change later

One step in the workflow, a few lines, at any time; until then a later change could open the tables without CI noticing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person who owns the workflow wants one step per check, as today, or one step that runs every file in the folder (author).

```

<!-- /omni-outbox-settled: s1-02-budget-check-in-ci -->

<!-- omni-outbox-settled: s1-03-recount-priority -->

## s1-03-recount-priority — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-05T13:29:46Z
- Channel: feature pull request #903
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/903#issuecomment-5995466338
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1
- Stays here: a stopgap until s2 rewrites the recount, nothing lasting to file

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-03-recount-priority
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Only the scheduled sync's outbox recount now steps back when the GitHub budget is low, while the recounts after a stage event or a sent answer still read as if a person were waiting. Is that acceptable until the next slice rewrites the recount?

## The decision, in plain words

The sync's recount and fix refresh read as background work; the stage event's and the send's recounts keep reading as a person's request, because their code lies outside this slice and the next slice replaces it.

## The intro, for fun

Three doors lead to the same counting room.

## The punchline, for fun

Only one of them has the new 'please wait' sign so far.

## The options, in plain words

A. Leave the stage event's and the send's recounts interactive until s2 replaces them.
B. Have s2 pass background for the stage event's recount and keep the send interactive, as the spec asks.

## What I had to decide

The plan's done-when says the PRD reader is `interactive` from a page and `background` from a recount. The recounts of the stage event and of outbox send are wired in `apps/galaxy/src/stages/outbox/live.ts`, which is s2's territory, not s1's.

## What I did meanwhile

The reader takes a priority (`interactive` by default). `apps/galaxy/src/stages/sync/live.ts` passes `background` for the sync's recount and fix refresh. `recountLive` (stage event, outbox send) still reads at the default, `interactive`, so it may spend the budget below the 20% floor, but never past a pause.

## What it costs to change later

One argument in one file, which s2 rewrites anyway when the recount derives from the snapshot.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often stage events arrive during a busy wave, and so how much of the budget their recounts spend below the floor (author).

```

<!-- /omni-outbox-settled: s1-03-recount-priority -->

<!-- omni-outbox-settled: s2-01-fix-page-staleness -->

## s2-01-fix-page-staleness — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-fix-page-staleness
prd: 902
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

A fix's page now shows what was last stored about it instead of asking GitHub every time. Nothing records when that stored copy goes out of date, so when should the page ask GitHub again?

## The decision, in plain words

The page shows the stored copy at once and quietly asks GitHub again after it has loaded, as long as the fix has not shipped yet. A shipped fix never changes, so it is never asked again.

## The intro, for fun

A fix page used to phone GitHub every single time someone glanced at it.

## The punchline, for fun

Now it only calls back while the fix is still on its way out the door.

## The options, in plain words

A. A. Refresh after every visit while the fix has no release (built)
B. B. Refresh only when the stored facts are older than a set age
C. C. Refresh only when a webhook or the sync says GitHub moved, adding a stale mark to the stored fix facts

## What I had to decide

Whether a fix page's stored facts are out of date until the fix ships (built), or only after a set age, or only when something says GitHub moved.

## What I did meanwhile

Every visit to an unshipped fix's page costs one background read after the page is shown; the reader's one-minute sharing caps it, and a low budget refuses it first.

## What it costs to change later

A constant: the rule is one line in the fix page's facts module, and the stored fix facts need no new column for options A and C.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The stored fix facts keep no stale mark like the PRD snapshot does, so option C needs the webhooks of a later slice to set one (author).

```

<!-- /omni-outbox-settled: s2-01-fix-page-staleness -->

<!-- omni-outbox-settled: s2-02-snapshot-outside-territory -->

## s2-02-snapshot-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-snapshot-outside-territory
prd: 902
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The new stored copy of GitHub needed two files the slice was not listed to change: the description of the database tables the code reads, and the automatic check list that proves who may read the new table. Was it right to change them here?

## The decision, in plain words

I added the new table to the description of the database and its access check to the automatic check list, as the repository's own rules ask for every new table and check. The sync, which a later slice owns, was left untouched and still asks GitHub itself for its recount until then.

## The intro, for fun

The new table showed up without a name tag or a bouncer.

## The punchline, for fun

So it got both, even though they hang on a door down the hall.

## The options, in plain words

A. A. Change both here, with the table, as the conventions ask (built)
B. B. Leave them for a follow-up slice that owns them, with the table unchecked until then

## What I had to decide

Whether a slice may change the shared table description and the check list when it adds a table, or the plan should name them in its territory.

## What I did meanwhile

The check runs on every pull request and the table description matches the change; the sync's recount reads GitHub directly until the later slice rewires it.

## What it costs to change later

A constant: two additions that any later slice could have made instead; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left these two files out on purpose is not known (author).

```

<!-- /omni-outbox-settled: s2-02-snapshot-outside-territory -->

<!-- omni-outbox-settled: s5-01-octokit-builder-outside-territory -->

## s5-01-octokit-builder-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-octokit-builder-outside-territory
prd: 902
slice: s5
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The plan gave this slice only the outbox check's folder, but the place where the GitHub App builds its connection for every check lives next to it, in the app's shared wiring. Was it right to change that shared wiring too?

## The decision, in plain words

Yes: the shared wiring now builds every connection on the shared budget, so all six of the app's jobs spend the one budget with galaxy, not only the outbox check. The change there is a few lines, and the outbox check's folder holds the tests.

## The intro, for fun

The map said stay in your room, but the light switch was in the hallway.

## The punchline, for fun

We flipped it, and every room got the same light.

## The options, in plain words

A. A. Change the shared connection builder and its wiring so every job of the app spends the shared budget (built).
B. B. Keep the change inside the outbox check's folder, for the outbox check alone, leaving the other five jobs outside the budget until a later slice.
C. C. Leave the builder as it was and only prove the client in the end-to-end test, wiring it in a later slice.

## What I had to decide

Whether the shared connection builder (outside the slice's listed territory) may be changed so every job of the app goes through the shared budget.

## What I did meanwhile

Every job of the app (outbox check, inbox check, retro, harvest, statistics, canon buttons) calls GitHub through the shared budget-aware client, at background priority.

## What it costs to change later

Reverting means building the connection without the shared fetch again: a few lines in two files, no data and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when says every Octokit the app builds goes through the client, which cannot be met inside the outbox check's folder alone; the territory row looks under-declared rather than deliberate.

```

<!-- /omni-outbox-settled: s5-01-octokit-builder-outside-territory -->

<!-- omni-outbox-settled: s5-02-refused-check-waits-for-budget -->

## s5-02-refused-check-waits-for-budget — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-refused-check-waits-for-budget
prd: 902
slice: s5
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

When the shared GitHub budget is paused or too low, what should the outbox check do with a pull request it cannot read yet?

## The decision, in plain words

It writes one line to the log, posts nothing, and asks to be tried again when the budget says it may, never sooner. If it is still refused after its usual retries, the existing failure path takes over once GitHub answers again.

## The intro, for fun

The kitchen is closed until three; do you stand at the door knocking?

## The punchline, for fun

We leave a note and come back at three.

## The options, in plain words

A. A. Log one line and retry at the time the budget gives (built).
B. B. Log one line and end the run quietly, without retrying; the next push or re-run evaluates again.
C. C. Treat a refusal like any other error: retried on the usual schedule, then failed.

## What I had to decide

Whether a refused outbox check waits for the budget and retries at the time the budget gives, or gives up at once.

## What I did meanwhile

A refused step logs one line naming the pull request and the time GitHub resumes, and is retried at that time; the check run is not created or changed meanwhile.

## What it costs to change later

A constant change in the outbox check: retry later, or stop without retrying. No data is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The other five jobs of the app are not taught this: a refused call there is an ordinary error, retried on the job's usual schedule, which the budget refuses again unsent.
- (author) A check whose retries all fall inside a long pause ends in the failure handler, which is itself refused while the pause lasts; the check run may then be left as it was until the next push.

```

<!-- /omni-outbox-settled: s5-02-refused-check-waits-for-budget -->
