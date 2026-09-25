# `kit/lib/inbox/collisions.mjs`

Source: `scripts/inbox-collisions.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- No shebang line, no CLI half existed in this module upstream — it always exported only two pure
  functions with no filesystem access of its own. Nothing to delete under rule 3.
- `import { parsePlanSlices, sharedGround } from './check-territory.mjs'` → `import {
  parsePlanSlices, sharedGround } from './territory.mjs'` — the sibling module's own rename (this
  task, `kit/lib/inbox/territory.mjs`).
- `planFromMarkdown(prd, markdown)`, `planTerritory(plan)` (private), `planCollisions(plans)`: all
  **unchanged**. Neither takes a `root`, a `ctx`, nor any literal this task's mapping table
  replaces — the task's own interface list names both exports with no new parameter, and its own
  clarification says this module is "pure … port their upstream tests verbatim."
- Module doc comment: reworded to drop the one `libs/vertuo-domain-tenant/` example path (matches
  `kit/test/no-literals.test.mjs`'s `/vertuo/i` pattern) in favor of "the same shared library",
  and `scripts/check-territory.mjs` → `territory.mjs` (the sibling module's new kit path).

## Test (`collisions.test.mjs`)

Pure module, ported verbatim — only the import path changes.

- `import { planCollisions, planFromMarkdown } from './inbox-collisions.mjs'` → `from
  './collisions.mjs'`. Nothing else in the file changes: every fixture (`plan(rows)`, `row(id,
  territory)`, including their own `libs/vertuo-domain-tenant/`-style literal paths — fine here,
  since `kit/test/no-literals.test.mjs` only scans non-test `.mjs` files) and every `expect(...)`
  is byte-identical to upstream.
- **Deleted:** nothing — no case here reads the real upstream repository or depends on anything
  this task's mapping table changed.

## Gate

`pnpm vitest run kit/lib/inbox/collisions.test.mjs kit/test/no-literals.test.mjs` — 7/7 pass (6 in
`collisions.test.mjs`, 1 in `no-literals.test.mjs`).
