---
id: s1-02-guard-runs-in-security-workflow
prd: 2305
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

Which automatic check on a pull request should run the new open-source guard: the security check that also runs the secret scanner, or the main test check?

## The decision, in plain words

The guard runs as its own job in the security check, beside the secret scanner, on every pull request: drafts, slices and ready ones alike. It is also run by the whole test suite, so the main test check catches it too.

## The intro, for fun

Two new guards needed a post, so they share one sentry box.

## The punchline, for fun

Same box, two lamps, every pull request walks past.

## The options, in plain words

A. A. Its own job in the security workflow, on every pull request, beside gitleaks (built).
B. B. A step of the main checks of a ready pull request and of the quick check of drafts and slices.

## What I had to decide

Keep A unless the team wants the guard listed under the main checks of a ready pull request; then B moves the job's one step into that workflow and its quick sibling.

## What I did meanwhile

Every pull request shows an open-source job and a gitleaks job under the security workflow; the full test run also fails on a finding, through the guard's own test of every tracked file.

## What it costs to change later

A constant: one job moved between two workflow files, and their shape tests updated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan says the CI workflow runs it without naming which; the security workflow was the one place that already speaks for secrets and needs no install (author).
- If main's branch protection later requires named checks, the security workflow's two jobs must be listed there by a person (author).
