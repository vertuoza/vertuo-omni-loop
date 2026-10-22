---
id: s3-03-release-asks-a-fresh-token-when-it-is-late
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a job has ended and its claims are about to be released as the GitHub App, should the runner ask the app for a fresh token if the one it holds is nearly out?

## The decision, in plain words

Yes. If the token has less than five minutes left, the runner asks the app for a fresh one before it releases, as it does during the job; if the app says no, the claims are left as they are.

## The intro, for fun

Cleaning up after a job can take longer than the badge lasts.

## The punchline, for fun

So the runner asks for a new badge before it tidies up.

## The options, in plain words

A. A. Ask the app for a fresh token at release when less than five minutes are left, as during the job.
B. B. Never ask at release: use the token the job ended with, and leave the claims when it has run out.
C. C. Always ask for a fresh token at release, even when the one held is new.

## What I had to decide

Whoever builds the app's refresh route (slice s7 of this PRD). The runner assumes that route answers for a job that ended a few minutes ago; if it does not, the release leaves the claims as in the earlier item and the cost is a claim left in place.

Decided by: Jev (hardToRevert 0.52) · agent said false

## What I did meanwhile

The release asks keepGithubToken for the job's token: it reuses the one it holds when more than five minutes are left, and asks for a fresh one otherwise, with the same lock, the same one-minute retry and the same wait as during the job. A release never waits for the app longer than the token has left.

## What it costs to change later

Small. Dropping the ask at release is one call removed; the release then uses what the job ended with, and claims are left in place when it has run out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The refresh route is not built yet (slice s7), so whether it answers for a job that has already ended is not known.
- (author) Whether the five-minute margin should be longer at release than during the job is not settled.
