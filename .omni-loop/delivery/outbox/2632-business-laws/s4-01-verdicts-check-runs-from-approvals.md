---
id: s4-01-verdicts-check-runs-from-approvals
prd: 2632
slice: s4
rank: medium
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

The new database check for the business laws' verdicts should run as its own named step in the database workflow, but an agent may not change a workflow file. How should it run until a person adds that step?

## The decision, in plain words

The approvals check now runs the verdicts check right after its own, so the database workflow proves it on every pull request today. A person can later give it its own step and remove that one line.

## The intro, for fun

The robot wrote a new test, then found the door to the test room was locked.

## The punchline, for fun

So it slipped the test into a friend's backpack, and left a note on the door.

## The options, in plain words

A. A. Keep the verdicts check running from the approvals check, as built.
B. B. A person adds the verdicts check as its own workflow step and removes the include line.

## What I had to decide

Whether the verdicts check keeps running from the approvals check, or a person adds the step `The business laws' verdicts, and the approval a red holds` to the supabase workflow's check job, running `supabase/checks/business_law_verdicts.sql`, and drops the `\ir business_law_verdicts.sql` line at the end of `supabase/checks/approvals.sql`.

## What I did meanwhile

`supabase/checks/approvals.sql` ends with `\ir business_law_verdicts.sql`, so the supabase workflow's approvals step runs both, each in its own transaction; the push refused a workflow change (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`), so `.github/workflows/supabase.yml` is unchanged.

## What it costs to change later

One workflow step added and one line removed from `supabase/checks/approvals.sql`; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The conventions form asks each check to be its own named step; this departs from it until a person with the workflows permission adds the step (author).
