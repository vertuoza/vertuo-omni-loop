---
id: s2-01-target-comment-landings-and-link
prd: 1130
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

When a target repository delivered its part in several steps, or the retro was judged not worth its own change, which pull request gets the comment and where does its link point?

## The decision, in plain words

Every merged delivery of the target gets the same comment, and when no retro change was opened the link points at the plan's merged change, where the retro's verdict is written.

## The intro, for fun

The plan said one comment per target, and some targets showed up with several finished deliveries.

## The punchline, for fun

So each one got the same note, like a card signed for every desk.

## The options, in plain words

A. Comment on every merged landing PR; link the plan PR when there is no retro PR, as built.
B. Comment on the target's last landing PR only.
C. Post no target comment at all when the run opened no retro PR.

## What I had to decide

Whether a target of several landings gets the comment on each merged landing PR or on its last one only, and what the link is when the run published no retro PR.

## What I did meanwhile

The comment goes on every merged feature PR of a read target; its link is the retro PR when one exists (the day-14 run reuses the merge run's), else the merged plan PR, labelled as the verdict.

## What it costs to change later

A constant in target-comment.ts and retro.ts: filter the feature PRs to the last one, or change the fallback link; comments already posted stay until rewritten.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec speaks of one merged feature PR per target and does not cover a target of several landings, nor a run with no retro PR.
