---
id: s6-02-the-git-store-wraps-the-library-in-place
prd: 1548
slice: s6
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The outbox kept in the repository now sits behind one door. Should the code that reads and writes those files physically move behind the door, or stay where it was with the door calling it?

## The decision, in plain words

The code stays where it was and the door calls it, so every existing test runs untouched. The door offers whole tasks, like grading the gate or writing the comment, which the next slice builds again for the outbox kept on the server.

## The intro, for fun

We built a new front door and had to decide whether to carry the furniture through it.

## The punchline, for fun

The furniture stayed put; the door just learned where everything is.

## The options, in plain words

A. A. The door calls the code where it is, and offers whole tasks (built).
B. B. Move the file reading and writing out of the library into the door, rewriting the tests that call it.
C. C. Offer only raw reads and writes at the door, and run the gate and the comments above it for both outboxes.

## What I had to decide

Confirm the shape of the seam: gitOutboxStore wraps settleItem, adoptItem, relayFolder, gateResult, openItemsForPrd, adoptedEntriesForPrd, readReplies and the two comment upserts in place, with async methods at the level of a verb (gate, replies, prComment, issueComment) beside the item reads and writes; an item reference is a repository path for git; outboxStore(ctx) in kit/lib/outbox/stores.ts returns the git store for every PRD, and s7 adds the pick by birthplace there and its server store as a second row of the contract suite in kit/lib/outbox/store.contract.test.ts.

## What I did meanwhile

Acceptance 5 asks every existing test in kit/lib/outbox and of the moved commands to pass unchanged; they import the library functions directly, so the library keeps its signatures and its file access. The commands now call only the store. The contract suite runs twelve cases through the store's methods alone; git-store.test.ts covers the git store's own ground.

## What it costs to change later

Moving the file access out of the library later is a refactor of each wrapped function and its tests, behind the same interface; switching to raw reads and writes changes the interface s7 builds on, so it is cheapest decided before s7 starts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the git store is today's code moved but not whether moved means relocated or put behind the seam.
- (author) Verb-level methods mean the server store must grade the gate and write comments itself; s7 may prefer to make gateResult pure over rows instead.
