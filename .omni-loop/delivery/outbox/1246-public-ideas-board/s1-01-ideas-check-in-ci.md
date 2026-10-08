---
id: s1-01-ideas-check-in-ci
prd: 1246
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The database test that proves who may read and vote on an ideas board is written, but the automatic checks on every pull request do not run it yet. Should someone add it there?

## The decision, in plain words

The test is written and passes, but this part of the work may not touch the checks' own settings, so it is not run automatically yet. It needs one line added there, by a person or a later part of the work.

## The intro, for fun

A test nobody runs is a smoke alarm still in its box.

## The punchline, for fun

One line unpacks it, and the board's privacy is guarded on every change.

## The options, in plain words

A. A. Leave the automatic checks alone in this part; a person or the wave adds the one step before the feature merges.
B. B. Let this part of the work change the automatic checks too, and add the step here.
C. C. Add it when the whole feature is finished, with any other change to the automatic checks.

## What I had to decide

Whether to add the step that runs supabase/checks/ideas.sql to the supabase workflow's check job before the feature merges.

## What I did meanwhile

The check passes locally against every migration and the demo seed; CI does not run it, so a later change could break a policy unseen.

## What it costs to change later

One step in .github/workflows/supabase.yml, a few lines, copied from the other checks' steps.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory does not include .github/workflows/supabase.yml, and the conventions ask that a new database check be run by CI in the same pull request (PRD 902, s1-02).
