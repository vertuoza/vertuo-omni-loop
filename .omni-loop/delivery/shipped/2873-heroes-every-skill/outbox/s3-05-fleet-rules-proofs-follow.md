---
id: s3-05-fleet-rules-proofs-follow
prd: 2873
slice: s3
rank: high
bears-on: BR-GAME-1
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Is it right that the tests proving three fleet rules (what a new fleet's key is, what its mascot may be, and how many fleets a workspace keeps) were changed to count six heroes instead of five?

## The decision, in plain words

Yes: the tests now expect six roles, the Designer among them; every rule they prove is checked as before.

## The intro, for fun

A sixth hero walked in, and the head count had to be redone.

## The punchline, for fun

Same rules, one more chair at the table.

## The options, in plain words

A. A. Keep the tests as changed (built).
B. B. Move the role count out of these proofs into a test of its own.

## What I had to decide

s3 added the Designer role, so supabase/checks/virtual_fleets.sql and apps/galaxy/src/virtual-fleets/virtual-fleets.controller.test.ts, which prove BR-GAME-1, BR-GAME-2 and BR-GAME-3, now count six roles and name them. Item s3-04 recorded it as medium.

## What I did meanwhile

Both proofs are green on the feature branch, on a local database with every migration applied.

## What it costs to change later

Reverting means going back to five roles across the migration, the kit and the screens.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the role count belongs in the fleet rules' proofs at all (author)
