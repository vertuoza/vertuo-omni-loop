---
id: s3-02-an-app-job-with-no-token-left-is-released-as-nothing
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a job that ran as the GitHub App has ended and no valid token is left, may its claims be released with the machine's own GitHub login instead?

## The decision, in plain words

No. The claims are left as they are and the job's result says why, in the words github app followed by the reason, because a job that ran as the App is never closed out as a person.

## The intro, for fun

A badge that ran out is no reason to borrow someone else's.

## The punchline, for fun

So the claims stay put, and the page says why.

## The options, in plain words

A. A. Leave the claims as they are and say why in the job's release line, so no claim is ever cleared by a person's account on behalf of the App.
B. B. Release them with the machine's own GitHub login, so nothing stays claimed, though the action would be taken by a person's account.
C. C. Keep asking for a fresh token for a longer time before giving up, and only then leave the claims as they are.

## What I had to decide

Whoever owns the runner fleet. Releasing as the machine is one branch in releasedAs (runner.ts) and would cost the guarantee in the spec that an App job never runs as a person; leaving the claims is the reversible side.

## What I did meanwhile

releasedAs in runner.ts keeps the job's token current with keepGithubToken. When none is left, it skips the release, sets the release error to github app: followed by the reason, and prints that line with every token masked. A job whose token file is gone is treated the same, with the reason that the job has no token kept on this machine.

## What it costs to change later

Small. Letting the machine release instead is one branch; a claim left in place is cleared by a later release or by a person, and nothing is lost.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Who clears a claim left in place, and when, is not settled by the PRD.
- (author) Whether the sweep should retry the release of such a job later, once the app answers again, is not settled.
