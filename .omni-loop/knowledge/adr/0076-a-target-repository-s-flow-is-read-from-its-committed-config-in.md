# ADR-0076 — A target repository's flow is read from its committed config in the local checkout by the plan repository's command, never by running the target's code

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1089 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1090

## Context

Whether reading a target's committed rules this way, by running the plan repository's command inside the target's checkout, is acceptable until the command can read a target's rules from GitHub directly.

## Decision

When building in another repository, the plan repository's own tool reads that target's committed rules from its local checkout without running the target's code; a target with no rules gets the default ones, and rules that changed since planning are raised as a decision for a person.

The option chosen: A. Keep it: the plan repository's command reads each target's committed rules in its checkout, with a fallback to the usual rules and a decision raised when the rules moved.

## Consequences

Small: sentences in the ultra and target skills; a later CLI change letting omni flow check merge --repo read the target's committed config from GitHub would replace the cd step with one flag.

## Source

`.omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md`, entry `s7-02-target-flow-read-in-clone`
