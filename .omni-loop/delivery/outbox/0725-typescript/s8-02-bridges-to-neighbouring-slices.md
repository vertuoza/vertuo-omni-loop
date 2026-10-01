---
id: s8-02-bridges-to-neighbouring-slices
prd: 725
slice: s8
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The outbox files typed here lean on files other slices are typing at the same time. Should this slice wait for them, or bridge the gap with marked shortcuts?

## The decision, in plain words

This slice bridges the gap with three marked shortcuts that state the shapes it expects, so it can finish now. Once the neighbouring files are typed, each shortcut becomes a no-op that the final tightening slice can remove.

## The intro, for fun

Two crews are building the same bridge from opposite banks.

## The punchline, for fun

This crew left a rope ladder and a note saying where the bolts go.

## The options, in plain words

A. Keep the marked bridges now and remove them in the final tightening slice
B. Rebase this slice on s7 once it merges and drop the bridges here
C. Move the narrowing reader and the shared outbox types into the kit-wide types file

## What I had to decide

How the settle, replies and check modules read results from outbox.ts and comment.ts, which slice s7 types in the same wave, and how planReplies keeps compiling for the arcade, which passes it loosely typed rows.

## What I did meanwhile

settle.ts exports parseItem, a wrapper over parseOutboxItem that returns { ok: true, item: OutboxItem } or { ok: false, errors } through one cast marked ts-allow; replies.ts casts openItemsForPrd's result to OutboxItem[] and keeps planReplies' wide object parameters, narrowing them once inside with a marked cast. settle.ts also exports the folder-local types the outbox shares (Markers, SettleContext, Judgement, SettledEntry, Verdict).

## What it costs to change later

Three casts to delete once s7 and the arcade slices land, and parseItem either kept as the one narrowing reader or replaced by parseOutboxItem at its four call sites. No output changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The exact return type s7 gives parseOutboxItem and openItemsForPrd was not known while this slice ran in parallel
- (author) Whether the arcade slices will type the rows they pass to planReplies with the kit's own types
