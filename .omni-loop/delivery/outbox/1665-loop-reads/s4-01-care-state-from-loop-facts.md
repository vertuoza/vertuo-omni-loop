---
id: s4-01-care-state-from-loop-facts
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The plan asked that the old GitHub question behind a pull request's care be gone, but the code that reads its answer lives outside this slice's ground. Is it fine that this slice rewrote it?

## The decision, in plain words

I rewrote that reader so it reads the Omni page's answer instead, and removed the old question. The care state says the same things, except that it no longer carries links to a check's run, a review comment or an avatar, which the page does not send.

## The intro, for fun

The old question was retired, but its answer sheet lived next door.

## The punchline, for fun

So the neighbour got a new sheet, same boxes, three fewer links.

## The options, in plain words

A. A. Read care from the page's answer in the shared reader, the links left empty (built).
B. B. Keep the reader as it was and have the two commands rebuild the old GitHub answer from the page's, leaving the old question in place.
C. C. Add the links to the page's answer first, then read them here.

## What I had to decide

kit/lib/care/state.ts and kit/lib/care/state.test.ts are outside s4's territory, yet 'CARE_QUERY is gone' (s4's done-when) means editing them: CARE_QUERY, CareResponseSchema and the GraphQL parser are removed, and careState({change, comments}, options) reads LoopChangeDetail (review.checks, review.mergeable, review.threads) and LoopComment. The rollup is drawn from the check states (red if any failure, running if any pending, green otherwise, none with no check); a failed check's url, a thread's url and a thread comment's url and avatarUrl are now always null, since the contract (settled item s2-02) carries none. The galaxy keeps its own CARE_QUERY copy (apps/galaxy/src/dossier/github/care.ts), untouched.

## What I did meanwhile

Rewrote state.ts and its tests on loop facts; next.ts and care.ts call it with reads.change and reads.comments. care state's JSON keeps every field, with null links.

## What it costs to change later

A field added to the contract (a check's or a comment's link) and one line each in state.ts to read it again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether /omni:pr-care or the Omni page leans on a failed check's link or a thread's link from care state's JSON was not checked beyond the kit's own tests.
- (author) No other slice lists kit/lib/care/, so the edit cannot collide in this landing, but the plan did not give it to s4.
