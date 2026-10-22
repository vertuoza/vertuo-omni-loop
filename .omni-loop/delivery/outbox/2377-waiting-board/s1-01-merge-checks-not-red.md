---
id: s1-01-merge-checks-not-red
prd: 2377
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When an approved change still has its automatic checks running, does it already wait on the person who merges it?

## The decision, in plain words

Yes: once approved, it waits on the person who merges unless a check has failed. A check still running counts as fine, and only a failed one takes it off the board.

## The intro, for fun

Approved, green-ish, and still spinning: is anyone waiting yet?

## The punchline, for fun

We said yes, and let the spinner finish the sentence.

## The options, in plain words

A. No failed check run: a running check still counts as waiting on the merge, the option built.
B. Every check run passed: a change waits on its merge only once its checks are all green, read again on every sync while it is approved.
C. Read commit statuses too, so a red status from an outside service also takes it off the board.

## What I had to decide

What "its checks are green" means for a merge wait (spec §1): no check run on the head commit failed, or every one passed.

## What I did meanwhile

A merge wait opens once a review approves and no check run failed (failure, timed out, cancelled, action required, startup failure); a run still in progress does not hold it. Only check runs are read, not commit statuses. The one check-runs read also gives the locked laws the outbox check holds the pull request on, read from that check's title, for s2.

## What it costs to change later

One set of conclusions and one condition in apps/galaxy/src/stages/sync/waits.ts and github.ts; no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A check that goes from running to green changes nothing GitHub lists as an update, so with green-only the sync would not see it until the pull request moved again: that is why running counts as fine (author)
- Commit statuses (an older GitHub API some services still use) are not read, so a red status alone does not take a change off the board (author)
- The locked laws are read from the outbox check's title as apps/omni-app/src/outbox-check/law-locked.ts words it; a change to that wording would silently drop them (author)
