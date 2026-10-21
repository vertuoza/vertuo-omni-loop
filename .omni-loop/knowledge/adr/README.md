---
form: decisions
form-version: 1
state: filled
points-to: null
evidence:
  - .omni-loop/knowledge/adr/0001-outbox-check-as-github-app.md@3ae738d
  - .omni-loop/knowledge/product/principles.md@7d7cd8d
  - .omni-loop/knowledge/product/rules.md@1c17512
  - .omni-loop/knowledge/product/invariants.md@00edca5
invaded: 2026-10-20
---

# Decision records

Use this page when recording a decision about how this repository is built, or looking one up.

## Where they live
<!-- slot: where · required · by: invade -->
Here, in `.omni-loop/knowledge/adr/`; the product registers are in `.omni-loop/knowledge/product/`.

## Format
<!-- slot: format · required · by: invade -->
One file per record, `NNNN-<slug>.md`:

- Title: `# ADR-NNNN — <the decision>`.
- Under it, a status line: `**Status:** accepted · **Date:** <YYYY-MM-DD> · **PRD:** #<n>`, plus
  `· **Supersedes:** <what>` when it replaces part of an earlier PRD's spec.
- A record harvested from a settled outbox item adds `· **Decided:** <who> · **Merged:**
  @<merger>, <YYYY-MM-DD>, PR #<n>`. `Decided:` is `@<answerer> via <channel>, <date>` (a person
  answered: `accepted`), `nobody — adopted when raised (medium), <date>` or
  `@<merger> — merged over a red outbox, <date>` (both `adopted`).
- Then `## Context`, `## Decision`, `## What it supersedes in <that spec>` (if so, naming each
  section it changes), `## Consequences`; a harvested record ends with `## Source` (ledger file,
  entry).

## Numbering
<!-- slot: numbering · optional -->
The next free number, printed below with the latest 20 records, read from the folder: no hand-kept
list. `omni kb show decisions --all` prints every record: look a decision up there, or search the
folder, before writing a new one. One number, one record: a shared one is a mistake to fix, never
a precedent.
