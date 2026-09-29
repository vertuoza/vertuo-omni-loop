---
id: s5-02-outbox-check-in-workflow
prd: 657
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

The new database check for who may read the open-question counts only runs if the database workflow names it, and that workflow was outside this slice's ground. Should the slice add it there?

## The decision, in plain words

The slice added one step to the database workflow so the new check runs on every pull request, like the checks beside it.

## The intro, for fun

A new guard was hired, trained and given a badge, but nobody put them on the rota.

## The punchline, for fun

So the rota got one more line, written in the same pen as the others.

## The options, in plain words

A. Add the step to the database workflow in this slice (built).
B. Leave the workflow alone and add the step in a separate change after the feature merges.

## What I had to decide

Whether the new supabase/checks/prd_outbox.sql runs in the supabase workflow through its own step, added by this slice outside its territory, as built.

## What I did meanwhile

One step, 'Who may read and write the PRD outboxes', was added to .github/workflows/supabase.yml after the PRD stages step, running psql on supabase/checks/prd_outbox.sql. The check was also run once by hand against a local database, inside a transaction rolled back at the end, and passed.

## What it costs to change later

Removing or moving the step is a one-line edit of the workflow; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the check file in s5's territory but not the workflow that runs it.
