---
id: s2-01-store-lists-settled-entries
prd: 1679
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

To know whether a person said yes to a bigger budget, the size check must read the answered questions of a PRD. Should the place that keeps those answers learn to list them all, even though that place was not part of this slice?

## The decision, in plain words

The place that keeps a PRD's answered questions can now list every one of them, whichever home the PRD's questions live in. Nothing it did before changes.

## The intro, for fun

The check had to ask who said yes, and the ledger only knew how to whisper.

## The punchline, for fun

Now it reads the whole page out loud, for everyone.

## The options, in plain words

A. A. Teach the place that keeps the answers to list them all, and let the size check ask it (built).
B. B. Let the size check read the answer ledger itself, which only works where the answers live in the repository.
C. C. Guess the answered questions from the ones no longer open, which cannot tell a yes from a no.

## What I had to decide

Whether to add a settledEntries(prd) method to OutboxStore (kit/lib/outbox/store.ts, git-store.ts, server-store.ts and the store contract test), all outside s2's territory, so omni check context reads settled raise items through the store as the spec asks.

## What I did meanwhile

Added settledEntries(prd) to the OutboxStore type and both stores: the git store parses settled.md (latest entry per id), the server store maps every settled row; adoptedEntries in the server store now reuses the same row mapping. The store contract test covers it for both stores, an open item left out.

## What it costs to change later

A constant: removing or renaming one additive method and its two implementations; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the live server's settled rows carry the item body with the raise line verbatim, as the git ledger and the fake routes do: the live server was not checked.
