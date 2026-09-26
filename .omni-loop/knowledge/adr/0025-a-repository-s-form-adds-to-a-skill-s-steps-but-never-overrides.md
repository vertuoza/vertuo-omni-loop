# ADR-0025 — A repository's form adds to a skill's steps but never overrides the skill's rules

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

The spec wires each skill to read its forms through `omni kb show`, and decision 2 ranks the layers inside one form (pointer, then repository section, then kit default). It does not say how a form's text ranks against the skill that reads it: for example a filled `briefing` or `pull-requests` section saying to merge once green, while `/omni:pr` never merges a PR into `repo.defaultBranch`.

## Decision

When a repository's form, such as a filled briefing or pull-requests section, conflicts with a delivery skill's rule, the skill wins. Forms add steps and detail but never loosen what a skill forbids, such as merging into the default branch.

The option chosen: A. The skill's rules win; a repository's page only adds to them.

## Consequences

Prose only, before or after merge: one sentence in the step 0 of seven `SKILL.md` files. No code and no stored data depend on it.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s6-02-a-form-never-overrides-a-skill-rule`
