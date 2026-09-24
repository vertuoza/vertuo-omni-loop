# `kit/lib/outbox/settle-head.mjs`

Source: `scripts/settle-head.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- Shebang line: none upstream (this script has no shebang — it is only ever run through `node
  scripts/settle-head.mjs`, never executed directly). No change needed.
- The trailing `if (process.argv[1]?.endsWith('settle-head.mjs')) { ... }` block: deleted in full,
  per rule 3 — it is the whole CLI half (reads `SETTLE_EVENT`/`SETTLE_RUN_SHA`/`SETTLE_HEAD_SHA`/
  `SETTLE_API_ERROR` from `process.env`, calls `decideStale`, writes `$GITHUB_OUTPUT` or falls back
  to `console.log`). A later task rebuilds the CLI. Its only import, `appendFileSync` from
  `node:fs`, is dropped along with it — `decideStale` itself touches no filesystem.
- `decideStale(runSha, headSha, apiError)`: **no other change**. It takes no `root`/`ctx` at all
  (rule 4 applies vacuously — there was never a `{ root = repoRoot }` to convert), and there is no
  repository-specific literal anywhere in its body for rule 5 to touch. Byte-identical logic to
  upstream.
- Module doc comment: reworded to drop the `.github/workflows/ci.yml` literal in favour of "the CI
  workflow", and to say the CLI half belongs to "a later task" rather than naming the deleted
  `if (process.argv[1]...)` block directly.

## Test (`settle-head.test.mjs`)

- **No change at all.** `decideStale` needs no `ctx`, reads no config, and touches no filesystem,
  so none of Port Protocol rule 6's substitutions apply — every import, every case, and every
  assertion is copied verbatim. The only edit is the provenance-adjacent module path, which the
  test file never referenced in the first place (it imports `decideStale` from `'./settle-head.mjs'`
  both upstream and here).
- **Deleted:** nothing — this file has no CLI-driving test and no test that reads the real
  upstream repository, so rule 6's deletion clause never applies.

## Gate

`pnpm vitest run kit/lib/outbox/settle-head.test.mjs kit/test/no-literals.test.mjs` — 6/6 pass
(5 in `settle-head.test.mjs`, 1 in `no-literals.test.mjs`).
