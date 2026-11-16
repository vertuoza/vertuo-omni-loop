---
id: s11-01-overturned-answer-not-written-back
prd: 2896
slice: s11
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-16
wave: 11
---

## The question, in plain words

When a person overturns an answer the fleet gave, should the App also put the question back in the feature branch's outbox, or is a note in the mission's record enough?

## The decision, in plain words

An overturn is recorded as the person's own note beside the fleet's decision, which stays as it was, and the PRD leaves the mission branch if it had joined. The App does not put the answered question back on the feature branch: the person answers it on the pull request.

## The intro, for fun

The fleet wrote its answer in pen.

## The punchline, for fun

You may cross it out, but only in the margin.

## The options, in plain words

A. The overturn is an event; the answered question is not put back on the feature branch (built).
B. The App also writes a commit on the feature branch that opens the question again, from the settled list.

## What I had to decide

How far "reopens the item for that person" goes. Putting the question back needs a commit on the PRD's branch that reverses the fleet's settlement, which the slice's territory does not hold (the kit's outbox files and the settlement code belong to slice s10).

## What I did meanwhile

The decision stays as recorded and the person's overturn sits beside it; the PRD is dropped from the branch when it had joined, so it cannot join again until a person sends it again. The PRD's own pull request into the mission branch is where the person answers.

## What it costs to change later

Option B is one more function next to the App's settlement code and one call in the overturn's run: no stored shape changes.

## What I could not know

(author) The spec says an overturned answer "reopens the item for that person", and does not say whether the item must be a file on the branch again.

- (author) Whether answering on the pull request is enough for the person, or the item must reappear in the outbox folder.
