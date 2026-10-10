---
id: s9-02-ledger-lanes-and-who-a-prd-waits-on
prd: 1364
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

On a product's Ledger, which lane does each PRD go in, and where does a PRD go that waits on someone other than the reader?

## The decision, in plain words

A PRD waiting for approval or with a question for a person goes in 'on you' only when it waits on the reader; otherwise it sits in no lane and is only counted as waiting on a person. A PRD under review goes in 'on GitHub review', and one being built or ready to build goes in 'on the agent'.

## The intro, for fun

Three lanes, a pile of PRDs, and each one needs to know where to stand.

## The punchline, for fun

If it is waiting on somebody else, it waits quietly in the summary.

## The options, in plain words

A. A. Show only what waits on the reader in 'on you', and count the rest in the summary, the option built.
B. B. Put every PRD waiting on any person in 'on you', naming who it waits on.
C. C. Add a fourth lane, 'on someone else', for PRDs waiting on another person.

## What I had to decide

The rule that places each PRD on the Ledger's three lanes and fills the summary, which the spec names but does not define.

## What I did meanwhile

A server-born PRD with no approval in force waits on its approvers (on you when its request asks you; 'drifted' when a push voided the approval). A PRD whose outbox holds questions for a person waits on its author (on you when you opened it). Else a PRD whose feature PR is ready, or a repository-born PRD whose phase-0 PR is open, is on GitHub review; the rest are on the agent. Shipped PRDs are on no lane. The Ledger tab's count is the 'on you' lane, so it can be higher than the Products card's count, which counts approvals only.

## What it costs to change later

A few lines in the product home's service and its tests; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say where a PRD that waits on another person goes; the three lanes leave no room for it
- (author) Whom an outbox question waits on is not stored; the author is taken, as the waiting list already reads it
- (author) Whether the Products card's waiting count (s8, approvals only) and the Ledger's 'on you' lane must stay identical
