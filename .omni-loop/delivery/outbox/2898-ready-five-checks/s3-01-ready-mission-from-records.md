---
id: s3-01-ready-mission-from-records
prd: 2898
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The command that checks a pull request is ready needs to know whether its PRD belongs to a running or paused mission, but only the Omni page knows a mission's state. Where should it read that from?

## The decision, in plain words

It reads the repository's own mission records and says whether one names the PRD. It cannot tell running from paused or finished, and the answer is only printed beside the verdict: it never changes the five checks.

## The intro, for fun

A mission is on the Omni page; the checkout only holds its postcard.

## The punchline, for fun

So the command reads the postcard and says so.

## The options, in plain words

A. A. Read the mission records of the repository and print the answer beside the verdict (built).
B. B. Ask the Omni page for the mission's state and hold when it cannot be reached.
C. C. Refuse to run omni ready outside a mission.

## What I had to decide

Print `ready.checks` and whether a mission record of this repository names the PRD, as one line, and leave the verdict to the five checks. The gate that calls omni ready decides whom to ask.

## What I did meanwhile

A PRD in a paused or finished mission reads as in a mission; the gate in s4 asks only for PRDs under ready.checks, so no pull request is held for it.

## What it costs to change later

A small page call later, if the state must be read: one function in kit/lib/mission/membership.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a mission's running or paused state is recorded by the Omni page; no kit command reads it yet. (author)
