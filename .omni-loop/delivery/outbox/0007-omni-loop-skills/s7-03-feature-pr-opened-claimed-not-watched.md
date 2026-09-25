---
id: s7-03-feature-pr-opened-claimed-not-watched
prd: 7
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

After the planner opens the draft feature change, should it stay and watch it, and what does its status say?

## The decision, in plain words

The planner opens the draft, says it is claimed with no pieces merged yet, and stops. The delivery run picks it up from there.

## The options, in plain words

A. Status claimed, stop, hand to /omni:yolo
B. Enter /omni:pr's lifecycle loop and watch until green (a draft runs no CI)
C. A new status state such as planned, added to /omni:pr

## What I had to decide

Whether /omni:plan leaves the feature PR with status claimed and stops, or enters /omni:pr's watch loop.

## What I did meanwhile

State claimed, slices 0 of total merged, labels as /omni:pr's feature kind; no check loop, never marked ready; /omni:yolo carries it on.

## What it costs to change later

A word in the status comment and one sentence in the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- /omni:pr's state list has no plan-time state; claimed was chosen as the nearest. (author)
