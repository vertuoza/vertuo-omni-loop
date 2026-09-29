---
id: s2-01-five-per-round
prd: 620
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The design says each Other answer takes up to five screenshots, but the storage keeps at most five screenshots for a whole question round. Should a round with several questions share five, or should each question get five?

## The decision, in plain words

I made the five a limit for the whole round: once five screenshots are added across its questions, a sixth is refused with the usual "5 screenshots max".

## The intro, for fun

Five seats on the bus, and three questions all want to bring friends.

## The punchline, for fun

So the friends share the bus, and the sixth one walks.

## The options, in plain words

A. Five for the whole round, shared by its questions (built).
B. Five per question: a follow-up migration numbers paths per question, and the page counts per question.

## What I had to decide

Whether the five-screenshot limit counts per question or per round.

## What I did meanwhile

The page counts screenshots across the whole round and refuses the sixth, whichever question it is added to. Most rounds have one question, where both readings agree.

## What it costs to change later

One constant on the page, plus a follow-up migration that widens the storage rule's numbering if each question should get five. No stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names both "5 per Other answer" and paths numbered 1 to 5 under the round's folder; the storage rule built in the first slice enforces the latter.
