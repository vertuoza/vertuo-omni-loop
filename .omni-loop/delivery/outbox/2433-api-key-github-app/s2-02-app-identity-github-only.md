---
id: s2-02-app-identity-github-only
prd: 2433
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When a job runs as the GitHub App, which hosts should the app's identity apply to: GitHub alone, or every host the job talks to?

## The decision, in plain words

The app's sign-in and the rewrite of ssh addresses apply to GitHub alone. The sign-in methods already set up on the machine keep working for every other host.

## The intro, for fun

The bot's badge opens the GitHub door and no other door.

## The punchline, for fun

Every other lock keeps the key it already had.

## The options, in plain words

A. A. GitHub alone: the helper and the rewrite name only GitHub, and every other host keeps the machine's own sign-in.
B. B. Every host: one helper for all, and the token is offered to hosts that are not GitHub.

## What I had to decide

Pick A to limit the app's sign-in to github.com. Pick B to give it to every host, which would break a job that pushes to another host.

## What I did meanwhile

Option A is built: the job's git configuration sets an empty then a real helper for `credential.https://github.com.helper`, and rewrites `git@github.com:` and `ssh://git@github.com/` to https, so a push can never fall back to the machine's own ssh key or helper for github.com.

## What it costs to change later

Moving to B is a change to the keys `gitConfigVariables` is given in `kit/bin/github.ts` and `kit/lib/runner/github-app.ts`, a few lines, but it would send the app's token to hosts that are not GitHub.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A GitHub Enterprise host is not covered: the plan names github.com only.
- (author) Whether a job ever pushes to another host is not stated in the spec.
