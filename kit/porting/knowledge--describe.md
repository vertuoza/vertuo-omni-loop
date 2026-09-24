# `kit/lib/knowledge/describe.mjs`

Source: `scripts/knowledge.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `describeEntry(knowledge, id)`: unchanged signature and body — it takes the already-parsed
  `knowledge` object (whatever `readKnowledge({ ctx })` returned), never a root or a path, so no
  literal in this function needed replacing.
- **No CLI half** (Port Protocol rule 3): deleted `main()` and the trailing
  `if (process.argv[1] === fileURLToPath(import.meta.url)) main();` block, and the now-unused
  `fileURLToPath` import and the `readKnowledge` import (only `main()` called it). Task 15 rebuilds
  the CLI.
- Module doc comment: trimmed the `pnpm knowledge <id>` CLI invocation line and the PRD #1081
  reference (upstream-specific), kept the "why this is derived, not written by hand" explanation
  since it documents `servedBy`'s real purpose here.
- `LINES`, `oneLine`, `describeEntry`: byte-for-byte identical to upstream otherwise.

## Test (`describe.test.mjs`)

- `readKnowledge(tree(FIXTURE))` → `readKnowledge({ ctx: flatCtx(tree(FIXTURE)) })`, wrapped in a
  local `knowledgeOf(files)` helper. `FIXTURE`'s paths (`docs/knowledge/...`) are unchanged, since
  `flatCtx`'s `knowledgeRoot` is `docs/knowledge`, the same path upstream used.
- All four scenario assertions unchanged.
- **Deleted**: `it('prints the product principle the two moved rules serve, from the real
  folder', …)` — called `readKnowledge()` with no root, against the real `vertuo-ai-domain`
  checkout. The Port Protocol's explicit real-repo exclusion; no fixture stand-in was substituted,
  since the scenario ("the two moved rules") names entries specific to that repository's own
  history and has no equivalent in a kit-agnostic fixture.
