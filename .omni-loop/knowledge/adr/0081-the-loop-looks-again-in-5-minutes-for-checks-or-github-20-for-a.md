# ADR-0081 — The loop looks again in 5 minutes for checks or GitHub, 20 for a claim elsewhere, and parks a stuck slice on a person

**Status:** adopted · **Date:** 2026-10-07 · **PRD:** #1139 · **Decided:** nobody — adopted when raised (medium), 2026-10-07 · **Merged:** @pierrederval, 2026-10-07, PR #1142

## Context

The wake hint for each kind of wait, in seconds, and whether a stuck slice parks or waits.

## Decision

While checks run or GitHub cannot be read, the loop wakes again after 300 seconds, and after 1200 seconds while another session holds a slice. A stuck slice with nothing else to take parks the work on a person, with the feature PR's link.

The option chosen: A. 5 minutes for checks and GitHub, 20 for claims; a stuck slice parks on a person.

## Consequences

A constant each; parking versus waiting is one row of the verdict.

## Source

`.omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md`, entry `s1-02-wake-and-stuck`
