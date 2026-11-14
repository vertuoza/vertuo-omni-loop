---
id: s5-03-fix-always-one-repository
prd: 2871
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The spec says a PRD built across several repositories gets the multi-repository fix after the Reviewer's first round. A mission only knows its one repository, so how should it tell such a PRD apart?

## The decision, in plain words

The mission always sends the one-repository fix: it reads nothing that says a PRD spans several repositories, and the runner does not run the multi-repository fix yet.

## The intro, for fun

The recipe says use the big pot for a party, but the kitchen only has the one.

## The punchline, for fun

Tonight we cook for one, and the big pot waits for its own order.

## The options, in plain words

A. A. Always send the one-repository fix sent for review (built).
B. B. Read the PRD's repositories, and send the multi-repository fix for a PRD that holds more than one.

## What I had to decide

Keep sending the one-repository fix (A), or teach the mission to read a PRD's repositories and send the multi-repository fix for those (B).

Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

`lineOf` sends `/omni:yolo-fix <n> --for-review` for every fix; a mission is of one repository (`missions.repo`), and its facts carry no list of the repositories a PRD holds.

## What it costs to change later

One branch in `lineOf` and one fact more for the store to read, once a PRD's repositories are on the page and the runner runs the multi-repository fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a mission is ever meant to hold a PRD of a plan repository, whose fix spans several repositories.
- (author) The runner's list of skills it runs holds neither the Reviewer's skill nor the multi-repository fix today.
