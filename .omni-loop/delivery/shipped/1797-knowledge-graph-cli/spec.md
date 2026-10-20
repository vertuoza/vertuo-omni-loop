---
prd: 1797
title: The knowledge graph from the CLI
blocked-by: [1795, 1796]
spec: file
---

## Problem

An agent that must change a rule, or a file a rule governs, cannot see what the rule rests on or
what rests on it without reading whole registers.

- `omni kb graph` (PRD 149, `kit/lib/knowledge/graph.ts`) prints the whole knowledge folder: a
  summary, or with `--json` every entry and every link. Here that is 189 entries and 124 KB of JSON.
  It knows two links only, `serves` and `cites`. It refuses an id: `omni kb graph BR-PRODUCT-3`
  prints `usage: omni kb graph [--json]` and exits 2 (`kit/bin/commands/kb.ts:194`).
- `omni kb laws --paths <file>…` (PRD 1726, `kit/lib/knowledge/disclose.ts`) names the rules that
  govern a file, one headline each, and stops there. It says nothing of the test that proves a rule,
  the principle it serves, the decision records of the same PRD, or the screens that show the
  governed code.
- The links exist, scattered. A register entry's field lines (`FIELD_LINE`,
  `kit/lib/knowledge/registers.ts:142`) hold `Serves:`, `Enforced by:`, `Source:` and 1726's
  `Governs:` and `Locked:`. A screen's front matter holds `implements` and `reads`
  (`kit/lib/design/screens.ts`, folder `.omni-loop/knowledge/design/screens/`). A decision record
  names its PRD on its header line (`**PRD:** #7`, `.omni-loop/knowledge/adr/`). Nothing joins them.
- The roadmap adds three more kinds of link. PRD 1795 (P3) lets a rule serve a Legal entry (`L-…`)
  and gives the product a Glossary, both kept on the product's Omni page and cached in each
  repository. PRD 1796 (P4) adds domain contract entries whose `Points to:` line names the schema
  files that enforce them. An agent has no way to walk any of them.

## Solution

`omni kb graph` takes a start and prints its **neighbourhood**: one plain line per node, never a
whole register.

```text
omni kb graph                          unchanged: the whole folder's summary (PRD 149)
omni kb graph --json                   unchanged: the whole graph, version 1 (PRD 149)
omni kb graph <id>                     the neighbourhood of one entry
omni kb graph --paths <file>…          the neighbourhood of every entry whose Governs: matches
omni kb graph … --depth <n>            walk n hops between entries (1 by default, at most 3)
omni kb graph … --json                 the neighbourhood as JSON: the contract P6 reuses
```

`--paths` reads its files exactly as `omni kb laws --paths` does: comma-separated or space-separated,
matched by `governsPath` (`kit/lib/knowledge/disclose.ts:38`), so a rule with no `Governs:` line is
never reached by a file.

### The edges

Each edge is read from a file that exists today or that 1795 and 1796 add. Nothing is inferred from
prose beyond what PRD 149 already reads (`cites`).

| Edge | From → to | Read from | Direction from the start |
|---|---|---|---|
| `serves` | rule, invariant or contract → principle or Legal entry | the `Serves:` line; a Legal id `L-…` as 1795 defines it | up (the start serves), down (the start is served) |
| `enforced-by` | entry → test file | the `Enforced by:` line, when it names a path | down |
| `governs` | entry → path pattern | 1726's `Governs:` line, one node per pattern | down |
| `points-to` | contract → schema file | 1796's `Points to:` line, one node per file | down |
| `cites` | entry → entry | an id named in the statement or `Why:` (PRD 149's link) | side |
| `sibling` | entry → entry | both serve the same principle or Legal entry | side |
| `screen` | entry → screen | a screen whose `implements` or `reads` holds a path the entry's `Governs:` matches | side |
| `same-prd` | entry → decision record | a record whose `**PRD:** #n` is the PRD the entry's `Source:` names (`prdOf`, `graph.ts:84`) | side |
| `uses-term` | entry → glossary term | a Glossary term of the cached product knowledge that the statement uses as a whole word, any case | side |

An edge is always stored in its natural direction (a rule `serves` a principle, whichever end the
walk started from). Up, down and side are how the text reads an edge relative to the start.

### The nodes

| Kind | Id | Label |
|---|---|---|
| `principle`, `rule`, `invariant` | the entry id (`BR-PRODUCT-3`) | the statement's first sentence (`headline`, `disclose.ts:46`) |
| `legal` | `L-…`, from the cached product knowledge | its first sentence |
| `contract` | the id 1796 gives a domain contract | its one-line lifecycle |
| `test` | `test:<path>` | none |
| `path` | `path:<pattern>` | none |
| `schema` | `schema:<path>` | none |
| `screen` | `screen:<name>` | the screen's status, `draft` or `locked` |
| `adr` | `ADR-<nnnn>` | its title |
| `term` | `term:<word>` | its one-line definition |

Only entry nodes (principle, rule, invariant, legal, contract) are walked further at depth 2 or 3.
Tests, paths, schemas, screens, decision records and terms are leaves. A node reached twice is
printed once, at the first hop that reaches it.

### The text

```text
$ omni kb graph BR-PRODUCT-3
BR-PRODUCT-3 · rule · law, locked by @pierrederval — When the only red check is the outbox context and only person-answered items remain, /omni:pr reports this in the status comment and stops.
  up    serves       P-PRODUCT-3                    principle  The outbox gate stays red until a person answers the open questions, and the agent never overrides it on anyone's behalf.
  down  enforced-by  test:kit/test/plugin.test.ts   test
  down  governs      path:^kit/plugin/skills/(pr)/  path
  down  governs      path:^kit/test/plugin\.test\.ts$  path
  side  same-prd     ADR-0006                       adr        Without a named summary check, every reported check except the outbox check decides that a pull request is green
  …     (five more same-prd lines, ADR-0007 to ADR-0011)
  side  same-prd     … and 3 more (--json lists them all)
product knowledge: offline — no cached copy of the product's Legal and Glossary; only this repository's links are shown.
```

- The first line is the start: id, kind, its status (`law, locked by @<login>`, `rule`, `proposed`),
  and its headline. A start whose `Enforced by:` is `pending #<n>` says `enforced by: pending #<n>`
  on that line.
- Then one line per node: direction, edge, node id, node kind, label. The columns are aligned.
- At most 6 lines per edge kind per node; past that, one line `… and <k> more (--json lists them all)`.
- At depth 2 or 3, a node's own neighbours are printed under it, indented two spaces per hop.
- `--paths` prints one block per entry it reaches, laws first, then rules, in register order, each
  block as above. No entry governs the files: the one line `kb graph — no entry governs those files.`
- The last line is always the product line (below).

### The product line

The Legal and Glossary nodes come from the local cached copy of the product's Omni page knowledge
that 1795 writes. `omni kb graph` only reads that cache: it never calls the network.

| State | Last line | Legal and term nodes |
|---|---|---|
| `cached` | `product knowledge: cached <YYYY-MM-DD> (<product key>).` | shown |
| `offline` | `product knowledge: offline — no cached copy of the product's Legal and Glossary; only this repository's links are shown.` | none |
| `none` | `product knowledge: none — this repository belongs to no product.` | none |

A `Serves: L-…` line whose Legal entry is not in the cache still prints the edge, with the label
`not in the cached product knowledge`.

### The JSON: the contract P6 reuses

`--json` prints one object. PRD 1798 (P6) publishes the same object from the server, so its fields
are a contract: a field is added only with a new `version`, and none is renamed or removed.

```json
{
  "version": 1,
  "shape": "neighbourhood",
  "repo": "vertuoza/vertuo-omni-loop",
  "start": ["BR-PRODUCT-3"],
  "depth": 1,
  "product": { "state": "offline", "key": null, "cachedOn": null },
  "nodes": [
    { "id": "BR-PRODUCT-3", "kind": "rule", "label": "When the only red check …", "status": "law", "file": ".omni-loop/knowledge/product/rules.md", "origin": "repository", "hop": 0 },
    { "id": "P-PRODUCT-3", "kind": "principle", "label": "The outbox gate stays red …", "status": null, "file": ".omni-loop/knowledge/product/principles.md", "origin": "repository", "hop": 1 },
    { "id": "test:kit/test/plugin.test.ts", "kind": "test", "label": null, "status": null, "file": "kit/test/plugin.test.ts", "origin": "repository", "hop": 1 }
  ],
  "edges": [
    { "from": "BR-PRODUCT-3", "to": "P-PRODUCT-3", "kind": "serves" },
    { "from": "BR-PRODUCT-3", "to": "test:kit/test/plugin.test.ts", "kind": "enforced-by" }
  ]
}
```

- `shape` tells it apart from the whole-folder graph of PRD 149, which keeps its own `version: 1`
  and is unchanged, because the arcade reads it (`apps/galaxy/src/data/knowledge.ts`).
- `status` is `law`, `rule` or `proposed` for a rule or invariant, `null` for any other node.
- `origin` is `repository` or `product` (a Legal entry or a term from the cache).
- `file` is the file the node is read from, `null` for a product node and for a path pattern.
- The JSON is never cut at 6 lines per edge kind: it lists every node.
- The types live in `kit/lib/knowledge/neighbourhood.ts`, exported for P6.

### Errors

- An id that names no entry: `kb graph: no entry "<id>" in the knowledge folder.`, exit 1.
- `--depth` outside 1 to 3, `--paths` with an id, or `--paths` with no file: the usage line, exit 2.
- A cache 1795 wrote that cannot be parsed reads as `offline`, and the product line says
  `offline — the cached product knowledge could not be read`.

## Decisions

- **The graph lives first in the CLI, from the repository's own files, then on the server (P6).**
- **It waits for the new kinds (1795, 1796), so it covers every link from day one.**
- **No screen changes.**
- **The whole-folder graph stays as it is.** `omni kb graph` and `omni kb graph --json` with no
  start print what they print today; the arcade reads that JSON.
- **The edge vocabulary is the nine edges above,** each stored in its natural direction.
- **The neighbourhood JSON is a versioned contract** (`version: 1`, `shape: "neighbourhood"`), which
  P6 reuses as is.
- **`omni kb graph` reads the product cache and never fetches it.** Refreshing the cache is 1795's
  job; the command works the same offline, in CI and in tests.
- **Depth is 1 by default and at most 3.** A deeper walk would print most of a register, which is
  what the command exists to avoid.
- **The text prints at most 6 lines per edge kind per node;** the JSON prints everything.
- **No skill reads the graph in this PRD.** Teaching `/omni:do-work` to run it means a line in
  `kit/test/plugin.test.ts`, which the locked laws BR-PRODUCT-3 and BR-PRODUCT-5 govern; it is left
  to a later PRD so this one touches no law.

## User stories

1. As an agent changing `kit/lib/outbox/decision-coverage.ts`, I run
   `omni kb graph --paths kit/lib/outbox/decision-coverage.ts --json` and get the rules that govern
   it, their tests, their principles and their decision records, in one call.
2. As an agent about to change a law, I run `omni kb graph <id>` and see the principle or Legal
   entry it serves and every rule beside it, before I write a line.
3. As a person reviewing a rule, I read in a dozen lines why it exists, what proves it and which
   screens show the code it governs.
4. As an agent working offline, I still get the repository's links, and one line tells me the Legal
   and Glossary nodes are missing.
5. As the builder of P6, I reuse the JSON shape and its types instead of designing a second one.

## Scope

**In:**

- `kit/lib/knowledge/neighbourhood.ts`: the walk, the edges, the nodes and the JSON types, built
  from `readKnowledge`, `readScreens`, the decision records and the cache 1795 writes;
- reading a decision record's `**PRD:** #n` header (`kit/lib/playbook/decisions.ts`);
- the `graph` verb of `kit/bin/commands/kb.ts`: `<id>`, `--paths`, `--depth`, `--json`;
- the help entry (`kit/lib/help/entries.ts`) and the knowledge graph paragraph of `kit/README.md`;
- the rebuilt `kit/dist/omni.mjs`.

**Out:**

- The server API that publishes the same graph across a product's repositories: P6, PRD 1798.
- Creating, editing and caching Legal and Glossary entries: P3, PRD 1795.
- Domain contract entries and their `Points to:` line: P4, PRD 1796.
- Any screen, including the arcade's knowledge map.
- A skill reading the graph (see Decisions).
- The whole-folder `omni kb graph --json`, which stays as it is.

## Test seams

Following `omni kb show testing`: tests sit beside the code, run on fixtures, and never call GitHub
or the network.

- `kit/lib/knowledge/neighbourhood.test.ts`, on a knowledge folder held in memory
  (`memorySource`, as `graph.test.ts` does):
  - each of the nine edges, from a fixture that holds exactly one of it;
  - `serves` read both ways: up from a rule, down from a principle and from a Legal entry;
  - `screen` matched through `implements` and through `reads`, and not matched when no path meets
    `Governs:`;
  - `same-prd` from a `Source:` naming `PRD #n` to the records whose header says `**PRD:** #n`;
  - `uses-term` on a whole word in any case, and not inside a longer word;
  - depth 1, 2 and 3, a node reached twice kept once, leaves never walked;
  - the three product states, an unknown `L-…` id, and a cache that cannot be parsed.
- `kit/bin/kb.test.ts` through `main()` on `makeRepo()`:
  - `kb graph <id>` text, the 6-line cut and its `… and k more` line;
  - `kb graph --paths` with a match, with no match, and with a rule that has no `Governs:`;
  - `--json` parses and has `shape: "neighbourhood"`;
  - the errors: an unknown id (exit 1), `--depth 4`, `--paths` with an id (exit 2);
  - `kb graph` and `kb graph --json` with no start print what they print today.
- `kit/test/dist.test.ts` keeps the bundle in step.

## Risks

- **What merging publishes.** The kit: `kit/dist/omni.mjs` and the help text. Every repository that
  updates the kit gets the new verb. `omni kb graph` with no start, which the arcade reads, does not
  change.
- **The contract.** P6 builds on the JSON shape. A field renamed after merge breaks P6; the version
  field and the exported types are the guard.
- **1795 and 1796 land first.** This PRD reads the Legal link, the cache and the `Points to:` line as
  they define them. If either names a field differently when it merges, the plan reads their merged
  spec and the edge names here stay the same.
- **Whole-folder JSON is cut when piped.** Today `omni kb graph --json | …` stops at 65,536 bytes of a
  124,475-byte document, so the reader gets broken JSON. The neighbourhood is far smaller, and its
  test pipes it whole; the whole-folder bug is left to `/omni:bug-fix`.
- **Rollback.** Revert the merge. Nothing is stored; no register, screen or decision record
  changes.
- The locked laws: none touched.

## Acceptance criteria

1. `omni kb graph BR-PRODUCT-3` prints the start line, then one line per node: its principle (up),
   its test and its two `Governs:` patterns (down), and the decision records of PRD 7 (side), at most
   6 of them, then `… and 3 more (--json lists them all)`, then the product line.
2. `omni kb graph P-PRODUCT-3` lists BR-PRODUCT-3 as `down serves`.
3. `omni kb graph --paths kit/lib/board.ts` prints the block of every entry whose `Governs:` matches
   that file, and of no other entry.
4. Each of the nine edges appears in the output when its source line exists, and never otherwise.
5. `--depth 2` adds the neighbours of each entry reached at hop 1, indented under it; no node is
   printed twice; `--depth 4` exits 2 with the usage line.
6. With no cached product knowledge, the last line says `offline` and no Legal or term node appears;
   with a cache, Legal entries and the terms a statement uses appear, marked `origin: "product"` in
   the JSON.
7. `omni kb graph <id> --json` is one object with `version: 1` and `shape: "neighbourhood"`, the
   fields shown above, every node listed, and it parses when piped.
8. `omni kb graph` and `omni kb graph --json` with no start print the same output as before this PRD.
9. An unknown id exits 1 with `kb graph: no entry "<id>" in the knowledge folder.`
10. No test calls the network, and the command makes no network call.
