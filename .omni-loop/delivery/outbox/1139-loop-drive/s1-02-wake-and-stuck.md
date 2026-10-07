---
id: s1-02-wake-and-stuck
prd: 1139
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

How long should the loop sleep when it has to wait, and what should it do when a slice is stuck and nothing else can move?

## The decision, in plain words

It looks again in 5 minutes while checks run or GitHub cannot be read, and in 20 minutes while another session holds a slice. A stuck slice with nothing else to take parks the work on a person.

## The intro, for fun

Every loop needs a snooze button.

## The punchline, for fun

Five minutes for machines, twenty for people, a sticky note when truly stuck.

## The options, in plain words

A. 5 minutes for checks and GitHub, 20 for claims; a stuck slice parks on a person.
B. Shorter hints (2 and 10 minutes); a stuck slice parks.
C. The same hints, but a stuck slice waits instead of parking.

## What I had to decide

The wake hint for each kind of wait, in seconds, and whether a stuck slice parks or waits.

## What I did meanwhile

The hints are 300 seconds for running checks or an unreadable GitHub and 1200 for a claim held elsewhere; a stuck slice parks with the feature PR's link. A PRD with no plan or no feature PR yet is handed to yolo.

## What it costs to change later

A constant each; parking versus waiting is one row of the verdict.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How quickly checks usually finish here, and whether a stuck slice is ever unstuck without a person.
