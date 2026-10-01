---
id: s24-01-arcade-malformed-reads-fall-back
prd: 725
slice: s24
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

Three things the game screens read from outside are now checked before use: the team members list, a saved team, and the demo player kept in the browser. When one comes back in the wrong shape, what should happen?

## The decision, in plain words

Each falls back the way that screen already falls back when the read fails: the people list shows plain photos, the team form says it could not save, and the demo starts a fresh guest. A correct read behaves exactly as before.

## The intro, for fun

The game used to trust every parcel at the door, even the ones that rattled.

## The punchline, for fun

Now a rattling parcel gets the same polite shrug as a missing one.

## The options, in plain words

A. A: a read of the wrong shape falls back like a failed read, each screen as it already does
B. B: a read of the wrong shape stops the screen with an error naming the field
C. C: fall back, and also report the wrong shape to the error tracker

## What I had to decide

Whether a read of the wrong shape should fall back like a failed read, or stop the screen with an error.

## What I did meanwhile

apps/galaxy/src/people/load.ts parses workspace_roster and teams rows (RosterRowSchema, FleetLookRowSchema); a bad row logs 'people: ... could not be read' with the field, and the directory falls back. apps/galaxy/src/fleets/store.ts parses the row each fleet function answers; a bad one is the refusal COULD_NOT_SAVE. apps/galaxy/src/arcade/account-demo.ts parses the guest kept in localStorage with loose objects (unknown fields kept); a bad one is a fresh guest. A test covers each bad case.

## What it costs to change later

A constant per screen: throw instead of returning the fallback in three catch paths.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The generated database types say workspace_roster returns no nulls, yet a member with no name, login, avatar or fleet returns null; the schema keeps them nullable, as the code always read them (author)
- (author) A demo guest saved by an older build with a field missing now restarts as a fresh guest; no such older shape is known (author)
