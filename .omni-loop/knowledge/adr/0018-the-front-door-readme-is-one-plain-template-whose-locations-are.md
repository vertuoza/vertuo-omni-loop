# ADR-0018 — The front door README is one plain template whose locations are filled from the repository's config when written

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

The spec says `omni kb init` writes the front door's `README.md` when it is missing, "pointing at `paths.knowledge` when the registers live elsewhere", and the plan gives s2 "the front door README template" under `kit/templates/`. Neither says whether that template is a form (front matter and slots, resolved per section) or a plain page, where it sits under `kit/templates/`, or how one text points elsewhere.

## Decision

The kit ships a single plain Markdown front door page, kit/templates/README.md, naming the knowledge, decision-record and playbook folders by config placeholders filled in at write time, rather than variant pages or an overridable form.

The option chosen: A. One plain page, whose locations are filled in from the repository's settings when it is written.

## Consequences

A constant before s3 writes the file: the template's text, its path in `templates.mjs` and one test. After s3 merges, a repository that already holds its front door page keeps it, since `omni kb init` never changes an existing file; only new installs see a change.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s2-01-front-door-page-filled-from-settings`
