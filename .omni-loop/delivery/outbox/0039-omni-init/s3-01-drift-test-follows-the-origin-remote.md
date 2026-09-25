---
id: s3-01-drift-test-follows-the-origin-remote
prd: 39
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The installer file records the kit's own GitHub address when it is built, taken from the copy it is built in. Should the check that keeps the committed file up to date also accept a copy built from someone's fork?

## The decision, in plain words

No: the check compares the committed file with a fresh build of the same copy, so a fork builds a file naming the fork and the check fails there until the fork commits its own. In this repository and its CI nothing changes.

## The options, in plain words

A. Compare with a fresh build that reads the address from the checkout's origin remote (built).
B. Pin the address for the drift build, so a fork's tests stay green but its bundle names the upstream.
C. Skip the drift test when the origin remote is not the kit's own repository.

## What I had to decide

Whether kit/test/dist.test.mjs should pin the kit address (left open by s1-02) or compare against a fresh build that reads it from the checkout's origin remote.

## What I did meanwhile

The drift test runs kit/build.mjs unchanged, so the address comes from `git remote get-url origin` as s1-02 adopted; the committed bundle records vertuoza/vertuo-omni-loop and the closing steps' marketplace line uses that same address.

## What it costs to change later

One define in kit/build.mjs and one test; pinning later is a constant, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether forks or clones without an origin remote must be able to run pnpm test green was not settled by the spec or s1-02.
