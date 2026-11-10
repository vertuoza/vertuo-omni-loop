---
id: s7-04-server-event-runs-checks-at-once
prd: 2688
slice: s7
rank: medium
bears-on: none
raised: 2026-11-10
wave: 3
---

## The question, in plain words

When the server says a product PRD changed, the App re-runs the checks of its pull requests. Should those checks run at once, or wait five seconds as they do after a push?

## The decision, in plain words

They run at once, inside the same background run, which already waits for a burst of server events to settle.

## The intro, for fun

The server rang the bell; the checks could answer now or after a short pause.

## The punchline, for fun

They answer now, since the bell already waited for the crowd.

## The options, in plain words

A. A. As built: the checks are due at once and run in the same background run.
B. B. The checks wait five seconds, and the next webhook or the sweep runs them.

## What I had to decide

Answer A to keep it, B to make them wait five seconds and leave them to the next webhook or the sweep (apps/omni-app/src/server-event/recheck.ts).
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

An approval, a void or an answered question turns the pull request's checks within seconds, with no new push.

## What it costs to change later

A constant: the wait given when the checks are queued.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says the recheck refreshes the jobs but not when they run.
