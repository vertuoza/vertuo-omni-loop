---
id: s1-01-a-person-adds-the-tech-approval-check-to-the-workflow
prd: 2608
slice: s1
rank: human-action
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

The new database check that proves the Tech Approval rules only counts if the automatic checks run it, and the agent was refused permission to change the workflow that lists them. Can a person add that one step?

## The decision, in plain words

The slice ships the check without its workflow step. Until a person adds the step, the check runs only when someone runs it by hand, so the database could stop enforcing a rule without any check going red.

## The intro, for fun

The guard is hired and trained, but nobody may write it onto the rota.

## The punchline, for fun

Only a person holds the pen for that page.

## What a person must do

1. Open .github/workflows/supabase.yml on the branch feat/tech-approval--s1 (or the feature branch once it merged).
2. Right after the step named "A push that changes a pinned file voids the approval", add a step named "A Tech Approval before the product approval" whose run line is the same psql command as its neighbours, with -f supabase/checks/tech_approval.sql.
3. Commit and push it as yourself, and answer this item.

## What I had to decide

A person adds the step to the database workflow, on this slice's branch or the feature branch, before the feature pull request is marked ready.

## What I did meanwhile

The check passes against a fresh local database with every migration, and every other database check stays green; the pull request's own checks do not run it yet.

## What it costs to change later

One step of five lines in one workflow file; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The agent's GitHub App lacks the permission to change workflow files, so this is the one part of the slice it cannot push.
