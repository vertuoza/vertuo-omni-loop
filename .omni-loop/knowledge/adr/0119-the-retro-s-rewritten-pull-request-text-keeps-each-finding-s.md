# ADR-0119 — The retro's rewritten pull request text keeps each finding's outcome and closes settled lessons' issues, leaving the quoted rule words to the diff

**Status:** adopted · **Date:** 2026-10-22 · **PRD:** #2338 · **Decided:** nobody — adopted when raised (medium), 2026-10-22 · **Merged:** @pierrederval, 2026-10-22, PR #2339

## Context

Keep the rewrite as built (A), or leave the pull request's text alone once the settling skill has written it (B).

## Decision

When the retro rewrites its pull request text on a replay or the day-14 look, each finding shows where its lesson went or why it stays, and each settled lesson's issue is closed. The rule's exact words live only in the change itself.

The option chosen: A. Rewrite the text, keeping each outcome and closing each settled lesson's issue (built)

## Consequences

B is a check in the publish step before it rewrites the text: no stored shape changes.

## Source

`.omni-loop/delivery/shipped/2338-retro-apply/outbox/settled.md`, entry `s4-03-retro-body-rewrite-keeps-outcomes-not-quotes`
