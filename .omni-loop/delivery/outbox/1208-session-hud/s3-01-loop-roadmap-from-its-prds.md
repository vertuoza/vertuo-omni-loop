---
id: s3-01-loop-roadmap-from-its-prds
prd: 1208
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When a loop starts, how does it know which roadmap it drives, since the plan it starts from does not say?

## The decision, in plain words

The loop names the one roadmap whose list of PRDs is exactly the plan's list. If no roadmap or more than one matches, it names none and shows the plain loop instead.

## The intro, for fun

The loop set off on a journey and forgot to write down which map it was holding.

## The punchline, for fun

So it checks every map in the drawer and picks the one that matches its route.

## The options, in plain words

A. Match the plan's PRDs against the roadmaps of the inbox: the one roadmap with exactly those PRDs is the loop's (built).
B. Have the planning step write the roadmap's number into the plan it makes, and read it at start.
C. Add a roadmap flag to the start command and have the drive skill pass it.

## What I had to decide

Whether a loop's roadmap is guessed from its list of PRDs, or written down by the planning step that made the plan.

## What I did meanwhile

A loop started from a roadmap's plan shows that roadmap above the work; a loop over the same PRDs started without the roadmap shows the roadmap too.

## What it costs to change later

Moving to B is one field in the plan file, set where the roadmap plan is made, and read at start in place of the match: no data to migrate, since loop.json is rewritten at each start.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The planning step's own files belong to no slice of this PRD, so B could not be built here (author).
