---
id: s2-03-red-check-wakes-the-watch
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

How soon after a red check on the merged change should a delivery read as having broken main?

## The decision, in plain words

A red check on the merged change wakes the watch at once, through a notice GitHub already sends the app. Without one, the watch looks after a day, then once a day on the retro's daily tick, reading everything again each time.

## The intro, for fun

Waiting for tomorrow to admit main is red today felt a little too relaxed.

## The punchline, for fun

Now the watch wakes up when main turns red, and naps the rest of the week.

## The options, in plain words

A. Wake on GitHub's notice that a group of checks finished red on the main branch, then look once a day (built).
B. Look once a day only, so a red check shows up to a day late.
C. Subscribe the app to workflow run notices as well, which asks every installation to accept a changed subscription.

## What I had to decide

Whether the webhook turns a `check_suite.completed` red on the default branch (already subscribed for the touches) into `omni-loop/main-watch.ci-red`, which ends the watch's first wait (`wait-ci`, a day at most) when its `sha` is a lane's merge commit; and whether the looks after it come on the retro's daily tick (`DAY_EVENT`, `DAY_WAIT`), each reading every signal in full. Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Built as option A in `apps/omni-app/src/webhook/webhook.ts` (`toMainWatchRequests`) and `apps/omni-app/src/main-watch/main-watch.ts` (`watchLanes`); the app's subscriptions and permissions are unchanged.

## What it costs to change later

A route and a wait: dropping the wake is deleting both, with no stored shape and no permission changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether GitHub delivers `check_suite.completed` to the app for suites other apps made, GitHub Actions' included, is not checked against a live installation: the daily look reads the red job either way, at most a day later
- (author) a red re-run after the first wait is read at the next daily look, not at once
