---
id: s11-02-overturn-needs-a-migration-and-a-client-call
prd: 2896
slice: s11
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-16
wave: 11
---

## The question, in plain words

The overturn needed a new kind of event in the database and a new call in the terminal's client, both outside this slice's territory. Should they have waited for another slice?

## The decision, in plain words

I added one new kind of event to the database and one new call to the terminal's client, both outside this slice's territory. Nothing else outside the territory changed.

## The intro, for fun

The slice asked for a door and the wall was next door.

## The punchline, for fun

It knocked a small hole and left a note.

## The options, in plain words

A. Add the migration and the client method here, flagged (built).
B. Leave the overturn unrecorded and ask for a slice that owns them.

## What I had to decide

Without the event kind the database refuses an overturn, and without the client method the command cannot call the App. The plan's shared-ground note names the migration folder for other slices only.

## What I did meanwhile

The migration is additive and dated after the newest one on the feature branch; the check proves a member reads the event and nobody else writes it.

## What it costs to change later

Moving the two files into another slice later is a rename of ownership only.

## What I could not know

(author) Whether the plan's territory for s11 was meant to hold the event kind and the client call.

- (author) The owner's reading of the shared-ground note in the plan.
