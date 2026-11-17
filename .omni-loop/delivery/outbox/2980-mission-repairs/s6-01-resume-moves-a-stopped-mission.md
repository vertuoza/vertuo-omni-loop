---
id: s6-01-resume-moves-a-stopped-mission
prd: 2980
slice: s6
rank: medium
bears-on: none
raised: 2026-11-17
wave: 4
---

## The question, in plain words

The Stopped block offers Resume, and until now only a paused mission could resume: may Resume also carry a stopped mission on?

## The decision, in plain words

Resume now moves a stopped mission back to running, which opens a new round where each cause gets three repairs again, and the page shows the button only once a stopped mission has repairs to explain.

## The intro, for fun

The Resume button waited at the door of a room only paused missions could enter.

## The punchline, for fun

Now a stopped mission gets a key too, but only one with a story to tell.

## The options, in plain words

A. A. Resume moves a stopped mission too, through the existing route.
B. B. A stopped mission is taken by hand only, and the block names Resume without a button.

## What I had to decide

The spec says Resume of a stopped mission opens a new round, and the supervisor already counts a Resume that follows a stop as a new round, but the Resume route took paused missions only. I added stopped to the statuses Resume moves, inside the missions folder, and the Missions tab and Operation room show the button only for a stopped mission whose repairs explain the stop.

## What I did meanwhile

Built as the spec asks: Resume in the Stopped block calls the existing resume route.

## What it costs to change later

Reverting is one word in the table of moves, and the Resume button then shows but the route answers that a stopped mission cannot resume.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not name the route Resume uses for a stopped mission.
