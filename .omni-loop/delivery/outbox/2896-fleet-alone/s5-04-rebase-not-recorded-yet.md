---
id: s5-04-rebase-not-recorded-yet
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

The spec has the operation room record each rebase of the mission branch. The database accepts no rebase event yet, and this slice may not change it, so is a rebase recorded?

## The decision, in plain words

Not yet: a rebase writes no event, and only a conflict shows, as what the mission waits on, which the room already records. The slice that shows the rebases in the room adds the event.

## The intro, for fun

The branch moved house quietly, and forgot to send the postcard.

## The punchline, for fun

The neighbours only hear about it when the door sticks.

## The options, in plain words

A. A. Record no rebase until a slice adds the event kind (built).
B. B. Add the event kind now, in a migration outside this slice's ground.

## What I had to decide

Keep a rebase unrecorded until the slice that shows rebases in the operation room, or ask for the event kind now.

## What I did meanwhile

A rebase moves the mission branch and its feature branches silently; a conflict, a branch that cannot follow and a feature branch a person must fix are each said in what the mission waits on, which is recorded once per change.

## What it costs to change later

Recording rebases later costs one event kind in a migration, its database check, and one event in the mission's run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives slice s8 the operation room's rebase events, but neither s5 nor s8 holds the database's migrations in its ground: s8 will meet the same wall.
