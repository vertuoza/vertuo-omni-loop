---
id: s4-01-checkpoints-check-in-ci
prd: 2809
slice: s4
rank: human-action
bears-on: none
raised: 2026-11-13
wave: 3
---

## The question, in plain words

The database check that proves a saved job's work is kept private, and only by the runner that holds the job, is written and passes, but the build robot is not allowed to change the file that tells CI what to run. Can a person add that one step?

## The decision, in plain words

The check was left out of CI and everything else was pushed. Until a person adds the step, nothing in CI proves who may read and record a job's saved work.

## The intro, for fun

The privacy proof passes on the bench, but the robot still has no badge for the CI room.

## The punchline, for fun

Same hallway as last wave, same polite knock on the door.

## What a person must do

1. Check out the branch feat/unlosable-jobs--s4 (or the feature branch feat/unlosable-jobs once s4 is merged into it).
2. In .github/workflows/supabase.yml, in the check job, right after the step named "A lost runner job queues one resume, and no runner claims it before its wait" (the one running supabase/checks/runner_resume.sql), add this step:
   
   ```yaml
         - name: A runner job's save, its bucket, and who reads it
           # The bucket runner-checkpoints is private, 100 MB an object, bundles only, and no rule on storage.objects names
           # it. As the service role, runner_checkpoint_record() records a save for the runner that holds its job: local
           # with its size and a keep_until of 7 days at most, then portable once its bundle is in the bucket at the job's
           # own folder; it refuses another runner, a bundle not uploaded, another job's path or manifest, and 100 MB and
           # more. A member reads the rows, a non-member nothing; nobody signed in writes one or reaches a bundle (PRD 2809).
           run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/runner_checkpoints.sql
   ```
3. Commit it as `ci(supabase): run the runner checkpoints check (#2809)` with your own login, and push.
4. Or, instead: grant the Omni App `workflows: write` in its GitHub App settings, accept the new permission on the installation, and ask for the slice to be pushed again.

## What I had to decide

Add the step below to .github/workflows/supabase.yml (or grant the Omni App the workflows permission and ask for the slice to be pushed again).

## What I did meanwhile

The migration supabase/migrations/20270120103000_runner_checkpoints.sql, supabase/checks/runner_checkpoints.sql, the regenerated types, the route, the service and the kit's client are pushed on feat/unlosable-jobs--s4. The check ran green against a fresh local stack with every migration applied, and red against a record function with its runner guard removed (box-1 recorded the save of a job box-3 holds). runner_resume.sql and rls_membership_once.sql ran green beside it. The workflow step is the only part not pushed.

## What it costs to change later

One step a person adds by hand; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether to grant the Omni App the workflows permission for good, or add such steps by hand each time, is a person's choice; s1-01 of this PRD, PRD 2573 and PRD 2676 met the same refusal. (author)
