---
id: s2-01-repair-in-the-database-first
prd: 2980
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
excuses: [apps/galaxy/src/runners/runners.ultra-skills.migration.test.ts, apps/galaxy/src/virtual-fleets/roles-sql.test.ts, supabase/checks/virtual_fleets.sql]
---

## The question, in plain words

The plan asked this step to let a runner take a repair job, but the app's and the kit's lists of runner jobs can only name a repair once the repair skill itself exists, which a later step writes. How much of it belongs here?

## The decision, in plain words

The database side is done here: it knows a repair is one of the loop's own jobs, gives it a place at the front of the queue and lists it among the Engineer's skills. The app and the kit learn the name with the step that writes the skill, and a test holds the two sides together until then.

## The intro, for fun

The guest list says Repair is coming, but Repair has not been born yet.

## The punchline, for fun

So the doorman learns the name today, and the badge is printed the day Repair shows up.

## The options, in plain words

A. A. The database knows repair now, and the app, the kit and the guide learn it with s3, held together by two tripwire tests: the option built.
B. B. Leave repair out of the database here, and let s3 add the lists and a second migration of its own.
C. C. Write a placeholder repair skill here so every list can name it at once.

## What I had to decide

Whether the database may know the repair job one step before the app and the kit do, and whether the three test files this step changed outside its ground stay as changed.

## What I did meanwhile

The migration adds repair to the database's list of the loop's own skills and to the Engineer's default skills (an Engineer still on its default takes it), takes a PRD's repair job under the key mission:<id>:prd:<n>:repair:<k>, and claims it with the resumes, before any fresh job. The app's list (RUNNER_SKILLS), the kit's (RUNNABLE_SKILLS), the kit's roles and the guide's Runners sentence stay as they were: the guide's guard refuses a skill with no folder, and s3 makes the folder. Two tests that hold the database's lists to the app's and the kit's now expect them plus repair, so adding repair to one side alone still fails, and adding it where s3 adds it fails until those two lines read equal again. Outside the plan's ground: runners.ultra-skills.migration.test.ts and roles-sql.test.ts (they named the PM's migration as the newest) and supabase/checks/virtual_fleets.sql (a new Engineer's skills).

## What it costs to change later

A constant: s3 adds repair to RUNNER_SKILLS, RUNNABLE_SKILLS, the Engineer in kit/lib/virtual-fleet/roles.ts, the guide's Runners sentence and runners.skills.migration.test.ts's addedLater list, and turns the two tripwire lines back to plain equality. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s3's territory holds kit/lib/virtual-fleet/roles but not kit/lib/runner/line.ts, apps/galaxy/src/runners/ or docs/guide/runners.md, so s3 will cross its ground too
- (author) where in the Engineer's list repair sits: last, here, which s3's kit list must match
