---
id: s2-02-ask-repository-client-handed-in
prd: 1318
slice: s2
rank: high
bears-on: ADR-0095
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The ask reads now live in one place on the server, but the bell still runs the same reads from the browser until its own slice. Should that one place build its own database connection, or be handed the one the request already has?

## The decision, in plain words

The ask reads are handed the signed-in person's connection, the one the page already opened to check who is signed in, so the bell and the dashboard keep sharing the same reads without a second copy.

## The intro, for fun

One kitchen, two doors: the waiter and the chef both need the same pantry key.

## The punchline, for fun

So the key is passed hand to hand instead of cut twice.

## The options, in plain words

A. A. As built: the ask reads are handed the request's connection by the server code above them, until the bell moves off its browser reads.
B. B. The ask reads open their own connection now, and the old readers the bell uses keep their own copies of the queries until its slice.
C. C. The ask reads open their own connection only when the server calls them, and stay shared with the bell meanwhile.

## What I had to decide

Whether apps/galaxy/src/ask/ask.repository.ts imports the database module (src/data/db.ts) itself, or takes its client as a parameter. The controller passes viewer().db through askReads(db) in ask.service.ts; src/ask/page/source.ts delegates readSession, tabsReader, readTabs and readQuestion to the same service, and source.ts is still reached from the browser by src/waiting/source.ts (s4's), so a repository importing the server-only db.ts would break the browser build.
Decided by: Jev (hardToRevert 0.56) · agent said false

## What I did meanwhile

ask.repository.ts imports neither db.ts nor supabase-server.ts; the controller hands it the viewer's client, read once per request. No query is copied: source.ts delegates to the service.

## What it costs to change later

Once s4 moves the bell off source.ts, the repository can import userDb() from db.ts and the controller stops handing a client down: one import and one parameter, no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says only repositories import the database module; it does not say a repository must build its own client.
