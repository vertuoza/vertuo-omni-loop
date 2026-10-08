---
id: s7-01-tick-shares-the-send-callback
prd: 1218
slice: s7
rank: high
bears-on: ADR-0052
raised: 2026-10-08
wave: 6
---

## The question, in plain words

When a member marks a prerequisite as done, GitHub must send them back to the app after they agree. Should it come back to the address the outbox answers already use, or to a new address of its own?

## The decision, in plain words

It comes back to the address the outbox answers already use, which GitHub already knows. That address now tells a tick from an answer and handles each, so nobody has to change the GitHub App's settings before the button works.

## The intro, for fun

Two parcels, one letterbox, and a postman who already knows the way.

## The punchline, for fun

The label on each parcel says which room it goes to.

## The options, in plain words

A. A. Reuse the outbox send's callback, which tells a tick from an answer by its state (built).
B. B. Give the tick its own callback address, and have a person add it to the GitHub App's settings.
C. C. Move both onto one shared callback module that dispatches by kind, owned by neither feature.

## What I had to decide

Whether Mark as done should reuse the outbox send's GitHub callback, or have its own one that a person must add to the GitHub App's callback addresses.

## What I did meanwhile

The tick works wherever the outbox send already works; the shared callback reads the authorisation's state, posts a tick for a tick's state and an outbox answer for any other, exactly as before.

## What it costs to change later

Option B is a new route of a few lines plus one callback address added in the GitHub App's settings; the tick's own code does not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice does not include the outbox send's callback route, so this touches one file outside it (the callback route), and the roadmap page's route file to pass the two new query values.
- (author) ADR-0052 says GitHub brings a person back only to a listed address; whether a second address is wanted is the team's call.
