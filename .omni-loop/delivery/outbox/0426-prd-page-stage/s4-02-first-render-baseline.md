---
id: s4-02-first-render-baseline
prd: 426
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

What should the open page compare its first look at the stage against, since the page was drawn without telling the refresh check its stage?

## The decision, in plain words

The page takes its first answer about the stage as the starting point, and refreshes only when a later answer differs. A change in the first few seconds after opening shows at the next change or reload.

## The intro, for fun

The page wakes up, looks around, and decides that whatever it sees is normal.

## The punchline, for fun

Anything that happened while it was yawning waits for the next surprise.

## The options, in plain words

A. Start from the first answer; pass the drawn stage in later
B. Change the route now so the check starts from the stage the page was drawn with

## What I had to decide

Whether the PRD page should hand the stage it was drawn with to the refresh check, a one-line change in a part of the page outside this slice.

## What I did meanwhile

The refresh check can already read the stage from what the page drew; it is just not handed it yet, so it starts from its first answer.

## What it costs to change later

One line in the PRD page's route, passing the GitHub summary it already read to the refresh check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The route that draws the page belongs to another slice's ground, so it was left as it is (author).
