---
id: s4-01-retro-queue-wired-outside-territory
prd: 2338
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

To make the live app queue the settling job, one line had to change in the file that wires every background task of the GitHub app, which the plan did not give this slice. Is it fine that this slice changed it?

## The decision, in plain words

The slice added the one line that hands the database to the retro, so the live app queues the job; without it, only the pull request text would carry the line.

## The intro, for fun

The queue was built, but nobody had plugged it in.

## The punchline, for fun

One line of wiring later, the lamp turns on.

## The options, in plain words

A. Keep the one wiring line, so the live app queues the job (built)
B. Drop it here and add it in a change that owns the wiring file

## What I had to decide

Keep the one wiring line in the app's list of background tasks (A), or move it to a follow-up change that owns that file (B).

## What I did meanwhile

The wiring line is in place: with the database set, the retro queues the job; without it, the retro still writes the line in its pull request.

## What it costs to change later

B is the removal of one line, and the app then queues nothing until a later change adds it back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice names only the retro folder and the app's test folder, not the file that wires the app's tasks. (author)
