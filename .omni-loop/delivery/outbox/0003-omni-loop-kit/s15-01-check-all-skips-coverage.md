---
id: s15-01-check-all-skips-coverage
prd: 3
slice: s15
rank: high
bears-on: none
raised: 2026-09-25
wave: 10
---

## The question, in plain words

When the full check runs without a copy of the main branch to compare against, should it skip the coverage part or fail?

## The decision, in plain words

It skips the coverage part and says so in one line, so a fresh repository with no remote still checks clean.

## The options, in plain words

A. Skip the coverage part with a one-line note when the main branch is missing, the option built.
B. Fail the whole check until the main branch is fetched, so coverage can never be skipped in silence.

## What I had to decide

What `omni check all` does when `<repo.remote>/<repo.defaultBranch>` does not resolve: skip `coverage` or exit non-zero.

## What I did meanwhile

`check all` runs inbox, outbox and knowledge always, and coverage only when the ref exists; otherwise it prints `coverage: skipped — no <ref>`. `check coverage` alone with no ref exits 2 naming the ref. An explicit `--base` that does not resolve is always an error.

## What it costs to change later

One branch in `kit/bin/commands/check.mjs`. The phase-2 outbox workflow must fetch the base (fetch-depth 0 or an explicit fetch) or coverage is skipped in CI; making it fatal later is a one-line change plus the fixture tests that rely on a remote-less repo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any CI this kit is installed into checks out without the base branch, which would make the skip silent in practice.
