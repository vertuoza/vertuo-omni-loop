---
id: s2-01-outbox-wait-on-listed-draft-feature-pr
prd: 2377
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When does a draft feature change with open questions show as waiting on a person, and since when?

## The decision, in plain words

It shows while the sync reads that change and it is still a draft with an open high or human-action question, and it counts from the first sync that saw it. A change nobody touched since the last sync keeps what it showed.

## The intro, for fun

A question left open on a draft: when does the board start the clock?

## The punchline, for fun

We start it the first time the sync looks, and not a minute before.

## The options, in plain words

A. A. Wait on the listed draft feature PR, counted from the first sync that saw it: the option built.
B. B. Store the feature PR's number and each item's first-seen time in prd_outbox and read them there: exact, but a migration.
C. C. Read the feature PR's comments on every sync to date each item: exact, but one more GitHub read per draft.

## What I had to decide

How an outbox wait finds its pull request and its since (spec §1), when the stored outbox keeps no pull request number and no date per question.

## What I did meanwhile

An outbox wait is opened for a draft feature PR into the default branch that the sync listed (so changed since the last sync) when its PRD's stored outbox (prd_outbox) holds an open high or human-action item that is not a held law. Its turn is the PRD's owner plus the people the escalation record asks; its since is the first sync that saw it, kept after. A listed pull request that is ready, closed or has no item left ends its wait; one not listed keeps it. A law wait reads the record only for a pull request with a PRD, uses every owner and delegate laws.owners names, and keeps its row when the record cannot be read.

## What it costs to change later

One function in apps/galaxy/src/stages/sync/waits.ts (outboxWaits); a stored pull request number and first-seen date in prd_outbox would need a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) An answer given on the page that does not touch the pull request ends the wait only at the next sync that lists it
- (author) Since is the first sync that saw the items, not the time the first question was raised
- (author) laws.owners is repository-wide, so a law that names its own owners in CODEOWNERS shows every configured owner
