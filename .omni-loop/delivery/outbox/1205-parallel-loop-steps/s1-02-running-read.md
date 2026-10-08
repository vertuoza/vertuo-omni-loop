---
id: s1-02-running-read
prd: 1205
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

How does the loop tell, from GitHub alone, which step of a PRD is running right now?

## The decision, in plain words

A PRD runs the wave holding a live claim on one of its slices. Otherwise, when its feature PR carries the in-progress label with a status comment updated within the claim limit, it runs its first step not done, whatever that step is.

## The intro, for fun

The label says someone is home; it does not say which room.

## The punchline, for fun

So the loop knocks on the first door that is not finished.

## The options, in plain words

A. A. Claims name their wave; the label runs the first step not done (built).
B. B. The label always runs the finish step, as the spec words it.
C. C. As A, and a ready sub-PR in flight also counts as a claim.

## What I had to decide

The spec ties the label to the finish, yolo-fix or PR care step. But yolo keeps the label on the feature PR through every wave it builds, so a label alone does not say the finish is running. Reading it as the PRD's first step not done never launches a second agent on a PRD someone is on, and it names the finish once every wave is merged. A live claim is a draft sub-PR in flight, not stale and not stalled, as the spec says; a ready sub-PR waiting for its wave to merge it is not counted. In a plan repository the label is read on the plan PR and on every target PR.

## What I did meanwhile

readFacts reads the claims from the board and the label from the PR listing, fetching comments only for a PR that carries it.

## What it costs to change later

A constant: change runningStep in kit/lib/next/follow.ts or the claim filter in kit/bin/commands/next.ts. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a ready sub-PR left behind by a wave that died should hold its PRD's slot; today it does not.
