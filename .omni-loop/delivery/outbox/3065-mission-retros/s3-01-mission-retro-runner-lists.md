---
id: s3-01-mission-retro-runner-lists
prd: 3065
slice: s3
rank: high
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

A runner can only take a skill that the runner list, the app's copy of it, the database's copy and the runners guide all name. Should this slice have touched those outside its own folders so a mission can send the new retro skill?

## The decision, in plain words

To let a runner accept the mission retro skill, the slice also added it to the app's runner list, the runners guide and one small new database migration that keeps a repository from reusing the name. It left the engineer hero's skill list alone, because adding it there changes many page tests.

## The intro, for fun

A new skill needs a badge before the bouncer lets it in.

## The punchline, for fun

Four doors, four lists, and one of them was a database.

## The options, in plain words

A. A. Add the name to the app list, the guide and a new migration, and leave the Engineer role as it is (as built).
B. B. Add it everywhere, the Engineer role and the heroes drawer's tests included, in a later slice that owns the arcade.
C. C. Touch nothing outside the slice and let the supervisor slice add the lists.

## What I had to decide

Kept: the kit's runnable list, the app's contract list, the guide's line and a migration (20270126120000_mission_retro_skill.sql) adding mission-retro to the fixed list of set_repository_runner_skill. Not done: mission-retro in the Engineer's skills (kit/lib/virtual-fleet/roles.ts), which the plan lists for this slice but which moves counts on the heroes drawer in apps/galaxy.

## What I did meanwhile

Without these edits a mission could not send /omni:mission-retro: the app and the database would refuse the line.

## What it costs to change later

The migration redefines one function with one more name in its list; undoing it is another migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The Engineer role does not list mission-retro yet, so the heroes drawer does not show it (author).
