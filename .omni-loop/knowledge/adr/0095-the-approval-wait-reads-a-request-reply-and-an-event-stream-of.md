# ADR-0095 — The approval wait reads a request reply and an event stream of asked, re-asked, approved and voided news with rising ids

**Status:** adopted · **Date:** 2026-10-09 · **PRD:** #1322 · **Decided:** nobody — adopted when raised (medium), 2026-10-09 · **Merged:** @pierrederval, 2026-10-09, PR #1324

## Context

Contract the kit relies on (kit/lib/approval/stream.ts, kit/lib/approval/wait.ts), for s2 and s3 to match. POST /api/dossiers/approval/request, body {repo: 'owner/name', prd: number}, answers 200 {asked: [{login: string, name?: string|null}], nobodyElse: boolean, author: string, product: string|null}; nobodyElse true means only the author is asked (asked may then be empty or hold the author). 401 after one token refresh means signed out (exit 1); any other 4xx is 'refused (<status>)', exit 1; 5xx or unreachable is retried as a failed try. GET /api/dossiers/approval/stream?repo=&prd= with Accept: text/event-stream and Last-Event-ID when resuming answers 200 text/event-stream; events: 'asked' and 're-asked' with data equal to the request's reply shape; 'approved' with data {approver: login, approvedAt: ISO time, pinned: number of files}; 'voided' with data {pusher: login, kind: string, from: full sha256, to: full sha256} (the kit prints the first 7 characters); 'ping' and 'reconnect' with no data and no id. Every other event carries an increasing id; the kit drops an id it has seen. 'reconnect' makes the kit reconnect at once; a stream that closes before any message counts as a failed try. An approval already in force is read through the existing GET /api/dossiers/approval before any request. Small choices taken with it: a repository with no product says 'this repository has no other approver'; the approved time prints as the ISO string the server sends, as omni approval does.

## Decision

POST approval/request answers who was asked, whether only the author is left, the author and the product. GET approval/stream sends asked, re-asked, approved (who, when, files pinned) and voided events with rising ids; ping and reconnect carry none, and the kit drops ids it has seen.

The option chosen: A. A. Keep the shapes as recorded here, with the approved event carrying who, when and how many files.

## Consequences

A renamed field is a one-line change in the kit's schema and in the server's service; nothing is stored in this shape.

## Source

`.omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md`, entry `s4-01-approval-stream-contract`
