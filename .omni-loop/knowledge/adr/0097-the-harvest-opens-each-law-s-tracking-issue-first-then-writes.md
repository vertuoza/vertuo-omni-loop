# ADR-0097 — The harvest opens each law's tracking issue first, then writes the rule pending that issue in a second call

**Status:** adopted · **Date:** 2026-10-10 · **PRD:** #1342 · **Decided:** nobody — adopted when raised (medium), 2026-10-09 · **Merged:** @pierrederval, 2026-10-10, PR #1343

## Context

How the harvest learns each law issue's number before it writes 'pending' with that number, while staying a pure function that returns edits as data.

## Decision

finishHarvest stays pure: a first call works out every rule and returns the law issues to open. The caller opens them and calls again with their numbers, writing the same entries pending those issues. An issue left without a rule is closed by a person.

The option chosen: A. Open the issues first from a first pass, then write the rules pending them in a second pass (built).

## Consequences

A small change in two functions and the command that calls them: the second call could become one call with a placeholder, or the issues could open after the knowledge is written.

## Source

`.omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md`, entry `s4-02-law-issue-opens-before-its-entry`
