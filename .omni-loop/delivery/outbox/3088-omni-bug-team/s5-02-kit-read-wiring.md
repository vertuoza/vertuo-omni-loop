---
id: s5-02-kit-read-wiring
prd: 3088
slice: s5
rank: medium
bears-on: none
raised: 2026-11-19
wave: 3
excuses: [apps/omni-app/src/jobs/pr-checks.ts]
---

## The question, in plain words

To resume a PRD once its bug is fixed, the App has to read which kit the customer's repository runs, and the place that hands each App job what it may read lies outside this slice. Should the slice add that one line?

## The decision, in plain words

Yes: the slice added one line there, so the mission job can read the kit a repository runs. Without it a PRD whose bug was fixed would always ask for a kit update and never resume.

## The intro, for fun

The App learned to read a kit version, but nobody had handed it the glasses.

## The punchline, for fun

One line later, it reads the label on the jar.

## The options, in plain words

A. Add the one line that hands the mission job its kit read (built).
B. Leave the file alone: a PRD whose bug was fixed always reads update the kit until a later change adds the line.

## What I had to decide

Whether to touch the file that builds the App's job handlers, outside this slice's territory, or ship a resume that cannot read the kit until a later change. Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Added the kit read to the mission job's dependencies, next to the bug team's issue read the previous wave added the same way. It reads only the repository's own bin file, near its start, and only while a PRD waits on a fixed bug.

## What it costs to change later

Removing it is one line; a PRD would then wait on the kit until a person updates and resumes it by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists the kit read in no slice's territory: the job handlers' file belongs to no slice of this PRD.
