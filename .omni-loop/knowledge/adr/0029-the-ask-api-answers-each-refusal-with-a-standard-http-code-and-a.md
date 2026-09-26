# ADR-0029 — The ask API answers each refusal with a standard HTTP code and a status field, and treats a repeated close or abandon as success

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #71 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #73

## Context

The spec's contract table fixes each call's success shape only. s1's hooks, built in the same wave, must tell a closed session from a network failure ("a `closed` session deletes `ask.json`"). Also unset: the success status (200 or 201), whether close and abandon may be repeated, what `/answers` does on a round the page already answered, and the input limits.

## Decision

Ask API refusals use standard codes with a short reason (401, 403, 404, 409 closed or answered, 503), and the hooks fall back to the terminal on any refusal. Closing a session or abandoning a question twice returns the same success.

The option chosen: A. Answer each refusal with a standard code and a short reason, and accept closing or giving up twice, the option built.

## Consequences

Each is a constant or one branch in `apps/galaxy/src/ask/api.ts` and its test; no stored data depends on it. If s1's hooks already read another shape, one side's code changes, not the database.

## Source

`.omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md`, entry `s2-02-contract-refusals`
