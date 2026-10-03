---
id: s5-02-jev-saved-decision-not-verified-live
prd: 1030
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check may only read, but saving one of Jev's decision settings answers the saved row, which cannot be checked without saving something. How is that answer covered?

## The decision, in plain words

The answer to saving a decision is checked against the same description as the stored decisions, which the database check does read, and its own call is left out of the check, because calling it would write.

## The intro, for fun

A read-only inspector cannot test a door by walking through it.

## The punchline, for fun

So it checks the room behind the door instead.

## The options, in plain words

A. A. Leave the saving call out of the check and verify the stored rows it answers: the option built.
B. B. Add a read-only database function that answers a decision row, for the check to call, which needs a migration this feature rules out.
C. C. Call the saving function in the local check only, against a throwaway workspace, which breaks the check's read-only rule.

## What I had to decide

Whether set_jev_decision(), an rpc that writes and answers the jev_decisions row it saved, is registered in jev/store.boundary.ts, given pnpm schemas:verify only sends reads.

## What I did meanwhile

It is not registered. Its answer is parsed with the jev_decisions row schema (extra columns allowed, as the function answers the whole row), and the jev_decisions select, parsed with the strict form of that schema, is registered instead. A failed parse of any Jev read throws the store's own JevStoreError.

## What it costs to change later

One registered read to add if a read-only way to call it appears; nothing for a player.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not run against a local or production database: the demo seed leaves jev_decisions and jev_calls empty, so the local check would name both as empty
