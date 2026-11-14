---
id: s4-03-a-stopped-prd-comes-back-by-hand
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

Once a PRD of a mission stops (it failed, was held twice, or its job was cancelled), how does it come back into the mission?

## The decision, in plain words

The mission never sends a stopped or cancelled PRD again: it comes back only when a person takes it to ready for review by hand, and the mission then waits for its merge. A mission left with nothing able to move reads stopped, and says so in those words.

## The intro, for fun

A PRD tripped twice, and the mission decided not to push it a third time.

## The punchline, for fun

A person can still carry it over the line, and the mission cheers from there.

## The options, in plain words

A. A stopped PRD comes back only by hand, through its stage (built).
B. Resume also sends each stopped PRD again, once more.

## What I had to decide

Whether a stopped PRD comes back only through its stage, as built, or whether a person's Resume of the mission should also clear the stopped PRDs so the mission sends them again, one more run each.

## What I did meanwhile

Built the stop as final for the mission's own sends, the PRD's stage winning over it. The stopped mission's waiting line names each stopped PRD with why, then 'Take it to ready by hand and the mission carries on.'

## What it costs to change later

A constant in the pure pick, plus Resume (s5) recording a resumed event the supervisor reads as a fresh start: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a stopped mission says why and how to resume, but not whether Resume retries what stopped.
