---
id: s5-01-stage-and-answer-wakes-need-two-call-sites
prd: 2842
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 4
---

## The question, in plain words

A mission should wake the moment one of its PRDs changes stage or gets an answer, but the code that learns of those two things sits outside what this slice may change. Who should call the wake?

## The decision, in plain words

I built the wake itself and wired the end of a mission's job, which is inside this slice. For a stage change and an answer, I left the call out: until it is added, the mission's own check a minute later catches them.

## The intro, for fun

A mission has a doorbell now, but two of its visitors still use the back window.

## The punchline, for fun

The minute's check keeps the window from staying shut.

## The options, in plain words

A. A. Only the end of a job wakes at once; a stage change and an answer wait for the minute's check (built).
B. B. Add the two calls to the wake of a repository's missions, and the wake to the public API's runners service, in a follow-up slice.
C. C. Add them now by widening this slice's territory.

## What I had to decide

Whether a later slice or a small follow-up adds one call to the service's wakeRepo(repo) (apps/galaxy/src/missions/missions.service.ts, tested) in the stage event route and in the place an answer is stored, or whether those two stay on the minute's check.

## What I did meanwhile

A running mission is woken at once by Start, Resume and the end of one of its jobs, and within a minute by a stage change or an answer. The service's wakeRepo(repo) wakes every mission of a repository and is tested, but nothing calls it yet: its live wrapper is added with its first caller.

## What it costs to change later

One line at each call site: the stage event route (apps/galaxy/src/stages/event/) and the answer's storage; a job ended by the public API's cancel is the same, as it builds its runners service without the wake.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for an immediate wake on a stage change and an answer, but the plan's territory for s5 holds neither the stage event route nor the answer code, nor the public API's service wiring.
