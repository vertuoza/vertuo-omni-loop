---
id: s2-04-push-updates-running-brief
prd: 2842
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

When someone pushes a changed brief while the mission is already running, should the running mission take the new goal, scope and fleet?

## The decision, in plain words

A push updates the brief's fields at any time, and never touches whether the mission runs, who started it or when it next checks. The next check reads the new scope.

## The intro, for fun

Halfway through the trip, someone redrew the map.

## The punchline, for fun

The driver keeps driving, and simply reads the new map at the next turn.

## The options, in plain words

A. A push updates the running mission's brief; the next check follows it (built)
B. A changed brief is refused while the mission runs or waits, and taken once it is paused
C. A changed brief is stored as a new version, and applied only when a person presses Resume

## What I had to decide

Let a push change a running mission's brief (A), or keep the brief as it was at Start and refuse a changed one until the mission is paused (B).

## What I did meanwhile

mission_push() updates fleet, title, goal, measures, scope and mandate only when one changed, and leaves status, waiting_on, started_by and next_wake_at as they were; every version of the files is kept on the page.

## What it costs to change later

Small: one condition in mission_push() for B, and its check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the page is the source of truth while the mission runs, and omni mission push sends the files there, but not whether a running mission follows a new brief. A PRD a running mission already sent keeps its job either way: the supervisor (s4) only sends new ones.
