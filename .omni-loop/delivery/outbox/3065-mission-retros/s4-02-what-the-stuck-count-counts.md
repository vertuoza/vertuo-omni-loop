---
id: s4-02-what-the-stuck-count-counts
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

Which job ends count toward a stuck mission, and what does the supervisor do when a stuck repair ends and the mission has nothing else that can move?

## The decision, in plain words

Only the jobs that build, check or review a PRD count toward being stuck, never a committee, a planner, a repair or a retro. A mission with nothing able to move still stops as it does today, and a stuck repair counts as fixed once something moves after it.

## The intro, for fun

Counting sheep is easy until someone asks which animals are sheep.

## The punchline, for fun

We count only the ones that were supposed to be building something.

## The options, in plain words

A. A. Count only a PRD's step jobs, let a mission with nothing able to move stop, and settle a stuck repair by what happens next.
B. B. Count every job the mission sent, committees and PM jobs included.
C. C. Pause by stuck even when the mission would otherwise stop, so a person always gets the stuck question.

## What I had to decide

Confirm what the stuck count counts and how a stuck repair ends, or pick another reading. Each choice is a few lines of apps/omni-app/src/missions/stuck.ts (beatsOf, settleStuck) and stuck-run.ts.

## What I did meanwhile

Built A: a job end counts when it is a PRD's step job (build, QA, a QA fix, the Reviewer, the fix after it) and its last attempt ended; a lost or limited attempt carried by its resume does not. Moving is a PRD sent to a step further than any it reached, a ready, a join or a merge; a Resume of the mission, a stuck repair sent and a pause by stuck start the count again. The stuck count acts only while the mission runs or waits: one that would stop stops. A code stuck repair settles once its fix landed; a fix that cannot land ends it not fixed; an omni-loop one files its report and the mission goes on; only person, a spent cause or the spent 9 pause.

## What it costs to change later

Low: no stored shape depends on it. The count is read again from the mission's events on every run, so a different reading applies to running missions from the next run on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names retro jobs as counting nothing but does not say whether a committee, a PM or a care job does.
- (author) The kit's repair record line has no items field, so a change to a rule that a stuck repair proposes is not read into the mission's outbox; only a milestone retro's items are.
