---
id: s4-01-unread-questions-pause-the-game
prd: 757
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When the page cannot check which questions are still open, should the little game carry on, or pause as if a question were waiting?

## The decision, in plain words

It pauses, and points at the questions, whenever some question has no answer yet and the page could not check it. Playing over a real question is worse than one pause too many.

## The intro, for fun

The page lost sight of the question list for a moment, and the aliens kept marching.

## The punchline, for fun

So the game hits pause and says: better check, just in case.

## The options, in plain words

A. Pause the game when the question list cannot be read and a question is unanswered (what was built).
B. Read no open question when the list cannot be read, so the game keeps playing.

## What I had to decide

What the page's working state reads when the open questions cannot be read, while some question is still unanswered.

## What I did meanwhile

The poll counts every unanswered question as open when the question list cannot be read, so the dock reads asking and pauses. The count of asked and answered comes from the page's own pulse, so the question list is only read when something is unanswered.

## What it costs to change later

One line in the page's working reader: count none as open instead. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says idle when the heartbeat cannot be read, but not what to do when the question list cannot be read.
