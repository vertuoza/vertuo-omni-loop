---
id: s9-04-the-tab-settles-and-tells-the-app-itself
prd: 1548
slice: s9
rank: high
bears-on: ADR-0095
raised: 2026-10-11
wave: 3
---

## The question, in plain words

An answer on the Questions tab is saved by the tab's own small storage step rather than the outbox's own answer route. Is that all right?

## The decision, in plain words

Yes: the tab reads the question through the outbox's own service, saves the answer itself so it is recorded as given on the Questions tab, and then tells the GitHub app, the same message the outbox's own answer route sends.

## The intro, for fun

Two doors into the same room, each with its own doormat.

## The punchline, for fun

Both ring the same bell once you are in.

## The options, in plain words

A. The tab saves through its own step and tells the app itself (built).
B. Teach the outbox's own service where an answer came from, and settle through it.

## What I had to decide

How the tab saves an answer: the outbox's own service records every answer as given in the terminal, and changing it lies outside this slice.

## What I did meanwhile

A storage step of the tab's own calls the same database function with the Questions tab as where it was answered; after it, the tab's live wiring sends the item-settled event through the server-event sender, without changing any file outside the slice.

## What it costs to change later

Folding it into the outbox's service later is a refactor of two small files; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says to reuse the outbox's service; its settle has no way to say the answer came from the Questions tab.
