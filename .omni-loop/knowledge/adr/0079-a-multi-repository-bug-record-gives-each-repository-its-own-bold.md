# ADR-0079 — A multi-repository bug record gives each repository its own bold-named line, and the check skips the single-repository file checks

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1118 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1119

## Context

The shape of a per-repository line in a multi-repository bug record, and which single-repository checks it skips.

## Decision

In a bug record fixed across several repositories, each reproduction and guard line starts with the repository's name in bold, short or full. With a Fixes table, the check skips the File and Red lines and does not check Mutation per repository.

The option chosen: A. A. A bold name per line, either name accepted, File and Red not checked with a Fixes table, Mutation not checked per repository

## Consequences

One small parser in the bug check and its tests; the bug-fix skill built later writes to whatever shape this check reads.

## Source

`.omni-loop/delivery/shipped/1118-mega-care-bug-fix/outbox/settled.md`, entry `s2-01-fixes-record-line-format`
