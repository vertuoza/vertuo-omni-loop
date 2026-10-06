# ADR-0067 — An editor with a missing, wrong or revoked link still connects and answers each tool call with the make-a-new-link line

**Status:** adopted · **Date:** 2026-10-01 · **PRD:** #855 · **Decided:** nobody — adopted when raised (medium), 2026-10-01 · **Merged:** @pierrederval, 2026-10-01, PR #856

## Context

Whether a link that does not work fails the connection, or answers each question with the one line.

## Decision

The editor connects and lists the tools even with a bad link; each tool call answers, as a tool error, the one line saying to make a new link on Settings › Business. A missing or malformed link never reaches the database.

The option chosen: A. Connect, list the tools, and answer each call with the one line as a tool error (built).

## Consequences

A constant: answering HTTP 401 instead is a few lines in the route and its test.

## Source

`.omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md`, entry `s2-01-link-refused-as-tool-answer`
