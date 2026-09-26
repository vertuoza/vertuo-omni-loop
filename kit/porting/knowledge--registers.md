# `kit/lib/knowledge/registers.mjs`

Source: `scripts/registers.mjs` @ `vertuo-ai-domain@c4a210122`.

## Mapping applied

- `KNOWLEDGE_DIR` / `PRODUCT_DIR` / `DOMAINS_DIR` / `CROSS_DOMAIN_DIR` module-level constants →
  three exported functions of `ctx`: `productDir(ctx)`, `domainsDir(ctx)`, `crossDomainDir(ctx)`,
  each built from `ctx.layout.knowledgeRoot`. Not in the task's "produces" list by name, but added
  so `check-knowledge.mjs` can build the same paths for its own violation messages without
  duplicating the `${knowledgeRoot}/…` string-building.
- `GLOSSARY_FILE` constant: dropped from this module. The glossary path lives on
  `ctx.config.paths.glossary` and is read only by `check-knowledge.mjs` (this module never touched
  the glossary file itself — only `glossaryTermOf` parses a domain README's own `Glossary term:`
  line, which needed no path).
- `OLD_REGISTER_PATHS` constant: deleted — an upstream migration artefact (the two paths the
  knowledge folder replaced in `vertuo-ai-domain`); the kit was never around for that migration.
- `repoRoot` (resolved from `import.meta.url`) and the `{ root = repoRoot } = {}` default-parameter
  pattern: deleted. Every function that read the knowledge folder now takes `{ ctx }` and reads
  `ctx.root`.
- `readKnowledge(root = repoRoot)` → `readKnowledge({ ctx })`.
- `readRegisters(root = repoRoot)` → `readRegisters({ ctx })`.
- `resolveId(id, root = repoRoot)` → `resolveId(id, { ctx })`.
- No CLI half in this module to begin with — `registers.mjs` never had a
  `process.argv[1] === fileURLToPath(...)` block, so rule 3 of the Port Protocol applies vacuously.
- The module doc comment: reworded to describe the folder generically (`ctx.layout.knowledgeRoot`
  instead of the literal `docs/knowledge/`), and its "who else reads this" paragraph updated to name
  the kit's own modules (`check-knowledge.mjs`, `describe.mjs`) instead of `vertuo-ai-domain`'s
  `decision-coverage.mjs` / `outbox.mjs`, which do not exist here.
- Every other export (`ID_SHAPE`, `ID_TOKEN`, `PRODUCT_CODE`, `LAYER_FILES`, `idsCitedIn`,
  `codeOf`, `idParts`, `parseEntryFile`, `glossaryTermOf`, `servedBy`) is unchanged — none of them
  read `root` or a repository literal upstream.
- `FIELD_LINE` clarification from the task brief ("no leading dash") required no change: upstream's
  regex already had no leading dash (`^(Why|Decided|…):\s*(.*)$`).
- The `docs/adr/` → `ctx.layout.adrDir` mapping row in the task's table does not apply to this
  module: `docs/adr` never appears as a module literal here, only as example *data* inside test
  fixtures (a `Source:` value that happens to look like an ADR path) — recorded, not changed.

## Test (`registers.test.mjs`)

- Every `root` positional argument to `readKnowledge`/`resolveId` in the ported tests became
  `{ ctx: flatCtx(root) }` (`kit/test/flat-layout.mjs`, which points `knowledgeRoot` at
  `docs/knowledge` — the same path upstream used, so no file-path literal inside any test needed to
  change).
- `codeOf`, `idParts`, `idsCitedIn`, `parseEntryFile` tests: unchanged, byte for byte — none of them
  touch `root`/`ctx`.
- **Deleted**: the whole `describe('readRegisters / resolveId / servedBy — against the knowledge
  folder this repo ships', …)` block (6 `it`s: the eight Core Invariants, `resolveId('N2')`, the two
  kept rule ids, the eleven domains, `servedBy` for `P-PRODUCT-1`, and the two "resolves to null"
  cases). Every one of them called `readKnowledge()` / `resolveId(id)` with no root, i.e. against
  the real `vertuo-ai-domain` checkout's own `docs/knowledge/` — the case the Port Protocol names
  explicitly ("a test case that reads the real upstream repository … is deleted and listed"). None
  of their assertions could be ported without inventing a stand-in fixture that would test something
  else entirely, so they are deleted rather than rewritten.
- No other assertion changed.

## After the port: PRD #68, slice s2 — a proposed entry

Kit-only, no upstream counterpart. `FIELD_LINE` reads a `Proposed: <who> <YYYY-MM-DD>` line; each
entry carries `proposed` (`{ by, on }`, or `null` for a law; a malformed line reads as
`{ by: null, on: null }`, still proposed) and `problems` (the malformed line, naming the file, for
the checker to refuse). `registerCounts({ ctx })` is new: per register folder, its laws and its
proposed entries, for `omni kb status`. Tests added in `registers.test.mjs`; no ported assertion
changed.
