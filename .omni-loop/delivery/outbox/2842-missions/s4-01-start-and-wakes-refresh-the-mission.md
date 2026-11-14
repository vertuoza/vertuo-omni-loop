---
id: s4-01-start-and-wakes-refresh-the-mission
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

How does a mission that went quiet start checking again, once a person resumes it, a job of it ends or one of its PRDs moves on?

## The decision, in plain words

A mission checks every minute while it runs or waits, and goes quiet once it is delivered, stopped, or paused with nothing still running. Whatever wakes it (Start, Resume, a job's end, a stage change, an answer) puts its check back in line, rather than only bringing forward a check already waiting.

## The intro, for fun

A mission that naps needs an alarm clock that also works when it was unplugged.

## The punchline, for fun

So every alarm here also plugs it back in.

## The options, in plain words

A. Every wake refreshes the mission's job, which ends once there is nothing to watch (built).
B. The mission's job never ends: it checks every minute, delivered, stopped and paused included, and a bare wake is enough.
C. Start and Resume refresh it; the other wakes only bring a queued check forward, and a quiet mission waits for a person.

## What I had to decide

Whether every wake of a mission adds or requeues its job on the ledger (background_job_refresh, kind mission, key and lane mission:<id>, due at once), as built and as s5 must call it, or whether the mission's job should stay queued for ever so a bare background_job_wake is enough.

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built the job to end done when nothing is left to watch, and to end later a minute on while the mission runs or waits, or is paused with a job still running. Exported missionJob(id, repo) with the exact kind, key, subject, lane and payload s5 refreshes. To stay under the ledger's cap of 20 laters in a row, a run refreshes its own job every 15 laters, which resets the count at the price of one extra run reading the same state.

## What it costs to change later

A constant: if the job should never end, the handler returns later instead of done in two places, and s5 may then call background_job_wake alone. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each wake calls background_job_wake, which only brings forward a queued job; a job that ended is not queued, so a bare wake would do nothing.
- (author) Whether a paused mission should keep a check every minute to record job ends was left open: built to keep checking only while a job of it still runs.
