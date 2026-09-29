---
id: s1-01-rounds-kept-once-by-content
prd: 627
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a visual fix is sent to the Omni page again, how does the page know which rounds of looks it already holds?

## The decision, in plain words

A round is kept once: sending the same round again adds nothing, and a new round is added after the others. A round whose content changed after it was shown would be added as a new round.

## The intro, for fun

Five looks, three rounds, one page that must not count them twice.

## The punchline, for fun

Déjà vu is skipped; only new looks get a seat.

## The options, in plain words

A. Recognise a round by its content: an identical round adds nothing, anything else is a new round (built).
B. Store the round number with each version, so round k is always round k and an edited round adds a version of it.
C. Send only the rounds added since the last push, and keep the version rule as it is for every kind.

## What I had to decide

Whether a round is recognised by its content (built) or by its round number.

## What I did meanwhile

Every push sends every round, oldest first; the database adds only the rounds it has never seen, so their order on the page is the order they were first sent.

## What it costs to change later

Changing it means one more column (the round number) and a rewrite of the version rule for rounds; no page changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each round is one variations version in round order, but not how a second push of the same rounds is told apart from new ones.
- (author) A round edited after it was committed shows up as an extra round rather than a new version of the same round.
