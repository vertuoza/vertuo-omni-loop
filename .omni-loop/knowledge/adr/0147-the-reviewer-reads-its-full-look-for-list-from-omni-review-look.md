# ADR-0147 — The Reviewer reads its full look-for list from omni review look-for, while omni kb show keeps printing the repository's section in place of the kit default

**Status:** adopted · **Date:** 2026-11-15 · **PRD:** #2871 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-15, PR #2872

## Context

The spec says a repository's look-for section adds to the kit default and never removes from it, while `omni kb show` resolves every section by replacing the kit default with the repository's text (kit/lib/playbook/resolve.ts, outside s1's territory). s1 added `omni review look-for`, backed by kit/lib/review/look-for.ts: the kit default's list items, then the list items of the section the repository resolves to, a repeat dropped; prose around the items adds nothing. The curated settings page's look-for is prose naming the six, so it adds nothing. s2's skill should read `omni review look-for`.

Decided by: Jev (hardToRevert 0.44) · agent said false

## Decision

omni review look-for prints the kit's six look-for items first, then each list item the repository's section adds, dropping any repeat of the six. omni kb show review still shows the repository's section in place of the default, as it does for every section.

The option chosen: A. A. A new review command prints the full list, and the playbook page shows the repository's section as written (built).

## Consequences

A constant: making kb show merge the two instead is a change to the resolver for one slot, with no stored data to move.

## Source

`.omni-loop/delivery/shipped/2871-reviewer/outbox/settled.md`, entry `s1-02-look-for-extends-default`
