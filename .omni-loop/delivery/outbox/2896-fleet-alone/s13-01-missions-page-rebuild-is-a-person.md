---
id: s13-01-missions-page-rebuild-is-a-person
prd: 2896
slice: s13
rank: medium
bears-on: none
raised: 2026-11-16
wave: 14
---

## The question, in plain words

After a conflict in built files, should a job or a person rebuild the mission branch?

## The decision, in plain words

The page says a person rebuilds the branch, because that is what the feature branch does now. If a job later does it, this page changes with it.

## The intro, for fun

Two maps disagree about who fixes the bridge.

## The punchline, for fun

The page follows the road that is open today.

## The options, in plain words

A. A. The page says a person rebuilds the branch (as written).
B. B. The page says a job rebuilds the branch, as the spec asks, once the job exists.

## What I had to decide

Confirm that a person rebuilds the mission branch after a conflict only in built files, or ask for the job the spec describes and this page changes.

## What I did meanwhile

The page says a person rebuilds the branch, with no promise of a job.

## What it costs to change later

Changing the sentence costs one line on the Missions page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not run the rebase path in code. The line follows the slice brief, which says s5 left the job out.
- (author) The line that Works alone needs a PM, an Architect and a Reviewer comes from the spec. I did not check it against the drawer code.
