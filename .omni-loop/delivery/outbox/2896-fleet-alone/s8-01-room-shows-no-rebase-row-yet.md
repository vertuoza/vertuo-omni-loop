---
id: s8-01-room-shows-no-rebase-row-yet
prd: 2896
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 8
---

## The question, in plain words

The operation room now shows a row for each join, drop and landing, but the branch being brought up to date with the default branch leaves no record to show. Should the next slice that touches the App record one?

## The decision, in plain words

The room draws the rows the App already writes. A rebase of the mission branch writes no row today, and adding one needs a database change and an App change, both outside this slice, so the room shows no rebase row yet.

## The intro, for fun

The branch keeps up with the main road, and nobody writes it down.

## The punchline, for fun

The room can only show what the diary says, so the diary needs a new line.

## The options, in plain words

A. A. Leave the room without a rebase row for now (built).
B. B. Add a branch-rebased event kind to the database and the supervisor, then the room shows it.

## What I had to decide

Add a branch-rebased event kind and have the supervisor record it once per rebase; the room then gives it the state word Rebased.

## What I did meanwhile

The room shows joins, drop requests, drops and landings. The Branch line on the Missions tab says whether the branch is up to date or behind, read from what the supervisor says it waits on.

## What it costs to change later

A constant and a state word in the room, plus one event kind in the database check and the supervisor: small, and nothing stored depends on it yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the room records a rebase once, but names no event kind for it; the App writes none today.
