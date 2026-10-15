---
id: s1-04-naming-an-owner-is-logged
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec lists what the knowledge history records, but naming an owner or a delegate is not on the list. Should naming someone be recorded too?

## The decision, in plain words

Naming, changing or clearing an owner or a delegate is recorded in the history as a change of its own, with who was named before and after.

## The intro, for fun

A history that forgets who held the pen is only half a history.

## The punchline, for fun

So the pen gets a line of its own too.

## The options, in plain words

A. Naming an owner or a delegate is recorded in the history.
B. The history records only changes to entries and proposals.

## What I had to decide

Answer A to keep naming in the history, or B to leave it out.

## What I did meanwhile

The history has one more kind of change, named, beside added, edited, retired, removed, proposed, approved and rejected.

## What it costs to change later

Dropping it later means a migration that stops writing these rows; rows already written stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone will read the history of who was named, beside the entries' history (author)
