# ADR-0021 — ADR-0017 — /omni:terraform commits its config proposal as a separate commit inside its one docs-only pull request

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

The spec's step 6 says `/omni:terraform` proposes config "as a diff", and step 7 says it opens "one docs-only pull request". It does not say whether that diff is committed on `branches.terraform` or only shown in the body, nor whether `.omni-loop/config.yml` counts as docs. The before/after page shows `config.yml` gaining "values terraform learned", and s7's done-when says "the config proposals applied". It also does not say whether an empty `commands.checks` list counts as unset, for "a command that is `null`".

## Decision

/omni:terraform applies learned values to .omni-loop/config.yml as their own chore(config) commit in its single docs-only pull request, so the reviewer can keep or drop them. The body lists each key, old to new, with the file that shows it.

The option chosen: A. The settings change is its own step inside the one review request, which lists each value and the file that shows it.

## Consequences

A constant: a few lines of skill prose, before or after merge. No stored data depends on it; a terraform pull request already opened keeps its shape until the next run rewrites it.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s5-01-terraform-config-proposal-is-its-own-commit`
