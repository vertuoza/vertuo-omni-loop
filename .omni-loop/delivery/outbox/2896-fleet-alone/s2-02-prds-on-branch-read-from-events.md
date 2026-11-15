---
id: s2-02-prds-on-branch-read-from-events
prd: 2896
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Lowering a mission to Reviews with you is refused while PRDs sit on its branch. Where does the count of those PRDs come from before the branch exists?

## The decision, in plain words

The count reads the mission's join, drop and landing events, so it is zero today and the refusal starts to apply once the next slices record those events. The branch name in the message is the mission's number and its title in words.

## The intro, for fun

A guard posted before the door is built still stands in the right place.

## The punchline, for fun

The count is zero until someone actually joins the branch.

## The options, in plain words

A. A. Count from the join, drop and landing events (built).
B. B. Count the PRDs whose pull request targets the mission branch.

## What I had to decide

Whether to count PRDs another way, such as a stored branch name, once the branch is cut.

## What I did meanwhile

The refusal is written and tested on events a test records; no real mission can trip it yet.

## What it costs to change later

Changing where the count is read costs one function in the missions repository and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The event names prd-joined, prd-dropped and landed are the spec's; the database accepts them only once the branch slices add them (author).
