---
id: s6-01-last-answers-by-round
prd: 216
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 5
---

## The question, in plain words

The planet's dossier tab lists the last three answered questions. When Claude asked several questions at once, should each question be a line, or should one ask be one line?

## The decision, in plain words

One ask is one line: the three most recent asks that were answered, each showing its first question and its answer, with a small count when it held more. This matches how the counts above it, and the page's Questions tab, count them.

## The intro, for fun

Three lines on a small screen, and Claude sometimes asks four questions in one breath.

## The punchline, for fun

Each breath gets one line, and a little plus sign for the rest.

## The options, in plain words

A. Show the last three answered asks, each with its first question and a count of the rest
B. Show the last three answered questions one by one, even when they come from the same ask
C. Show the last three answered asks with every question of each, over several lines

## What I had to decide

Show the last three questions one by one, or the last three asks, each with its first question.

## What I did meanwhile

The tab lists the last three answered asks, newest answer first, each with its first question and its answer on one line, and a plus count for the questions of that ask it leaves out.

## What it costs to change later

One small function and its tests: listing questions one by one instead is a change of a few lines, with nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says questions, while the counts beside them count asks (an earlier decision of this PRD); which one a reader expects on the planet is not settled (author).
