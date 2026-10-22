---
id: s4-02-one-job-per-retro-pull-request
prd: 2338
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The retro asks a runner to settle a retro pull request's lessons at most once for that pull request, even when the check two weeks after the merge adds new lessons to the same pull request after the first job has finished. Should it ask again in that case?

## The decision, in plain words

The retro looks for any job already sent for that pull request, whatever its state, and sends none if it finds one. New lessons added two weeks later to the same open pull request are then settled by a person running the line the pull request shows.

## The intro, for fun

Two weeks later, the retro remembers one more thing to say.

## The punchline, for fun

It does not ring the runner twice; the note is on the door.

## The options, in plain words

A. One job per retro pull request, whatever its state (built)
B. Ask again once the earlier job ended and a kept lesson still has no outcome

## What I had to decide

Keep one job per retro pull request ever (A), or ask again when the earlier job has ended and a kept lesson still has no outcome (B).

## What I did meanwhile

One job per retro pull request: a replay never sends a second one, and the pull request text keeps the line while a lesson waits.

## What it costs to change later

B changes the lookup to ignore ended jobs: a few words in one query, and no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for exactly one job and no second one on a replay, but says nothing of new lessons the day-14 run adds to a retro pull request whose job already ran. (author)
- Asking again after a job that posted a question would repeat that question to the same person. (author)
