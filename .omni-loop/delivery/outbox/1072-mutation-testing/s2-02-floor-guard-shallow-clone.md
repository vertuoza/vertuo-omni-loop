---
id: s2-02-floor-guard-shallow-clone
prd: 1072
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The check that refuses lowering a quality floor compares with the main branch. Where the main branch is not downloaded, as in the pull request test job, what should it do?

## The decision, in plain words

It skips there and holds everywhere the main branch is present: on every agent's copy and in the preflight. A lowered floor can only reach main if nobody ran the tests locally.

## The intro, for fun

A guard that compares with the main branch needs the main branch in the room.

## The punchline, for fun

In the test job it is not invited, so the guard waits by the door.

## The options, in plain words

A. A. Skip the check where the main branch is not downloaded, the option built: it holds on every copy and in the preflight, not in the pull request tests.
B. B. Download the main branch in the pull request test job with one more step, so the check runs on every pull request too.
C. C. Fail the check where the main branch is not downloaded, which turns the pull request tests red until B is done.

## What I had to decide

Whether the pull request test job should also fetch the main branch so the floor guard runs there too.

## What I did meanwhile

`scripts/mutation-floor.test.ts` reads `origin/main:mutation/floor.json` and compares; when `origin/main` is not a known ref (the `checks` workflow's test shards use a depth-1 checkout), that one test is skipped, visibly, by `it.skipIf`. When main has no floor file yet (this feature branch), it passes: the first floors. A second test, always run, holds that the floor file names exactly the core's modules.

## What it costs to change later

One step in `.github/workflows/checks.yml` (outside this slice's territory): `git fetch --depth=1 origin main` before the tests, or `fetch-depth: 0` on the test job's checkout. No change in the guard.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the test job's checkout depth is a deliberate speed choice; the fallow job already uses `fetch-depth: 0`
