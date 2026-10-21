---
id: s4-01-steps-media-rule
prd: 2030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-21
wave: 3
---

## The question, in plain words

When a list of steps has no picture of its own, must every step bring one, or is one step with a picture enough?

## The decision, in plain words

Every step must bring its own picture when the list has none. A list with no picture of its own and a step without one is refused, the scene named.

## The intro, for fun

A list of steps walks into a video with no picture of its own.

## The punchline, for fun

We asked every step to bring one, so nobody stares at an empty card.

## The options, in plain words

A. A. Every step brings its own media when the scene has none (built): the card is never empty.
B. B. One step's media is enough: before the first step that brings one, the card stays empty.
C. C. One step's media is enough, and the first media shown is held from the scene's start.

## What I had to decide

Whether a steps scene with no media of its own needs every step to bring one (built), or only one step.

## What I did meanwhile

The schema refuses a steps scene with no media when any step brings none; the check reports it at the scene's path.

## What it costs to change later

Loosening it later is one line of the schema and a test: nothing written today breaks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the scene's media becomes optional when every step brings its own, and also that at least one of them is required; the plan only asks that a scene with no media at all is refused. The stricter reading was built. (author)
