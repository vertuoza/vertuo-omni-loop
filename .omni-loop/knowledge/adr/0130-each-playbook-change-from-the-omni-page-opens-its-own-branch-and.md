# ADR-0130 — Each playbook change from the Omni page opens its own branch and pull request

**Status:** adopted · **Date:** 2026-10-23 · **PRD:** #2417 · **Decided:** nobody — adopted when raised (medium), 2026-10-23 · **Merged:** @pierrederval, 2026-10-23, PR #2479

## Context

Whether a second change to a page with an open pull request opens a new pull request (built) or adds a commit to the open one.

## Decision

Every playbook page change sent from the Omni page opens a new pull request on its own branch, cut from the default branch and named after the page and the UTC send time. It never joins an open pull request, and the pull request names the proposing owner.

The option chosen: A. Every change opens its own branch and pull request (built).

## Consequences

Reusing an open pull request later means the writer first looks for an open branch of that page on GitHub; the branch name's shape is one constant.

## Source

`.omni-loop/delivery/shipped/2417-tech-defaults/outbox/settled.md`, entry `s7-02-one-pull-request-per-change`
