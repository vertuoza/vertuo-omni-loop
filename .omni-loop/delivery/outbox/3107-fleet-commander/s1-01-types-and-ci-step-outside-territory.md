---
id: s1-01-types-and-ci-step-outside-territory
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The plan gave this slice its new table but not the two files every new table also needs: the generated list of the database's shapes and the line that runs its check on each pull request. Should the slice carry them?

## The decision, in plain words

The slice carries both: the regenerated list of shapes, exactly as the generator writes it, and one more step in the database workflow that runs the new check.

## The intro, for fun

The plan packed the table and forgot its passport and its boarding pass.

## The punchline, for fun

The slice brought both, so customs waves it through.

## The options, in plain words

A. A. As built: the slice carries the regenerated database types and the workflow step for its check.
B. B. The slice carries neither; the wave regenerates the types and adds the step after merging.
C. C. The slice carries the workflow step only; the types wait for the wave.

## What I had to decide

A keeps the database's shapes and its check in step with the table they describe, as ADR-0169 and the conventions form (a new database check runs in CI) already ask; B leaves both to the wave, which then regenerates and adds the step after merging. Sources: vertuo-omni-loop/ADR-0169, conventions form › A new database check runs in CI.

## What I did meanwhile

The sub-PR carries supabase/database.types.ts regenerated from main's migrations plus this slice's, and a new step in .github/workflows/supabase.yml running supabase/checks/commander_messages.sql.

## What it costs to change later

Undoing it is deleting one workflow step and regenerating one file: minutes, no data touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The local database was brought up to the branch's migrations with supabase migration up, not restarted fresh: the generated file adds only this slice's table and functions to main's, which the workflow's type check confirms on the feature pull request. (author)
