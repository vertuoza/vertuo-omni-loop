---
id: s4-01-stuck-line-names-short-jobs
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

How should the supervisor name the five jobs a stuck repair reads, when a runner only takes a short line with no commas in it?

## The decision, in plain words

The supervisor names each of the five jobs by its first eight characters, separated by commas, as the PRD writes it. Five whole job names do not fit in the line a runner takes, and today's runners refuse a comma, so until the kit's line check takes one, a stuck repair is refused by the runner and spends one repair.

## The intro, for fun

Five long names walk into a line that only has room for four.

## The punchline, for fun

So each one gives its first name only, and the doorman still frowns at the commas.

## The options, in plain words

A. A. Name each job by its first 8 characters, separated by commas, and widen the runner line check to take a comma.
B. B. Name each job by its first 8 characters, separated by colons, which runners take today.
C. C. Name only the fifth job in full, and let the repair skill find the four jobs before it.

## What I had to decide

Pick how a stuck repair's line names its five jobs. A keeps the PRD's comma list and needs the kit's runner line check to take a comma (the mission-retro slice owns that check). B changes one constant in apps/omni-app/src/missions/stuck.ts so runners take the line today, and the repair skill splits on a colon. C names only the fifth job in full, and the skill reads the four before it from the mission.

## What I did meanwhile

Built A: `/omni:repair --mission <m> --stuck --jobs <j1>,<j2>,<j3>,<j4>,<j5>`, each job its first 8 characters, at most about 90 characters. The App keeps the fifth job's whole id as the repair's failed job by matching those 8 characters against the mission's jobs.

## What it costs to change later

Low: the line is one constant (stuckSkillLine in apps/omni-app/src/missions/stuck.ts) and its reader (stuckJobsOf). Changing it later changes no stored shape; stuck repairs already sent keep their line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the mission-retro slice (s3) widens the runner line check to take a comma, or parses the jobs another way, is not known here: it is built at the same time.
- (author) Whether the repair skill can read a job's log from its first 8 characters, rather than its whole id, is not known here.
