---
id: s3-01-checks-read-from-actions
prd: 72
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec asks the retro to read the result of every check on every commit of a slice, yet also says the retro never reads a check result. Where should the retro read those results from?

## The decision, in plain words

The retro reads the runs of the repository's own automated workflows, their jobs and the end of each failed job's log, and nothing else. Checks that other services post, such as the outbox check or a preview deployment, are not counted.

## The intro, for fun

Two lines of the spec pulled in opposite directions, like a door marked both push and pull.

## The punchline, for fun

So the retro used the side door: the workflow logs, where failing tests leave their names anyway.

## The options, in plain words

A. Read only the repository's own automated workflows and their logs, the option built.
B. Read every service's check results too, leaving out only the outbox check, and loosen the earlier test that forbids reading any check result.
C. Read both: the workflows for their logs, and the other services' results for counting only.

## What I had to decide

Which GitHub API the checks kind's `gather` reads CI from. The spec's detector table and decision 6 ask for "check runs on every sub-PR commit plus the last lines of each failed job's log", while its Flow and decision 14 say the retro "never reads or writes a check run", which s2 pinned in `apps/omni-app/src/retro/retro.test.mjs` as no request whose route names `check-runs`. The plan's done-when for s3 names no API.

## What I did meanwhile

`kinds/ci.mjs` reads `GET /repos/{owner}/{repo}/actions/runs?branch=<slice branch>` for every slice branch, `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs?filter=all` for every run (every attempt's jobs), and `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs` for red jobs only; a check is a job's name. Red is `failure`, `timed_out` or `startup_failure`; a `cancelled` or `skipped` job is no run. A 403 on a slice's runs is named in the Checks section ("Not read: the runs of s3 (GitHub answered 403). The app reads them with the `actions: read` permission."), a 404 reads as a slice with no run, anything else fails the step for Inngest to retry. GitHub serves no part of a log, so each red job's log is downloaded whole and only its last `LIMITS.logTailLines` (200) lines, cleaned of timestamps and colour codes, are kept in the step's output. Jobs and logs are read four at a time. The end-to-end test in `kinds/ci.test.mjs` pins that no route names `check-runs`.

## What it costs to change later

One `gather` and its tests. Reading `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` instead gives records of the same shape (an Actions job's check run carries the job's name), but needs s2's route test narrowed to the outbox check's own run, and each sub-PR's commits listed first. The finding ids stay the same, so retro issues already opened are found again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether decision 14's "never reads a check run" meant only the outbox check's own run, which is what the sentence around it is about.
- (author) Whether the repositories the loop runs in post their CI through a service other than GitHub Actions; that CI goes uncounted.
