---
id: s12-03-pm-record-line-printed-by-the-skill
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

How does the PM tell the app which PRDs it wrote for the mission?

## The decision, in plain words

It ends its run on one line in a fixed shape that the app reads from the job's log. The app keeps at most the cap it sent, and a line it cannot read adds nothing.

## The intro, for fun

The PM leaves a sticky note on the way out.

## The punchline, for fun

The app only reads notes in the right handwriting.

## The options, in plain words

A. A. The skill prints the line itself (built).
B. B. A kit command prints it, as the committee's record command does.

## What I had to decide

Whether a kit command should print the line, as the committee's record is printed, instead of the skill writing it out.

## What I did meanwhile

kit/lib/virtual-fleet/pm.ts holds the line's shape (pmLine, pmRecordOf) and the App reads it with it. The skills write the line by hand, since the kit's commands were outside this slice's territory.

## What it costs to change later

One small command in kit/bin that calls pmLine, and one sentence in each of the four skills.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an agent writing the line by hand gets its shape right often enough; a wrong line adds nothing, which is safe but silent.
