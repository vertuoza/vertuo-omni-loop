---
id: s7-02-which-pull-requests-ask-for-a-stamp
prd: 2011
slice: s7
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

Which closed or reopened pull requests should ask the server to update a bug's fixes: only those into the main branch, those naming a bug, or all of them?

## The decision, in plain words

A pull request asks only when it goes into its repository's main branch, or when its description names a bug record. A fix merged into another branch whose description names no bug is never recorded, and its bug stays open.

## The intro, for fun

Every door that closes could be a fix walking out.

## The punchline, for fun

We only check the front door, and any door with a name tag.

## The options, in plain words

A. Main branch, or a description naming a bug record (as built)
B. Every pull request closed or reopened, whatever its branch, one job each
C. Only a pull request whose description names a bug record

## What I had to decide

Keep the filter, widen it to every pull request, or narrow it to those naming a bug.

## What I did meanwhile

`toFixStampRequests` in `apps/omni-app/src/webhook/webhook.ts` sends one fix stamp event for `pull_request.closed` (merged or not) and `pull_request.reopened` into the default branch, or on any branch when the body has a `Fixes <key>-B<n>` line; a delivery naming no default branch is sent. Each event is one Inngest run, so a sub-PR into its feature branch sends none (#1409). A redelivery of the same change carries the same event id.

## What it costs to change later

A constant: one condition in `toFixStampRequests`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the merge webhook stamps the row whose repository and pull request match, and says nothing of the branch; #1409 stopped sub-PR merges from spending a run each.
- (author) Events of one pull request run as separate jobs, so a close and a reopen seconds apart could land out of order and leave the row shown closed until it merges.
