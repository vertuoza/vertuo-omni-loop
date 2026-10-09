---
id: s2-03-session-poll-reads-every-round
prd: 1318
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

An open ask page used to fetch only the questions that changed since its last read, but the server now remembers nothing between reads: should each read fetch the whole session again?

## The decision, in plain words

Each read of a session fetches the session and all its rounds again, every 2 seconds as before, in two database queries instead of two or three, with larger answers.

## The intro, for fun

The server has the memory of a goldfish, by design.

## The punchline, for fun

So it reads the whole menu every time, instead of only the specials.

## The options, in plain words

A. A. As built: each poll reads the session and all its rounds.
B. B. The client sends the rounds it holds with their status, and the server returns only the new or moved ones.
C. C. Read all rounds, but let the server answer 'nothing changed' when the session's newest change is the one the client holds.

## What I had to decide

Whether GET /api/ask/sessions/:id (askReadService.session) keeps the browser's old incremental poll (read round heads, refetch only new or moved rounds) by having the client send what it knows, or reads every round on each poll. The old sessionReader and its incremental tests are removed; the tab list keeps its once-per-round header cache only for the readers that live on (the bell's tabsReader).
Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Each session poll is two queries (the session, its rounds); the payload grows with the number of rounds in a session, which stays small in practice.

## What it costs to change later

Adding the incremental read later is a query parameter on the route and a filter in the service: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keeps the poll's pace and says the database sees the same reads; it does not say whether a read may carry more rows than before.
