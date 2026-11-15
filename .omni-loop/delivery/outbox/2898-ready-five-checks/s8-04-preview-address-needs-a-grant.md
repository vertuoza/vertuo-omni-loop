---
id: s8-04-preview-address-needs-a-grant
prd: 2898
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

To run the screen tests on a pull request's preview, the runner must ask GitHub for the preview's address, and the Omni App's jobs are not allowed to read it today. Should the App's jobs be allowed to read deployments?

## The decision, in plain words

Not in this change: with a fixed test address the fallback works now, and with the preview the runner tries, fails naming why, and the proof stays not finished saying so. Allowing it is a person's call on what the App may read.

## The intro, for fun

The runner has the map, but nobody gave it the address.

## The punchline, for fun

It knocks, says it cannot get in, and waits politely.

## The options, in plain words

A. A. Keep the jobs' rights; the fallback runs on a fixed address, and says why on a preview: what was built.
B. B. Let the App's jobs read deployments, once every installation accepted it.

## What I had to decide

Pick A to keep the jobs' rights as they are, or B to let the App's jobs read the previews' addresses.

## What I did meanwhile

With `e2e.url: github-deployment`, `runAcceptance` asks `gh api repos/<slug>/deployments?sha=<sha>` with the job's token, which holds only `contents`, `pull_requests`, `issues` and `metadata` (`APP_PERMISSIONS`, apps/galaxy/src/public-api/keys/github-app.ts), and the App's manifest (`apps/omni-app/app.yml`) asks no `deployments` either. GitHub refuses, the job's log ends `omni-acceptance: failed — the preview's address could not be read: …`, and check 3 reads `not finished` with `the runner's e2e run gave no result (…); a new commit runs it again`. A fixed `e2e.url` runs as built. This repository runs its scenarios in CI (s5-07), so it never needs the fallback.

## What it costs to change later

B is `deployments: read` in the manifest and in `APP_PERMISSIONS`, its line in `test/app-yml.test.ts`, and each installation's owner accepting the new permission; asking it before every installation accepts would fail every job's token.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a product that runs its scenarios on a runner keeps a fixed test address, or needs its previews
