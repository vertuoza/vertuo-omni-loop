---
form: decisions
form-version: 1
state: filled
points-to: null
evidence:
  - .omni-loop/knowledge/adr/0001-outbox-check-as-github-app.md@3ae738d
  - .omni-loop/knowledge/product/principles.md@dfa5a26
  - .omni-loop/knowledge/product/rules.md@76417f1
  - .omni-loop/knowledge/product/invariants.md@b7b2573
terraformed: 2026-09-25
---

# Decision records

Use this page when recording a decision about how this repository is built, or looking one up.

## Where they live
<!-- slot: where · required · by: terraform -->
Here, in `.omni-loop/knowledge/adr/`, beside this page. The product registers beside it, in
`.omni-loop/knowledge/product/`, hold no principle, rule or invariant yet.

## Format
<!-- slot: format · required · by: terraform -->
One file per record, `NNNN-<slug>.md`, shaped like the first record here:

- The title is `# ADR-NNNN — <the decision>`.
- Under it, one status line: `**Status:** accepted · **Date:** <YYYY-MM-DD> · **PRD:** #<n>`, and
  `· **Supersedes:** <what>` when it replaces part of an earlier PRD's spec.
- A record harvested from a settled outbox decision carries two more fields on that status line:
  `· **Decided:** <who>` and `· **Merged:** @<merger>, <YYYY-MM-DD>, PR #<n>`. `Decided:` takes one
  of three forms: `@<answerer> via <channel>, <date>` when a person answered,
  `nobody — adopted when raised (medium), <date>`, or `@<merger> — merged over a red outbox, <date>`.
  Its status is `accepted` when a person answered, and `adopted` otherwise.
- Then `## Context`, `## Decision`, a `## What it supersedes in <that spec>` section when it
  supersedes one, naming each section it changes, and `## Consequences`.
- A harvested record ends with `## Source`, naming the ledger file and the entry it came from.

## Numbering
<!-- slot: numbering · optional -->
