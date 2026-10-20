---
id: s1-04-sql-check-outside-territory
prd: 2255
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Should the new table's database check and the step that runs it in CI ship with this slice, although the plan only listed the migration and the types file as its ground?

## The decision, in plain words

They ship with it: a new table with row-level rules gets a check of those rules that runs in CI, as the repository does for its other such tables. Both are small and sit beside the migration.

## The intro, for fun

The plan drew the fence around the migration, and the check was standing just outside it.

## The punchline, for fun

A new table with rules should not arrive without a way to prove them.

## The options, in plain words

A. A. The check script and its CI step ship with this slice, outside its listed ground.
B. B. Both are left out of this slice, and a person adds the check later.

## What I had to decide

Pick A to keep supabase/checks/runner_job_questions.sql and its step in .github/workflows/supabase.yml in this sub-PR, both outside the slice's territory, so the wave reports them as a breach and merges anyway. Pick B to remove both from this sub-PR and leave the rules proven only by the migration's text test, with a person adding the check later.

## What I did meanwhile

The check script and its workflow step are in the sub-PR. The script was run against a throwaway Postgres 16 with the migration applied, not against the full Supabase stack, which could not run here.

## What it costs to change later

Switching to B is deleting one file and one step of the workflow; nothing else depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice leaves out the checks folder and the workflow file, though the repository's rule for row-level checks asks for both (author).
- The workflow step could not be run here: only the script itself was run, on a throwaway Postgres (author).
