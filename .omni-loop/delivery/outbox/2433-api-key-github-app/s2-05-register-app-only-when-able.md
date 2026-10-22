---
id: s2-05-register-app-only-when-able
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A runner tells the server at sign-up whether it can run a job as the GitHub App. When should it say yes?

## The decision, in plain words

The runner says yes only when it was started with the means to hand a job its token, so the server never gives an app job to one that cannot serve it. If keeping the token on the machine fails, the job ends as failed with one plain reason.

## The intro, for fun

Say yes only to a job you can actually do.

## The punchline, for fun

A runner that cannot hold the key never gets handed one.

## The options, in plain words

A. A. Register as able only when the runner holds its token command.
B. B. Always register as able, and fail the job when the token cannot be kept.

## What I had to decide

Pick A to register as able only with the token command in hand. Pick B to always register as able, and let a job fail when the token cannot be kept.

## What I did meanwhile

Option A is built: register sends `githubApp: true` only when the runner has its token command; a failure to write the token file ends the job `failed` with the reason `github app: the token could not be kept on this machine`.

## What it costs to change later

Switching to B is one line in `kit/lib/runner/runner.ts`, but every runner started in a way that cannot serve the token would take app jobs and fail them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The failure reason is deliberately generic so no path or token reaches the Omni page; slice s7 may want a richer one.
