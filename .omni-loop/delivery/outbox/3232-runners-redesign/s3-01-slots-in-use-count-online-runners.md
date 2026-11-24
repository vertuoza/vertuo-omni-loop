---
id: s3-01-slots-in-use-count-online-runners
prd: 3232
slice: s3
rank: medium
bears-on: none
raised: 2026-11-24
wave: 3
---

## The question, in plain words

In the line under the Runners title, should the slots in use count only the runners that are online, or every runner including the offline ones?

## The decision, in plain words

The line counts the slots of online runners only, so an offline runner's last known slots never inflate the total.

## The intro, for fun

An offline runner cannot take work, so should its empty chairs count?

## The punchline, for fun

We counted only the chairs in a room with the lights on.

## The options, in plain words

A. A. Count only the slots of online runners (built).
B. B. Count the slots of every runner, offline ones included.

## What I had to decide

Change the filter in summaryWords in health.ts to include offline runners: a one-line change.

## What I did meanwhile

The summary reads the online runners' slots only.

## What it costs to change later

One line and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether slots of offline runners count in the summary line (author).
