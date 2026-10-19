---
screen: product-knowledge-graph
status: draft
kind: page
mock: product-knowledge-graph.html
implements: ["apps/galaxy/app/app/products/[id]/knowledge/graph/page.tsx", apps/galaxy/src/knowledge-graph/tab/KnowledgeGraph.tsx, apps/galaxy/src/knowledge-graph/tab/graph-page.ts, apps/galaxy/src/knowledge-graph/tab/graph-page.css]
reads: [apps/galaxy/src/knowledge-graph/tab/graph-page.controller.ts, apps/galaxy/src/knowledge-graph/product-graph.service.ts, apps/galaxy/src/product-knowledge/KnowledgeTab.tsx, apps/galaxy/src/products/products.css, apps/galaxy/src/nav/SectionTabs.tsx]
routes: [/app/products/<id>/knowledge/graph]
supersedes: null
---

## Purpose

How the rules, Legal entries and words of every repository of a product connect, and how fresh each
repository's data is (PRD 1798). Read-only, reached from the Knowledge tab's heading; the tab stays the
marked one. The address holds what is shown: `?q=` the search, `?node=` the picked node, `?depth=` 1 to 3.

## Regions

- **The heading:** the product's name, `← Products`, the words `Knowledge graph. Read-only.`, `← Knowledge`.
- **The tabs:** the product home's, `Knowledge` marked.
- **Repositories:** one row per linked repository: its short name, then `@<commit> · pushed <date time>
  by @<login>`, or `never pushed · run omni kb graph push`, or, for a link whose
  knowledge is not served, `Its knowledge is not pushed here.`
- **Nodes:** a search box and `Search`, a count (`2 of 4 nodes`), then one row per node: its id (a link),
  where it comes from as a pill (its repository's short name, `Legal`, `Glossary` or `Never`), its kind and
  its text. The first 100 are listed; a longer graph says so and is searched down.
- **The picked node:** headed by its id, its text, `Depth 1`, `Depth 2`, `Depth 3` (the shown one marked),
  its neighbourhood grouped by distance (`picked`, `1 away`, ...), each with its pill, then its edges as
  `from → kind → to`.
- **Unresolved,** only when not empty, `Missing from the product’s Knowledge.` (Knowledge links to the tab): each Legal id or term a repository names that the product does not
  hold, with the node and repository that name it.

## States

- **No repository linked:** `This product links no repository yet.`
- **Nothing matches:** `No node matches this search.` A picked id the graph lacks: `No such node in this graph.`
- **Signed out, no workspace, no database, unreadable, no such product:** the product home's notices.

## Words

Knowledge graph · Repositories · Nodes · Search · Depth 1 · Depth 2 · Depth 3 · picked · away · Legal ·
Glossary · Never · never pushed · Unresolved · Read-only.

## Refusals

- No control edits a node, a Legal entry or a term; the only form is the GET search.
- No age makes a repository "stale": the page shows the commit and the push time, nothing more.
- The existing `/knowledge` map (PRD 149) is not this page and is not changed.

## Open questions

- The graph is a list and a walk, not a drawing. Is a drawn graph worth its weight once products hold hundreds of nodes?
- A Never line is labelled `Never`; the spec says Legal or Glossary. Is `Never` right, or should it read `Legal`?
- Should the page offer a link from a node to its repository's file on GitHub?

## Source

- PRD 1798 s6, drawn by hand (no `/omni:pixel-perfect mock` run); no browser tool was available to look at the built page.
- .omni-loop/delivery/inbox/1798-knowledge-graph-api/spec.md
