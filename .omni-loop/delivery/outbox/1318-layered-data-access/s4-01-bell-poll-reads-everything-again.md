---
id: s4-01-bell-poll-reads-everything-again
prd: 1318
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 4
---

## The question, in plain words

The bell used to remember, between two reads, the text of each waiting question and who shared it. Its reads now run on the server, which remembers nothing between two reads: should each read fetch all of it again?

## The decision, in plain words

Each read of the bell fetches every waiting question's text, and who shared it with their face, again, every 5 seconds as before, so a read sends a few more queries than the browser did.

## The intro, for fun

The bell moved into the server, and the server has a goldfish's memory.

## The punchline, for fun

So it reads the whole list each time, instead of only what is new.

## The options, in plain words

A. As built: every bell read on the server reads it all again, every 5 seconds as before.
B. The browser sends the rounds whose text it already holds, and the server reads only the new ones.
C. The server keeps a short memory per person between reads.

## What I had to decide

Whether waiting.service.ts keeps the browser's old once-per-reader memory (each waiting round's first question, each workspace's members and people directory, each newest round's header) across polls, or reads them all on every GET /api/waiting/questions. A reader now lives for one request, so the maps in questionsReader only spare repeats within that request.

## What I did meanwhile

Each poll reads the tab list, the shared rounds, the waiting rounds' questions and, when a round was shared, its workspace's members and people: a handful of small queries every 5 s visible and 15 s hidden, as the pace was before.

## What it costs to change later

Sending the round ids the bell already holds is a query parameter on the route and a filter in the service: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keeps the poll's pace and says the database sees the same reads; it does not say whether one read may send more queries than before.
- (author) A medium item of the ask pages' slice (s2-03) settled the same trade for the ask pages' session poll.
