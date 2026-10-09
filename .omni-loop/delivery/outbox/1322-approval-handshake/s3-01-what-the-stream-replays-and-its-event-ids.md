---
id: s3-01-what-the-stream-replays-and-its-event-ids
prd: 1322
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When the waiting terminal connects to the live approval feed, what does it hear first, and how does it pick up where it left off after the connection is cut?

## The decision, in plain words

Each event is numbered by its place in the PRD's history, so a resumed connection hears only what came after the last number it saw. A fresh connection hears the latest request, then only what followed it or the latest void, so an approval that a later change cancelled is never heard as if it still held.

## The intro, for fun

A feed that starts at the beginning tells the old ending first.

## The punchline, for fun

So it opens at the latest chapter and skips the spoilers.

## The options, in plain words

A. Ids are places in the time-ordered history; a fresh connection starts at the latest request, skipping an approval a later void ended (built).
B. Ids are each row's time in microseconds, and a fresh connection is sent the whole history.
C. A fresh connection is sent nothing old, only what lands after it opens.

## What I had to decide

The spec asks for increasing ids and a replay after Last-Event-ID, but not what the ids are, nor what a connection without an id is sent first. The kit exits 0 on the first approved event, so replaying a voided approval would end a wait wrongly.

## What I did meanwhile

stream.service.ts numbers events 1, 2, 3… by their place in the PRD's requests, approvals and voids sorted by time (microseconds kept; a request sorts before an approval before a void at the same instant). Last-Event-ID n resumes after the n-th; an id it does not know (not a number, or beyond the history) is read as none. With none, the stream sends the latest asked or re-asked event, then every event after the later of that request and the latest void. Realtime only triggers a fresh read of the history; every ping (15 s) reads it again too, so a missed notification costs at most one ping's delay. The stream lives until 15 s before the route's 300 s limit, then sends reconnect.

## What it costs to change later

Low: the numbering and the starting rule are two functions of one file; no stored shape depends on them, and the kit only compares ids it has seen.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what an id is; a place in the history assumes the rows stay append-only, which they are, though a deleted dossier or a row committed late with an earlier time could shift places.
- (author) The spec does not say what a connection without Last-Event-ID is sent first; the kit always checks for an approval in force before asking, so an older approval still in force is not replayed.
