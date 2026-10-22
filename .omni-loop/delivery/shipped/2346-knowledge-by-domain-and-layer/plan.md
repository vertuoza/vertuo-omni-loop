# Plan: Knowledge found by domain and layer

PRD #2346, its spec beside this plan (`spec.md`). The feature branch
`feat/knowledge-by-domain-and-layer` goes into `main` through the feature PR (`Closes #2346`); each
slice is a sub-PR from `feat/knowledge-by-domain-and-layer--<slice>` into the feature branch.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The canonical layers and roles, their alias tables and definitions; the optional `layers` config key; `contracts.kinds` and `plan.targets[].role` read through the aliases; `omni check config` refuses a layer key outside the list and flags an unknown word and a pattern matching no tracked file; the guide page | `kit/lib/layers` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/bin/commands/check.ts` `kit/bin/check-config.test.ts` `docs/guide/knowledge-map.md` `docs/guide/meta.json` | — | 1 | build |
| s2 | `Layers:` on rules and invariants, `**Layers:**` and `**Domain:**` on an ADR's status line; `omni check knowledge` refuses a non-canonical layer and a domain with no folder, and accepts a locked law with no `Governs:`; a law moved between domain folders with `Kept id:` is not demoted | `kit/lib/knowledge/registers` `kit/lib/knowledge/check-knowledge` `kit/lib/playbook/decisions` `kit/lib/outbox/decision-coverage.test.ts` | s1 | 2 | build |
| s3 | The lookup: each file's domain (flow areas with `knowledge`) and layers; `omni kb laws --paths` and `--slice` print Applies here, Global (Legal entries included), then the count of what is hidden, with `--json` groups and the old `laws` array; the five made-up changes of the spec as a test; the skills that quote the output say it | `kit/lib/knowledge/disclose` `kit/lib/knowledge/briefing-laws.ts` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` `kit/test/fixtures/knowledge-map/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/plan/` `kit/plugin/skills/do-work/` `kit/plugin/skills/bug-fix/` `kit/test/plugin.test.ts` | s1, s2 | 3 | deep |
| s4 | `omni kb graph` gains `domain` and `layer` edges, an ADR is reached from a file of its layer, and `kb graph --paths` resolves files as the lookup does | `kit/lib/knowledge/graph` `kit/lib/knowledge/neighbourhood` `kit/lib/knowledge/product-graph` `kit/bin/kb-graph` `apps/galaxy/src/knowledge-graph/` | s3 | 4 | build |
| s5 | Canonical roles on the Omni page: the migration maps the aliases, `product_repository_link()` refuses a new non-canonical role, the Repositories tab's Role is a select of the nine with an old value flagged, and `omni targets` flags it | `supabase/migrations/` `apps/galaxy/src/product-repositories/` `kit/lib/product/targets` `kit/bin/commands/targets.ts` `.omni-loop/knowledge/design/screens/product-repositories` | s1 | 2 | build |
| s6 | `/omni:invade` and `--refresh` propose `layers`, knowledge areas, domain folders (ids kept, text byte for byte) and ADR layers, from evidence, as proposed entries; `/omni:mega-invade` copies each target's `layers` | `kit/plugin/skills/invade/` `kit/plugin/skills/mega-invade/` `kit/porting/plugin--invade.md` | s3 | 4 | build |
| s7 | This repository's refresh: `/omni:invade --refresh` run here proposes its `layers`, areas, domain folders and ADR layers, `omni kb owners` rewrites CODEOWNERS, and the five made-up changes each find their rule under Applies here | `.omni-loop/config.yml` `.omni-loop/knowledge/` `.github/CODEOWNERS` | s4, s5, s6 | 5 | deep |

**Shared ground.** `kit/test/plugin.test.ts` is s3's (wave 3); s6 (wave 4) only reads it and adds
its assertions to its own skill text, so no two waves edit it. `.omni-loop/knowledge/` (s7, wave 5)
holds `.omni-loop/knowledge/design/screens/product-repositories` (s5, wave 2): the waves keep them
apart. `kit/bin/commands/kb.ts` is s3's: s4 reaches the graph through `kit/lib/knowledge/` and the
lookup s3 exports, and is built after it. `kit/dist/` is generated: no slice lists it.

## Per slice: done when

### s1
- `CANONICAL_LAYERS` holds the ten layers and `CANONICAL_ROLES` the nine roles, each with a one-line
  definition; `LAYER_ALIASES` and `ROLE_ALIASES` hold the spec's table.
- A config with `layers: { db: [^supabase/] }` parses; `layers: { database: [...] }` is refused,
  naming the key and the ten layers.
- `contracts.kinds: [rest]` reads as `api`; `[eventz]` is a `not ok` line of `omni check config`
  naming it, and `omni plan check` still accepts it.
- `omni check config` flags a `layers` or flow-area pattern that matches no tracked file, naming it.
- `docs/guide/knowledge-map.md` defines every layer and role and shows the alias table, and is listed
  in `docs/guide/meta.json`.

### s2
- `Layers: db, auth` parses on a rule and an invariant; `**Layers:** db` and `**Domain:** ask` parse
  on an ADR's status line.
- `omni check knowledge` refuses `Layers: database-ish` and an ADR `Domain:` with no folder, naming
  the entry, and accepts a locked law with no `Governs:`.
- A law moved from `product/` to `ask/` with `Kept id:` does not fire `law-demoted`.

### s3
- With a flow area `ask` (`knowledge: ask`), `omni kb laws --paths apps/galaxy/src/ask/ask.service.ts`
  prints BR-PRODUCT-12 under **Applies here**, marked `domain ask`, on the fixture.
- A lookup on one migration file lists the `db` ADRs and the rules naming `db`, and no rule of
  another domain naming no `db`.
- A locked law of another area is not printed; the last line counts them. Every Legal entry prints
  under **Global**.
- With no `layers` and no knowledge area, every entry prints under **Global**, the entries today's
  output lists.
- `--json` carries `applies`, `global`, `hidden` and keeps `laws`.
- The five made-up changes of the spec's **Problem** pass as one test in `kit/bin/kb.test.ts`.
- The brainstorm, plan, do-work and bug-fix skills describe the new output where they quote it.

### s4 (`ui: yes`)
- `kb graph --paths <migration>` reaches an ADR tagged `**Layers:** db` through a `layer` edge, and
  a rule of the file's domain through a `domain` edge; `same-prd` edges stay.
- The pushed graph validates against the graph schema with the two new edge kinds, and the Omni
  page's knowledge graph reads it.

### s5 (`ui: yes`)
- After the migration, a link stored as `back-end` reads `api`, `front-end` reads `web`, `docs` reads
  `doc`; a role the alias table does not hold is unchanged.
- `product_repository_link()` refuses a new role `back-end` (22023, hint `role`), accepts `null` and
  accepts a row's own unchanged old value.
- The Repositories tab's Role field is a select of the nine roles; a flagged old value is its first
  option, with `<role> is not a role: pick one` under the row; the render test holds both.
- `omni targets` flags a target whose role is not one of the nine, naming it.
- The draft screen `product-repositories` matches what was built.

### s6
- The invade skill names `layers`, knowledge areas, domain folders with `Kept id:`, ADR layers, the
  proposed state and the `TODO(human)` line for what it cannot place; `kit/test/plugin.test.ts`
  holds it to that.
- The mega-invade skill copies each target's `layers` beside its `flow`.

### s7 (`law: every locked law moved into a domain folder · owner @pierrederval or @dervalp`)
If a locked law is moved wrong, an agent stops seeing the rule it must not break, and the people it
protects (members, the gate, the ledger) lose that protection: its owners approve this pull request
on GitHub.
- `.omni-loop/config.yml` declares `layers` and knowledge areas; `omni check config` is green.
- Every moved entry keeps its id (`Kept id:`) and its text byte for byte; `omni check knowledge` is
  green; CODEOWNERS follows the files that hold laws.
- On this branch, the five made-up changes each find their rule under **Applies here**, N-PRODUCT-18
  included.
