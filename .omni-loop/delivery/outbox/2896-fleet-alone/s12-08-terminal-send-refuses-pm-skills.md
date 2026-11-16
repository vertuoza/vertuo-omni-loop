---
id: s12-08-terminal-send-refuses-pm-skills
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

May this slice change how the terminal sends a line to a runner, which lies outside its territory?

## The decision, in plain words

Yes, three lines: a line sent from a terminal belongs to no mission, so the terminal now refuses the PM's four writing skills before asking the app, as the app and the runner do. Without it the terminal's own tests turned red.

## The intro, for fun

The terminal learned the new door policy too.

## The punchline, for fun

Better told at home than turned away at the door.

## The options, in plain words

A. A. The terminal refuses them before any call, outside the territory (built).
B. B. Leave the terminal as it was and let the app refuse them, changing only the test's example.

## What I had to decide

Whether the terminal should refuse these lines itself, or leave the refusal to the app.

## What I did meanwhile

kit/bin/commands/runner-follow.ts calls missionRefusal before sending; kit/bin/commands/runner.test.ts expects the new refusal words for a brainstorm job claimed with no mission.

## What it costs to change later

Three lines of the send command and one expected sentence in its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the send command's help should name the four skills it refuses.
