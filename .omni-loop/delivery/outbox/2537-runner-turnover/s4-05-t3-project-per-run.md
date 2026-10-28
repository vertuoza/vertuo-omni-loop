---
id: s4-05-t3-project-per-run
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The design says the job's worktree stays a T3 project until the job ends, but a T3 run only knows when it ends itself. When should the project go?

## The decision, in plain words

Each T3 run removes the project when it ends, except a run stopped to be resumed for its note; a later run in the same worktree adds it again. A run waits for its end through T3's own wait, the only way T3 gives the error back.

## The intro, for fun

Every run tidies its desk when it leaves, unless it is only stepping out for a minute.

## The punchline, for fun

The one sent home mid-shift leaves its coffee cup behind.

## The options, in plain words

A. Remove the project at the end of each run, unless the run was stopped to be resumed (built).
B. Remove it when the job ends, from the runner's clean-up, so a killed job leaves nothing in T3.

## What I had to decide

`omni runner t3-run` is one process per run (`job.ts` starts one per run); the job's end is `runner.ts`'s, outside this slice. `t3 project remove --force` deletes the thread too, so a resume after it would fail: a run that ended `interrupted` keeps the project, and the resumed run removes it. The spec's `thread start … --json` followed by `thread show` every 5 s is kept with `--wait` added, since `thread show` carries no error and only the waiting call prints `{status, reply, error}`; `thread list --project <worktree>` finds the thread's id while it runs.

## What I did meanwhile

A run the runner kills (timeout, cancel) leaves its project and thread in T3; the waiting `t3` call ends on its own when the thread does.

## What it costs to change later

Moving the removal into the runner's clean-up: a few lines in `runner.ts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often the runner kills a T3 run (a timeout, a cancel) and leaves its project behind (author)
