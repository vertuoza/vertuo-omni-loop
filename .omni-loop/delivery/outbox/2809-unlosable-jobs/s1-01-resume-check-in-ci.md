---
id: s1-01-resume-check-in-ci
prd: 2809
slice: s1
rank: human-action
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

The database check that proves a lost job is resumed exactly once is written and passes, but the build robot is not allowed to change the file that tells CI what to run, so CI does not run it yet. Can a person add that one step?

## The decision, in plain words

The check was left out of CI and everything else was pushed. Until a person adds the step, nothing in CI proves a lost job queues one resume and waits before it starts.

## The intro, for fun

The proof is written and passes, but the robot has no badge for the room where CI keeps its list.

## The punchline, for fun

So the proof waits in the hall until a person walks it in.

## What a person must do

1. Check out the branch feat/unlosable-jobs--s1 (or the feature branch feat/unlosable-jobs once s1 is merged into it).
2. In .github/workflows/supabase.yml, in the check job, right after the step named "Who may read and write the runners, and how a runner claims a job" (the one running supabase/checks/runners.sql), add this step:

```yaml
      - name: A lost runner job queues one resume, and no runner claims it before its wait
        # A job sent anew reads attempt 1; a claimed or running job of a resumable skill that ends lost queues, in
        # the same statement, one resume with its line, repository, sender (the key and its maker kept) and target,
        # attempt one more, 1 minute after the first loss and 5 after the second; a second mark, the third loss, a
        # cancel, a refusal, the skill's own failure, a timeout and another skill queue none; runner_claim() hands
        # out no job before its resume_after. Members read the columns, nobody signed in writes them (PRD 2809).
        run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/runner_resume.sql
```

3. Commit it as `ci(supabase): run the runner resume check (#2809)` with your own login, and push.
4. Or, instead: grant the Omni App `workflows: write` in its GitHub App settings, accept the new permission on the installation, and ask for the slice to be pushed again. Slice s4 of this PRD adds a check step too and will meet the same refusal.

## What I had to decide

Pushing a change to .github/workflows/supabase.yml from this session is refused: the GitHub App that pushes has no `workflows` permission (`refusing to allow a GitHub App to create or update workflow .github/workflows/supabase.yml without workflows permission`). The repository's rule is that a database check CI does not run proves nothing (conventions: a new database check runs in CI), and the plan's done-when for s1 asks for supabase/checks/runner_resume.sql to run as its own step of the supabase workflow. PRD 2676 s1-03 met the same refusal and was settled by a person adding the step.

## What I did meanwhile

The migration, supabase/checks/runner_resume.sql, the regenerated types, the kit's RESUMABLE_SKILLS and the runners' reads are pushed on feat/unlosable-jobs--s1. The check ran green here against a fresh local database with every migration applied, and red against three broken versions: no trigger (no resume queued), a trigger on any failure (a timeout resumed), and a claim that ignores resume_after (a resume handed out before its wait). The eleven other checks that touch runner jobs ran green too. The workflow step above is the only part not pushed.

## What it costs to change later

One step a person adds by hand; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether to grant the Omni App the workflows permission for good, or add such steps by hand each time, is a person's choice; PRD 2573 and PRD 2676 named the same grant as a manual step. (author)
