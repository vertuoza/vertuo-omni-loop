---
id: s2-02-loop-park-and-stop
prd: 1139
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

What does it mean for a loop to park a PRD, and what happens to a loop once it has stopped?

## The decision, in plain words

Parking a PRD notes who it waits on and keeps the loop running; the loop ends parked when it stops with PRDs still waiting, and a stopped loop takes nothing more, so running it again starts a new loop.

## The intro, for fun

Every loop needs a way to say it is waiting on you.

## The punchline, for fun

Then it goes home, and tomorrow is a fresh loop.

## The options, in plain words

A. Park marks one PRD, stop ends the loop parked or stopped, an ended loop is never resumed: the option built.
B. Park ends the whole loop at once, as soon as any PRD waits on a person.
C. An ended loop can be resumed by its next run, keeping one loop and one ledger across stops.

## What I had to decide

Whether park ends the loop or only marks one PRD, whether a PRD that moves again leaves the parked list, and whether a stopped loop can be resumed.

## What I did meanwhile

Park marks one PRD and the loop carries on; a later round of that PRD takes it off the list; stop ends the loop parked or stopped; a push to an ended loop is refused, so the next run starts afresh. The app numbers each new plan version itself.

## What it costs to change later

The rules live in one database function and its fake; changing them is a new migration replacing that function, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says park and stop set the loop's state, and the Loop page's parked state means stopped with PRDs waiting; how a resumed run after a stop should read is not said
