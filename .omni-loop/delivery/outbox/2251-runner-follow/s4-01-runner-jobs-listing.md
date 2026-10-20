---
id: s4-01-runner-jobs-listing
prd: 2251
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The terminal has no command that lists a PRD's jobs or the online runners, so the new skill cannot read them directly. How should it find a job to follow and the runners to offer?

## The decision, in plain words

The skill probes with a short, time-limited follow to see whether a job is queued or running, and offers a choice of runner only when a list command exists, otherwise it sends to any runner.

## The intro, for fun

Looking for a job with no list is like finding a seat in a dark cinema.

## The punchline, for fun

A small list command would turn the lights on.

## The options, in plain words

A. A. Probe with a bounded follow, send to any runner without a list command (what was built)
B. B. Add a list of runners and a list of a PRD's jobs to the kit, and read them in the skill
C. C. Ask the person for the job id and the runner every time

## What I had to decide

Built: a 20 second `omni runner follow <n>` probe, and `omni runner list --json` named for the runner choice with a fall back to any runner. Undo by adding the list command and replacing both steps in the skill.

## What I did meanwhile

Works today: a running job is followed, a new one is sent to any runner. The person is never asked where until the list command exists.

## What it costs to change later

Cheap to change: one list command in the kit and two paragraphs of the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a list command belongs in this PRD or a follow-up (author)
