---
id: s6-01-landing-recorded-as-merged
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The spec has the mission record each landing. The database accepts no landing event yet, and this slice may not change it, so how is a landing recorded?

## The decision, in plain words

Each PRD the mission pull request carried to the main branch is recorded as merged, linking that pull request, which the database already accepts. The mission reads it as shipped from then, and the slice that shows landings in the operation room adds the landing event.

## The intro, for fun

The PRDs reached home, and the diary wrote merged because it has no word for landed yet.

## The punchline, for fun

Same trip, one word short in the dictionary.

## The options, in plain words

A. Record each landed PRD as merged, linking the mission pull request (built).
B. Add a landing event kind now, in a migration outside this slice's ground.

## What I had to decide

Keep a landing recorded as one merged event per PRD until a slice adds the landing event kind, or ask for the event kind now.

## What I did meanwhile

A landing writes one merged event per PRD, signed by the supervisor and linking the mission pull request; the event takes the PRD off the mission branch and the mission reads it as shipped from that moment.

## What it costs to change later

Recording landings with their own event later costs one event kind in a migration, its database check, and one event in the mission's run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives slice s8 the operation room's landing events, but neither s6 nor s8 holds the database's migrations in its ground, as slice s5 found for rebases.
