# ADR-0024 — Re-runs follow the repository's CI page: only a listed known red outside the change is re-run, once

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

The spec's wiring table gives `/omni:pr` (watch to green) and `/omni:wave` (a red slice) the `ci` form: "which checks exist and gate, the known reds, when a re-run is allowed". Before this PRD, `/omni:pr` allowed one re-run per PR for any failure plainly not the branch's (a runner, network or timeout failure), because no CI-triage page existed (PRD 7's item s4-04, recorded in `kit/porting/plugin--pr.md`). The `ci` form's kit default (s2, its `rerun` slot) allows a re-run only for a listed known red the branch does not touch, so a repository that lists none gets no re-run. `/omni:wave` never re-ran a red slice. The spec does not say whether the form replaces the old allowance or adds to it, nor what the wave does with a red slice whose failure is a known red.

## Decision

/omni:pr and /omni:wave re-run a failed check only when the repository's ci page lists it as a known red in ground the change did not touch, once. With nothing listed, every failure is the change's to fix. This replaces ADR-0007's allowance for runner, network and timeout failures.

The option chosen: A. Re-runs follow the repository's page about its checks: only a failure listed there as known is run again, once, and a failed slice whose failure is one gets that one re-run too.

## Consequences

Prose only, before or after merge: one step in `kit/plugin/skills/pr/SKILL.md` and one paragraph in `kit/plugin/skills/wave/SKILL.md`, no code and no stored data. Restoring the old allowance as a fallback is one sentence in `/omni:pr`'s step 3.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s6-01-reruns-follow-the-ci-form`
