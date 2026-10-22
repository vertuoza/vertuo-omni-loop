---
id: s2-01-app-token-in-a-file
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A job that runs as the GitHub App needs a short-lived access token on the runner's machine. Where should the runner keep it while the job runs?

## The decision, in plain words

The token sits in a private file beside the job's log, readable by the runner's owner alone, and the tools the job uses read it from there. It is never placed in the job's environment, and it is removed when the job ends.

## The intro, for fun

A token is a house key: nobody leaves it under the doormat.

## The punchline, for fun

This one lives in a locked drawer and is shredded after the job.

## The options, in plain words

A. A. A private file beside the job's log, read through the runner's own command; every past token stays masked.
B. B. An environment variable of the job: simplest, but visible to every process and every printed environment.
C. C. A private file holding only the current token: smaller, but a past token is no longer masked.

## What I had to decide

Pick A to keep the token in a private file read through `omni runner github-token`. Pick B only if you accept that every process of the job, and any line it prints, can see the token. Pick C if past tokens need not be masked.

## What I did meanwhile

Option A is built: the file is `~/logs/job-<id>.github` (mode 0600), the credential helper, the `gh` on `PATH` and `githubEnv` read it, and the runner masks every token the job ever had in the log and in everything it sends. A crash leaves the file for the log sweep to take.

## What it costs to change later

Switching to B is a small change in `kit/lib/runner/runner.ts` and `kit/lib/env/read.ts`, but it breaks the rule that credentials never appear in clear in a log (L-GDPR-2): `env` and process listings would show it. Switching to C is a constant, but a past token leaked in a log would no longer be masked.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a job on a shared machine can read another user's home is outside the runner: the file is 0600 under the runner's own home.
- (author) A concurrent refresh of the same job's file could lose a past token (read-modify-write); the refresh is slice s3's, which should serialize it.
