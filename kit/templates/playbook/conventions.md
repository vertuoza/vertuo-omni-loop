---
form: conventions
form-version: 1
state: blank
points-to: null
evidence: []
invaded: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/briefing.md, docs/agents/definition-of-done.md#commit-shape and docs/adr/0058-identifiers-are-english-interface-copy-is-french.md — changes in kit/porting/templates--conventions.md -->

# Conventions

Use this page when naming things, formatting files, or shaping commits.

## Naming
<!-- slot: naming · optional -->
Identifiers and the words a user reads are separate questions. Identifiers (types, functions,
files, packages, tables and columns, routes, message keys, stored values, config keys) use one
language, the one the code already uses. Interface copy follows the product's own language rules.
Conflating the two is what lets a label leak into a table name; keeping them apart lets either move
without touching the other.

## Formatting
<!-- slot: formatting · optional -->
Format only the files you touched. A formatter run across the whole tree makes a pull request
unreviewable; drift that predates you is fixed in a change of its own.

## Commits
<!-- slot: commits · optional -->
Conventional Commits, one coherent change each:

- `feat:` a user-visible capability or workflow addition.
- `fix:` a behaviour correction.
- `docs:` a documentation-only change.
- `refactor:` a structure change with no behaviour change.
- `test:` a test-only change.
- `chore:` tooling, dependencies, or repository maintenance.
