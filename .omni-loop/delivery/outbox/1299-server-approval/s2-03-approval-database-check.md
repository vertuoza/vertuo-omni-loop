---
id: s2-03-approval-database-check
prd: 1299
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The rules about who may approve and that an approval is never changed live in the database. Should the automatic database check prove them, even though that check sits outside this slice's files?

## The decision, in plain words

Yes: a new database check proves who may approve, what is refused and that approvals are only ever added, and the database workflow runs it on every pull request.

## The intro, for fun

A lock was fitted, and the plan forgot to order someone to rattle the handle.

## The punchline, for fun

We rattled it ourselves, and left a note on who did.

## The options, in plain words

A. Add the check and its workflow step in this slice, as built.
B. Leave them out and add them in a follow-up slice.

## What I had to decide

Whether this slice adds its own database check and its workflow step, outside the files the plan gave it.

## What I did meanwhile

supabase/checks/approvals.sql proves the birthplace, each refusal, the pinned files, the second approval and that nobody updates or deletes a row; one step of the supabase workflow runs it. Both are new lines that touch no other check.

## What it costs to change later

Removing them is deleting one file and one workflow step; nothing depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names the migration but neither supabase/checks/ nor the workflow, while its done-when asks that rows cannot be updated or deleted, which only a database check can show.
