---
id: s1-06-ci-check-counts-skipped-runs
prd: 2898
slice: s1
rank: high
bears-on: ADR-0006
raised: 2026-11-15
wave: 4
---

## The question, in plain words

Check 1 (CI green) fails as soon as one CI job was skipped, and every pull request here skips some jobs on purpose, so no mission's pull request could ever be marked ready. Should a skipped or neutral job stop counting against check 1?

## The decision, in plain words

Nothing changed yet: check 1 follows the spec word for word, so a skipped job is not green. On the last commit of pull request 2872 it would read not green, naming five skipped jobs and the neutral approval check.

## The options, in plain words

A. A. Skipped and neutral jobs are left out; failed, cancelled and timed-out jobs are red (recommended).
B. B. Keep the spec as written, and change CI so a labelled draft skips no job.
C. C. Check 1 counts only the jobs that the full-suite setting names.

## What I had to decide

Whether check 1 counts a skipped or neutral check run as red. Recommended: count only failure, cancelled, timed_out and action_required as red, treat skipped and neutral as not counted, and keep check 2 (each ready.full job succeeded) as the guard that the real suite ran.

## What I did meanwhile

Check 1 stays as the spec reads it, so omni / ready would read not ready on every gated pull request of this repository until it is changed.

## What it costs to change later

One function in kit/lib/ready/checks.ts (ciCheck) and its tests, and the spec's check 1 sentence; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a run that only skipped or was cancelled is not green, but this repository's CI skips jobs on purpose on every pull request.
