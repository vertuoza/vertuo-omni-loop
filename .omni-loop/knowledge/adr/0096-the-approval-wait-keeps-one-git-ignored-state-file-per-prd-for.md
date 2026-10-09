# ADR-0096 — The approval wait keeps one git-ignored state file per PRD for the HUD band, left with its last state when it ends

**Status:** adopted · **Date:** 2026-10-09 · **PRD:** #1322 · **Decided:** nobody — adopted when raised (medium), 2026-10-09 · **Merged:** @pierrederval, 2026-10-09, PR #1324

## Context

File: .omni-loop/local/approval-wait/<n>.json (the folder carries the existing .gitignore of .omni-loop/local). Content: {prd: number, state: 'waiting'|'approved'|'voided'|'held'|'signed-out'|'timeout'|'refused', line: the line just printed, waiting: the current waiting line or null before anyone is asked, at: ISO time it was written}. Written on every line printed after the request; left in place with the last state when the command exits. Not written when the command stops before asking (no ask.url, no sign-in, PRD not found). s5 reads it: show 'waiting' while state is waiting or held, and highlight 'approved' or 'voided' for 10 seconds from 'at', then fall back to 'waiting' after a void.

## Decision

omni's approval wait writes one file per PRD under .omni-loop/local/approval-wait/, holding the PRD, state, the line printed, the waiting line and when it was written. It is left with its last state on exit and not written if the wait stops before asking.

The option chosen: A. A. One file per PRD under the private folder, left with its last state.

## Consequences

Moving or reshaping the file is a constant in the kit's wait module and in the band; it is never committed.

## Source

`.omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md`, entry `s4-02-waiting-file`
