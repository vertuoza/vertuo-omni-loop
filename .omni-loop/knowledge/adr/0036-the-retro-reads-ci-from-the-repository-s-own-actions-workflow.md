# ADR-0036 — The retro reads CI from the repository's own Actions workflow runs and job logs, never from check runs

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #72 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #75

## Context

Which GitHub API the checks kind's `gather` reads CI from. The spec's detector table and decision 6 ask for "check runs on every sub-PR commit plus the last lines of each failed job's log", while its Flow and decision 14 say the retro "never reads or writes a check run", which s2 pinned in `apps/omni-app/src/retro/retro.test.mjs` as no request whose route names `check-runs`. The plan's done-when for s3 names no API.

## Decision

The retro's checks gather reads only the repository's own Actions workflow runs, their jobs and the tail of each failed job's log. Check runs posted by other services, such as the outbox check or preview deployments, are not counted.

The option chosen: A. Read only the repository's own automated workflows and their logs, the option built.

## Consequences

One `gather` and its tests. Reading `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` instead gives records of the same shape (an Actions job's check run carries the job's name), but needs s2's route test narrowed to the outbox check's own run, and each sub-PR's commits listed first. The finding ids stay the same, so retro issues already opened are found again.

## Source

`.omni-loop/delivery/shipped/0072-retro/outbox/settled.md`, entry `s3-01-checks-read-from-actions`
