---
form: architecture
form-version: 1
state: blank
points-to: null
evidence: []
terraformed: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:AGENTS.md#boundaries and libs/LIBRARY_STYLE_RULES.md — changes in kit/porting/templates--architecture.md -->

# Architecture

Use this page when deciding where code goes, and what it may depend on.

## Layout
<!-- slot: layout · required -->
A package's name says which layer it belongs to, so a boundary is legible from the tree alone.
Scripts that orchestrate the whole repository live in one place at its root, never inside a package.

## Boundaries
<!-- slot: boundaries · required -->
- Dependencies point down, from the apps through the layers to the infrastructure wrappers. A lower
  layer never imports a higher one.
- What two layers both need, and that knows nothing of either, moves down to the lowest layer, so
  each reaches it without an edge that points up.
- Separate product areas never import each other's domain code; they meet in exactly one place, the
  app's composition root.
- A boundary is enforced by a check wherever one can be. Name the check beside the rule; a rule only
  review enforces says so.

## Patterns
<!-- slot: patterns · optional -->
- Every value that crosses a system boundary (config, external input, an API contract, a service
  interface) is validated there by a schema, and its type is derived from that schema.
- Storage is reached through one layer. Only that layer runs queries; the logic above it calls it
  and never touches the database; the transport above that calls the logic, never the storage.
- A file's name says its role.
