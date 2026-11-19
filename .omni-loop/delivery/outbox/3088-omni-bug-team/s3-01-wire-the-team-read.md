---
id: s3-01-wire-the-team-read
prd: 3088
slice: s3
rank: medium
bears-on: none
raised: 2026-11-19
wave: 2
---

## The question, in plain words

The bug team needs to read on GitHub whether each bug's issue is still open and whether a person already has a fix open. The piece of the App that hands that reading to the mission belongs to the other slice of this wave, so who connects it?

## The decision, in plain words

The team's reading is built and tested, but not yet connected where the App starts its missions. Until it is, the bug team takes no bug and says that it cannot read the issues here.

## The intro, for fun

The team has its reading glasses, but they are still in the case.

## The punchline, for fun

One line in the App puts them on, and the team starts reading.

## The options, in plain words

A. A. The wave connects the reading in the App's job list once both slices merged (built: the reading, waiting for that line).
B. B. A later change connects it, and the bug team takes no bug until then.

## What I had to decide

Connect the team's reading in the App's job list after the wave merges (A), or leave it for a later change (B).

## What I did meanwhile

A bug team mission runs, keeps its budget, waits, and names why it takes no bug; every other mission works as before.

## What it costs to change later

One line in the App's job list, beside the other GitHub readers a mission gets; nothing else changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The line belongs to the file the other slice of this wave changes, so this slice left it alone to avoid a clash.
- (author) The line to add passes the team's reading, built from the App's GitHub access, to the mission handler, as its other GitHub readers are passed.
