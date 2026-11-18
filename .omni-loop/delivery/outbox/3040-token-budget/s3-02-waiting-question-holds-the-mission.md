---
id: s3-02-waiting-question-holds-the-mission
prd: 3040
slice: s3
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

Some cases are not settled by the spec: a paused mission back under its cap before anyone answers, a mission a person had paused when its fleet's cap was reached, and a stopped mission over a cap.

## The decision, in plain words

A mission the budget paused stays paused until its question is answered, even once back under the cap, and a fleet's stop names only the missions that run or wait. A mission a person paused, or a stopped one, is never asked about and sends nothing over a cap.

## The intro, for fun

The jar refilled overnight, but nobody said the word.

## The punchline, for fun

One question, one answer, and nobody resumes behind your back.

## The options, in plain words

A. A. A waiting question holds the mission until answered; a fleet's stop names the missions that run or wait; a paused or stopped mission is never asked (built).
B. B. A mission back under every cap resumes by itself, its question left open.
C. C. A fleet's stop also names the missions a person paused, so they read as paused by the budget.

## What I had to decide

Keep A, or let a paused mission resume by itself once it is back under every cap without an answer.

## What I did meanwhile

The supervisor tells a pause of its own from a person's by the order of the stop, its own pauses and the person's Pause, and never resumes a mission a person paused.

## What it costs to change later

Low: each case is one line of the run's budget rules and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's section 3 says a person picks Resume tomorrow to wake by itself, but not what happens when the window frees room with no answer.
