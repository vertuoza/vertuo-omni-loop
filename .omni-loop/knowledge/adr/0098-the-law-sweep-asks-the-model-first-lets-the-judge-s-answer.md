# ADR-0098 — The law sweep asks the model first, lets the judge's answer replace it, and leaves unjudged rules waiting

**Status:** adopted · **Date:** 2026-10-10 · **PRD:** #1342 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-10, PR #1343

## Context

Whether the sweep needs the model key, and what happens to a rule nobody could judge.

## Decision

The sweep asks a language model the harvest's worth-a-law question for each untested rule, and the judge's answer replaces it when the judge is on. A rule nobody could judge stays unenforced and listed as not judged, and laws.requireProof stays off until every rule has an answer.

The option chosen: A. A. Ask the model first, the judge's answer counts when it gives one; an unanswered rule waits, and the switch stays off.

## Consequences

One branch in the sweep command: dropping the model call or setting requireProof regardless is a few lines.

## Source

`.omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md`, entry `s6-01-sweep-asks-the-model-first`
