---
id: s2-04-fleets-check-names-repair
prd: 2980
slice: s2
rank: high
bears-on: none
raised: 2026-11-17
wave: 1
excuses: [supabase/checks/virtual_fleets.sql]
---

## The question, in plain words

A database check that proves three rules about virtual fleets also lists the skills a new Engineer starts with. Now that an Engineer starts with repair too, may that list in the check change?

## The decision, in plain words

The list of a new Engineer's skills in that check now ends with repair, and nothing else in the check changed. The three rules it proves, about who may join, name and change a virtual fleet, are checked exactly as before.

## The intro, for fun

The class photo got one more face, and the caption had to be retyped.

## The punchline, for fun

Nobody else in the picture moved an inch.

## The options, in plain words

A. A. The check's list of a new Engineer's skills ends with repair, its three rules untouched: the option built.
B. B. The Engineer does not start with repair, and the check stays as it was.

## What I had to decide

Whether the one line of supabase/checks/virtual_fleets.sql that lists a new Engineer's skills may take repair. The file is named as proof of BR-GAME-1, BR-GAME-2 and BR-GAME-3; the line changed proves none of them, and their own lines are untouched.
Decided by: agent (hardToRevert true): a change to a law-proof file is raised high so a person answers it (Jev read 0.54)

## What I did meanwhile

The Engineer's default skills, as the database gives them, end with repair (20270125140000_mission_repairs.sql), so the check's expected list of a new Engineer's skills ends with repair. Without it, the check fails in the supabase workflow.

## What it costs to change later

One line: dropping repair from the Engineer's defaults drops it from the check again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan named the law-proof files of this PRD but not this one, which the Engineer's new skill reaches
