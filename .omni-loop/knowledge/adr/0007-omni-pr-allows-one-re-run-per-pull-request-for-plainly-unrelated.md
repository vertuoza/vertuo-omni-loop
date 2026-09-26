# ADR-0007 — /omni:pr allows one re-run per pull request for plainly unrelated failures, without a triage page

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

The re-run rule of `/omni:pr`, since upstream's rule depended on its CI-triage page, which does not exist here.

## Decision

When a check fails in code the branch did not touch, such as a runner, network or timeout failure, /omni:pr may re-run the failed jobs once per pull request. That re-run counts toward limits.attempts; every other red check is fixed in code.

The option chosen: A. One re-run per PR when the failure is plainly unrelated, the option built.

## Consequences

One list in `kit/plugin/skills/pr/SKILL.md`; a config key if a triage page is wanted later.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s4-04-one-rerun-without-triage-page`
