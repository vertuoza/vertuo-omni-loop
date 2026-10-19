# Plan: The knowledge graph from the CLI

PRD #1797, the spec beside this plan (`spec.md`). The feature branch `feat/knowledge-graph-cli`
goes into `main` with `Closes #1797`; each slice is a sub-PR from `feat/knowledge-graph-cli--<slice>`
into the feature branch with `Part of #1797`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni kb graph <id>` prints the neighbourhood of one entry at depth 1, as text and as the versioned `--json` contract (`version: 1`, `shape: "neighbourhood"`), with the repository's own edges `serves` (up and down), `enforced-by`, `governs`, `points-to`, `cites`, `sibling` and `same-prd` (a decision record's `**PRD:** #n` header), the 6-line cut, the product line reading `none` or `offline`, an unknown id exiting 1, and `kb graph` / `kb graph --json` with no start unchanged | `kit/lib/knowledge/neighbourhood` `kit/lib/playbook/decisions` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` | — | 1 | deep |
| s2 | the neighbourhood reaches screens (`screen`, through a screen's `implements` or `reads` meeting the entry's `Governs:`) and the product's cached knowledge: `Serves: L-…` to a Legal node (or the `not in the cached product knowledge` label), `uses-term` on a whole word in any case, `origin: "product"` in the JSON, and the product line's `cached <date> (<key>)` and unreadable-cache states, reading the cache only, never the network | `kit/lib/knowledge/neighbourhood` `kit/lib/product/knowledge` `kit/lib/design/screens` `kit/bin/kb.test.ts` | s1 | 2 | build |
| s3 | `omni kb graph --paths <file>…` prints one block per entry whose `Governs:` matches (laws first, then rules, in register order; `kb graph — no entry governs those files.` otherwise), `--depth 2` and `3` walk entry nodes only, indented two spaces per hop, a node printed once, `--depth 4` or `--paths` with an id or with no file exits 2 with the usage line, and the help entry and `kit/README.md` describe the verb | `kit/lib/knowledge/neighbourhood` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` `kit/lib/help/entries.ts` `kit/README.md` | s2 | 3 | build |

**Shared ground.** `kit/lib/knowledge/neighbourhood` (the module and its test) and
`kit/bin/kb.test.ts` are declared by s1, s2 and s3; `kit/bin/commands/kb.ts` by s1 and s3. The three
slices run one after another, in waves 1, 2 and 3, so each builds on the one before and none
conflicts. `kit/dist/` and `apps/omni-app/api/` are generated: each slice rebuilds them to test and
commits none; the wave rebuilds them once after merging.

## Per slice: done when

### s1 (deep: the walk and the JSON contract P6 reuses)

- `kit/lib/knowledge/neighbourhood.ts` exports the neighbourhood's types (`Neighbourhood`, its node
  and edge kinds) and a pure builder over `readKnowledge`'s entries and the decision records; the
  types are what P6 (PRD 1798) imports.
- `kit/lib/knowledge/neighbourhood.test.ts`, on a knowledge folder held in memory (`memorySource`):
  one fixture per edge for `serves` (up from a rule, down from a principle), `enforced-by` (a path,
  and no edge for `pending #<n>`), `governs` (one `path:` node per pattern), `points-to` (one
  `schema:` node per file of a contract), `cites`, `sibling` and `same-prd`; each edge absent when
  its source line is.
- `kit/lib/playbook/decisions.ts` reads a record's `**PRD:** #n` header (a record without it has
  none), tested in `kit/lib/playbook/decisions.test.ts`.
- `kit/bin/kb.test.ts` through `main()`: `kb graph <id>` prints the start line (id, kind, status,
  headline, `enforced by: pending #<n>` when so), aligned columns, at most 6 lines per edge kind then
  `… and <k> more (--json lists them all)`, and the product line last (`none` or `offline`);
  `--json` parses whole and carries `version: 1`, `shape: "neighbourhood"`, `repo`, `start`,
  `depth`, `product`, every node (with `status`, `file`, `origin`, `hop`) and every edge, never cut;
  an unknown id exits 1 with `kb graph: no entry "<id>" in the knowledge folder.`; `kb graph` and
  `kb graph --json` with no start print what they print today.
- On this repository, `omni kb graph BR-PRODUCT-3` names P-PRODUCT-3 (up), its test and its two
  `Governs:` patterns (down), and PRD 7's decision records (side), and
  `omni kb graph P-PRODUCT-3` lists BR-PRODUCT-3 as `down serves`.

### s2

- `neighbourhood.test.ts`: `screen` matched through `implements` and through `reads`, not matched
  when no path meets `Governs:`, its label the screen's status; a Legal node from `Serves: L-…` in
  the cache, and the `not in the cached product knowledge` label when it is not; `serves` down from a
  Legal entry start; `uses-term` on a whole word in any case and never inside a longer word; the
  three product states and a cache that cannot be parsed (`offline — the cached product knowledge
  could not be read`).
- `kb.test.ts`: with a cache in the fixture repository, the last line is `product knowledge: cached
  <YYYY-MM-DD> (<product key>).` and Legal and term nodes carry `origin: "product"` and `file: null`
  in the JSON; with none, no Legal or term node appears.
- No code path of `omni kb graph` reaches the network: the cache is read from its file only.

### s3

- `kb.test.ts`: `--paths` with a match (one block per entry, laws first, then rules, in register
  order), with no match (the one line), and with a rule that has no `Governs:` (never reached);
  comma- and space-separated files read as `omni kb laws --paths` reads them; `--depth 2` adds the
  neighbours of each entry at hop 1, indented, no node printed twice, leaves never walked; `--depth 3`
  likewise; `--depth 4`, `--depth 0`, `--paths` with an id and `--paths` with no file exit 2 with the
  usage line.
- `neighbourhood.test.ts`: depth 1, 2 and 3 on one fixture, a node reached twice kept at its first
  hop.
- `omni help kb` and `kit/README.md`'s knowledge graph paragraph name `<id>`, `--paths`, `--depth`
  and the neighbourhood JSON.
