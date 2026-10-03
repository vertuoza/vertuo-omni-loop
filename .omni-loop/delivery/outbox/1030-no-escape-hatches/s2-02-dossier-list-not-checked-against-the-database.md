---
id: s2-02-dossier-list-not-checked-against-the-database
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The arcade's list of a workspace's dossiers is now checked when it comes in. Can the database check run that same read against a real database before shipping?

## The decision, in plain words

No: only a signed-in member may ask the database for that list, and the check reads with the master key, which the database turns away. That read is checked by its tests alone; the other fourteen reads of this slice are checked against the database.

## The intro, for fun

The master key opens every room but one, and it is the room with the dossiers.

## The punchline, for fun

So that list keeps its tests and skips the dress rehearsal.

## The options, in plain words

A. A. Leave the read out of the check, its tests alone proving it: the option built.
B. B. Let the check's key run the function, which needs a migration this feature rules out.
C. C. Have the check sign in as a member to run it, which needs a member account and its secret in CI.

## What I had to decide

Whether to register the dossier list read for the database check although the check's key may not run it, or leave it out and say so.

## What I did meanwhile

It is left out of the check, with a line in the check's file saying why. Its schema has tests on a fixture of every column, its counts and versions read as numbers whether they come as numbers or as text.

## What it costs to change later

A change to that database function's answer is caught by the arcade when it reads it, not before the merge. Registering it later needs the database to let the check's key run it, which is a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not run against a real database: only the tests parse its answer
- (author) whether a real dossier's latest versions ever name a kind outside the six the code knows was not checked on production
