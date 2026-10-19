---
id: s2-01-lost-job-release-report
prd: 2175
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

When a runner restarts and finds a job it lost, the app has already closed that job. How does the job's row still learn which claims the runner released afterwards?

## The decision, in plain words

The app takes one more report on a closed job when it only says which claims were released, or why that failed, and it changes nothing else of the job; any other late report is still refused.

## The intro, for fun

The job was already marked lost, and then its runner came back with news.

## The punchline, for fun

So the app opens the door a crack: news about claims only, nothing else gets in.

## The options, in plain words

A. A. The app takes a late report on a closed job that only carries the released claims and the release's error, and nothing else.
B. B. No late report: a lost job's claims are released on GitHub, but its row on the Runners page says nothing about them.
C. C. Released claims are stored apart from the job, by a route of their own, so a job's record is never written after it closed.

## What I had to decide

Keep the narrow late report for a closed job (A), or drop the late report and show nothing on a lost job's row (B), or record released claims in their own place apart from the job (C).

## What I did meanwhile

`runnersService.update` (apps/galaxy/src/runners/runners.service.ts) takes a report on an ended job whose status is the one it ended on and whose only other keys are `released` and `releaseError`, and writes only `runner_jobs.released` and `runner_jobs.release_error`. Every other report on an ended job is refused 409, as before. The runner sends that report only after the sweep released something or failed (`releaseLost` in kit/lib/runner/runner.ts), and a refusal or no answer prints one line and stops nothing.

## What it costs to change later

B is a few lines in the service and in `releaseLost`, plus their tests; the claims are still released on GitHub, only the row stays silent. C is a new table or route, a migration and the page's read: a slice of its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the sweep releases a lost job's claims and that each final report carries what was released, but a lost job's last report was already made by the app; it does not say how that report reaches a closed job.
- (author) An app older than this PRD answers 409 to the late report, so a runner newer than the app releases the claims but its row shows nothing.
