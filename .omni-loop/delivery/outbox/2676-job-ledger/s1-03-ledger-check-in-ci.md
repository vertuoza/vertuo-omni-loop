---
id: s1-03-ledger-check-in-ci
prd: 2676
slice: s1
rank: human-action
bears-on: none
raised: 2026-11-09
wave: 1
---

## The question, in plain words

The ledger's database check is written and passes, but the build robot is not allowed to change the files that tell CI what to run, so CI does not run it yet. Can a person add that one step?

## The decision, in plain words

The check was left out of CI and everything else was pushed. Until a person adds the step, nothing in CI proves the ledger keeps its promises.

## The intro, for fun

The test is written, signed and sealed, but the robot holds no key to the exam hall.

## The punchline, for fun

So it waits outside, politely, until a person opens the door.

## What a person must do

1. Check out the branch feat/job-ledger--s1 (or the feature branch feat/job-ledger once s1 is merged into it).
2. In .github/workflows/supabase.yml, in the check job, right after the step named "A repository's knowledge packs" (the one running supabase/checks/knowledge_packs.sql), add this step:

```yaml
      - name: The job ledger holds jobs and survives failure
        # One job per key; a claim that ran out is due again and writes `lost`, the 5th lost claim is
        # `failed`; a stale claim cannot finish; `waiting` gives its try back and a 5th `retry` fails; a
        # replay keeps the attempts; the health is `late` for a job due over an hour or a failure with no
        # later done job, with counts and no name; forgetting keeps what is under 90 days; two workers at
        # once, through dblink, never hold one job; nobody but the service role reads or calls any of it
        # (PRD 2676).
        run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/background_jobs.sql
```

3. Commit it as `ci(supabase): run the job ledger's check (#2676)` with your own login, and push.
4. Or, instead: grant the Omni App `workflows: write` in its GitHub App settings, accept the new permission on the installation, and ask for the slice to be pushed again.

## What I had to decide

Pushing a change to .github/workflows/supabase.yml from this session is refused: the GitHub App that pushes has no `workflows` permission (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`). The repository's rule is that a database check CI does not run proves nothing (conventions: a new database check runs in CI), and the plan's done-when for s1 asks for supabase/checks/background_jobs.sql run by the supabase workflow.

## What I did meanwhile

The migration, supabase/checks/background_jobs.sql, the regenerated types, the ledger's client and the worker are pushed on feat/job-ledger--s1. The check was run green here against a fresh local database, and red against two broken versions of the functions (a stale claim accepted; a claim without skip locked, which now fails on its lock timeout instead of hanging). The workflow step below is the only part not pushed.

## What it costs to change later

One step a person adds by hand; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether to grant the Omni App the workflows permission for good, or add such steps by hand each time, is a person's choice; PRD 2573 named the same grant as a manual step. (author)
