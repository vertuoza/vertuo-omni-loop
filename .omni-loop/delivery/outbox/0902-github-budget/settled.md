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
