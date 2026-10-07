# ADR-0070 — An area inherits the default area's rules with the stricter limit winning, and landings.alone is an area checked last

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1089 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1090

## Context

The spec says an area inherits the default area's rules unless it says inherit: false, and how rules combine across a slice's areas, but not how an area's own value meets an inherited one. I took the cross-area rule for inheritance too: the strictest limit, the union of requireChecks, approval and territory: block stick; an area's own merge method and its own replace hook win over the default's. inherit: false also drops the default area's hooks, not only its rules. landings.alone reads as an area named landings.alone placed after the declared areas, so a path a declared area claims follows that area's rules first.

## Decision

An area adds its own rules to the default area's, keeping the strictest limit; its own merge method and replace hook win. Only inherit: false loosens a limit, and it drops default hooks too. landings.alone is an area checked after all declared ones.

The option chosen: A. Keep it: inherited rules combine like rules across areas, the stricter limit wins, and the old 'land alone' paths are checked after the named parts.

## Consequences

A constant change in kit/lib/flow/resolve.ts and its tests: letting an area's own limit override the inherited one, keeping default hooks under inherit: false, or putting the landings.alone area first is a few lines, no stored data moves.

## Source

`.omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md`, entry `s1-01-area-inheritance`
