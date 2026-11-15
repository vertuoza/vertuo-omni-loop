---
id: s7-01-dropped-prd-waits-for-a-person
prd: 2896
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 7
---

## The question, in plain words

A dropped PRD must stay dropped until a person sends it again, but the spec does not say how a person sends it again. What happens to a dropped PRD in the meantime?

## The decision, in plain words

A dropped PRD never joins the branch again by itself and the mission says it waits on a person for it. How a person sends it again is left for a later slice.

## The intro, for fun

Dropped is easy; picking it back up is a different conversation.

## The punchline, for fun

It sits on the bench with its feature pull request reopened.

## The options, in plain words

A. A dropped PRD waits on a person, and sending it again comes later.
B. A dropped PRD rejoins at once when its reopened pull request passes the gate.

## What I had to decide

A PRD whose latest event is prd-dropped reads as dropped: it is never merged into the branch, and the mission waits naming it, until a later event joins it again.

## What I did meanwhile

Its feature pull request is reopened against the branch so a person can see and rework it.

## What it costs to change later

Adding a way to send it again later is a new command and one event, with no change to what is built here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a dropped PRD is dropped until a person sends it again, with no command or button for it.
