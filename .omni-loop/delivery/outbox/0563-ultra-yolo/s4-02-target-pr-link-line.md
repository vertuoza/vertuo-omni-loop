---
id: s4-02-target-pr-link-line
prd: 563
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a pull request opens in another repository, how does it point back at the feature request it belongs to?

## The decision, in plain words

It names the planning repository in full before the request's number, so the link leads to the right place instead of a same-numbered page in the other repository.

## The intro, for fun

Number 563 on the wrong street is a very different house.

## The punchline, for fun

So every letter now carries the full street name too.

## The options, in plain words

A. every link line under --repo is written <plan repo slug>#<n> (built)
B. only the target feature PR names the plan repository; sub-PRs keep the bare link line

## What I had to decide

Whether the link line of a sub-PR opened in a target names the plan repository in full.

## What I did meanwhile

pr --repo writes a link line's #<n> as <plan repo slug>#<n>, as the spec already asks of the target feature PR.

## What it costs to change later

A text change in one skill paragraph.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec fixes the full form for the target feature PR only; extending it to every link line under --repo is mine (author).
