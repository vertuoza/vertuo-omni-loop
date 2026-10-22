---
prd: 1798
title: The knowledge graph API on the server
blocked-by: [1797]
spec: file
---

## Problem

After P5 (#1797), `omni kb graph` draws one repository's knowledge as a graph, in the terminal. A
product is rarely one repository. Its Legal and Glossary live on the Omni page, per product (P3,
#1795), while its rules, invariants and laws live in each repository's `.omni-loop/knowledge/`.
Nobody can see the product's knowledge whole:

1. **The graph stops at the repository.** A rule in the back-end that serves a Legal entry of the
   product, and a front-end rule governing the same Glossary term as a back-end one, are two
   unrelated facts in two checkouts.
2. **The server knows nothing of a repository's knowledge.** The Omni page stores products, their
   repositories (`product_repositories`, `supabase/migrations/20261129090000_product_repositories.sql`)
   and their PRDs. The knowledge map at `/knowledge` (PRD 149, `apps/galaxy/app/knowledge/page.tsx`)
   reads one repository at a time from GitHub, as the App, and knows no product.
3. **A person without a checkout sees nothing.** A PM or a lawyer reading a Legal entry cannot ask
   which rules, in which repositories, serve it.
4. **An agent in one repository cannot ask about the others.** `omni kb graph` answers for the
   checkout it runs in, and the agent has no clone of the other repositories. An agent in an editor,
   connected through the read-only MCP link (PRD 855, `apps/galaxy/src/agent-connect/mcp/server.ts`),
   reads the business, its claims and personas, and nothing of the knowledge.

## Solution

Each repository pushes its graph, in P5's node and edge types, to the Omni page. The server stores it
per repository and commit, joins every repository of a product with that product's Legal and
Glossary and Never lines, and serves the joined graph as P5's neighbourhood JSON, through one
authenticated API, one tool of the MCP link and one read-only page.

### The push: `omni kb graph push`

```
$ omni kb graph push
pushed vertuoza/vertuo-omni-loop@9086e70 · 412 nodes, 980 edges
in products: omni-loop · see https://www.omni-loop.xyz/app/products/<id>/knowledge
```

- It first refreshes the product knowledge cache P3 writes (its Legal and Glossary), then builds the
  whole repository's graph with P5's code: every node and edge P5 knows (`kit/lib/knowledge/
  neighbourhood.ts`), not one neighbourhood. It sends one object, P5's `version: 1` types with
  `shape: "repository"` and no `start`, `depth` or `hop`, with the repository's slug and its `HEAD`
  commit, to `POST /api/knowledge/graphs`. Product nodes (`origin: "product"`) are left out: the
  server holds the product's own.
- It signs in the way every other `omni … push` does: the computer's `omni signin`, or `OMNI_TOKEN`
  (PRD 1628), through the client in `kit/lib/ask/client.ts`, which gains one call,
  `pushKnowledgeGraph`. The pushes it follows are `omni dossier push`, `omni roadmap push`
  (`kit/lib/roadmap/push.ts`) and `omni proof push` (`kit/lib/proof/push.ts`).
- It refuses, with one line and exit 1, when the knowledge folder (`paths.knowledge`) has uncommitted
  changes: the commit it names must be the commit the graph was built from.
- No `ask.url`, no sign-in, the server unreachable or its refusal: one line naming why, exit 1, as
  `omni product which` does (`kit/bin/commands/product.ts`).
- The same commit pushed twice replaces the stored graph of that commit and adds nothing.

### The store

A new migration, dated after the newest on `main`, adds `public.knowledge_graphs`: one row per
repository and commit, with the graph as `jsonb`, `pushed_at` and `pushed_by`.

- Writes go only through a `security definer` function, `knowledge_graph_push(repo, commit, graph)`,
  which the route calls as the caller. It refuses (42501) a caller who is not a member of a workspace
  that tracks the repository, as `roadmap_push()` does
  (`supabase/migrations/20261110090000_roadmaps.sql`). Nobody writes the table directly.
- Row-level security: a member of a workspace that tracks the repository reads its rows; a stranger
  reads none; signed out reads none.
- It keeps the last 20 commits per repository and deletes older rows on each push. The served graph
  is always the latest pushed commit.
- The graph is stored per repository, never per product: a repository in two products is pushed
  once and served in both.
- A check, `supabase/checks/knowledge_graphs.sql`, proves each of these, run by the `supabase`
  workflow like the other checks.

### The join

A pure function, `joinProductGraph`, in `apps/galaxy/src/knowledge-graph/join.ts`, takes the latest
graph of each repository of the product (its `product_repositories` links with `knowledge = 'own'`),
the product's active Legal entries and its Glossary terms (P3's tables), its live Never lines (PRD
871's `constituents`), and returns one graph:

- **Repository nodes get their repository.** Each repository node's id is prefixed with the
  repository's short name and a slash, `vertuo-omni-loop/BR-PRODUCT-3`,
  `vertuo-omni-loop/test:kit/test/plugin.test.ts`, and carries `repo`. Two repositories that both
  hold a `BR-PRODUCT-3` never collide.
- **Product nodes are the product's own.** A Legal entry is a `legal` node with its id
  (`L-INVOICING-1`, as P3 names it), a Glossary term a `term` node `term:<word>`, as P5 names them,
  both with `origin: "product"` and `repo: null`, read from P3's tables at request time. A live Never
  line is a `never` node with its id (`never#3`), read from `constituents` the same way. No edge
  reaches a Never line yet, since no register line names one: it is found by search and shown beside
  Legal, so the page holds the product's whole law.
- **A rule in one repository serving a Legal entry of the product.** A `serves` edge whose target is
  an `L-…` id becomes an edge to the product's Legal node. An `L-…` id the product does not hold, or
  has retired, is listed under `unresolved`, with the repository, the node and the id, never dropped.
- **Two repositories governing the same term.** A `uses-term` edge points at `term:<word>`. Two
  repositories whose edges name the same term meet on the product's one `term:<word>` node, found by
  P3's rule (compared without case). A term the Glossary no longer holds is listed under
  `unresolved`, as a Legal id is.
- **What each repository's data is.** The result carries `repositories`: for each linked repository
  its short name, its `commit`, its `pushedAt` and its `pushedBy`, all `null` when it never pushed,
  and `graph`: `own`, or `none` for a link whose knowledge is `imported` or `none`, whose graph is not
  served.

### The API: `GET /api/products/<key>/knowledge/graph?id=…&depth=…`

```
GET /api/products/omni-loop/knowledge/graph?id=L-INVOICING-1&depth=2
Authorization: Bearer <access token>
→ 200 {version: 2, shape: "neighbourhood", repo: null, start: ["L-INVOICING-1"], depth: 2,
       product: {state: "server", key: "omni-loop", cachedOn: null},
       nodes: [{id, kind, label, status, file, origin, hop, repo}], edges: [{from, to, kind}],
       unresolved: [{repo, node, id}],
       repositories: [{repo, commit, pushedAt, pushedBy, graph}]}
```

- `<key>` is the product key (`supabase/migrations/20261203100000_product_prd_ids.sql`).
- `id` is required: a repository node's prefixed id, an `L-…` id or a `term:<word>`. The answer is
  its neighbourhood, walked as P5 walks one (entry nodes walked further, the others leaves), across
  every repository of the product. `depth` defaults to 1 and takes 1 to 3.
- **The shape is P5's neighbourhood JSON, at `version: 2`.** P5 adds a field only with a new
  version, so the server's answer is version 2: version 1's fields, plus `repo` on each node,
  `unresolved` and `repositories`, the node kind `never`, and the product state `server`. P5's CLI
  reads both versions.
- Refusals follow ADR-0029, each `{error}` in plain words: 400 no `id`, or a `depth` outside 1 to 3;
  401 no valid bearer token; 404 a product key the caller cannot read (the same answer for one that
  does not exist); 404 an `id` absent from the joined graph; 503 no database here.
- The push route, `POST /api/knowledge/graphs {repo, commit, graph}`, receives through
  `receivePush` (`apps/galaxy/src/data/kit-push.ts`) with a 2 MiB cap (413 above it). It validates
  `graph` with the schema the kit exports beside P5's types (imported from
  `omni-loop/kit/lib/knowledge/neighbourhood.ts`, as `src/roadmap/api.ts` imports the kit's
  ids), and refuses an unknown field. It refuses with 403 a repository no workspace of the caller
  tracks, as `src/roadmap/api.ts` does. It answers `{repo, commit, nodes, edges, products: [{key,
  href}]}`; a repository in no product is stored, and `products` is empty.

### Any agent reads it: the MCP link's `get_knowledge_graph`

The MCP link gains a fourth tool, `get_knowledge_graph {id, depth?, repo?}`, beside `get_business`,
`get_claims` and `report_unknown`. It answers exactly the body the read route answers for the
product the link's business resolves for `repo` (as `get_business` resolves it), through the same
reader, so the two cannot differ. The link's read-only token is checked by the database as it is for
`get_business` (ADR-0051); a refused token, an unknown `id` or a `depth` outside 1 to 3 answer one
line as a tool error, as `LINK_REFUSED` does today. Its description tells the agent to cite the ids
it relies on, `L-INVOICING-1` or `vertuo-omni-loop/BR-PRODUCT-3`.

### The CLI reads it: `omni kb graph --product <key> <id>`

`omni kb graph --product <key> <id> [--depth <n>] [--json]` asks the API instead of reading the
checkout. It prints the neighbourhood the way P5 prints one, each repository node with its
repository's short name before its id, under one header line per repository:
`vertuo-omni-loop @9086e70 · pushed 2026-10-13 14:02 by @pierrederval`, or `back-end · never pushed`.
Its last line is `product knowledge: server (<key>).` With `--json` it prints the API's answer as is.
It works from any checkout signed in to the Omni page, a plan repository included.

### The page: the product's Knowledge tab

`/app/products/<id>/knowledge`, a new tab of the product home (`apps/galaxy/src/product-home/tabs.ts`,
after Questions), rendered per request as the signed-in member so row-level security decides what it
reads:

- A strip of the product's repositories, each with its commit, when and by whom it was pushed, or
  "never pushed" and the command that pushes it.
- A search box and a list of nodes; picking one shows its neighbourhood (depth 1, up to 3) and the
  node's own text, with each node labelled by its repository, `Legal` or `Glossary`.
- The `unresolved` list, under its own heading, when it is not empty.
- Read-only: no control edits a node, a Legal entry or a Glossary term. Legal and Glossary link to
  their own pages (P3).

The existing `/knowledge` map (PRD 149) stays as it is.

### When a graph is pushed

- **On demand**, by `omni kb graph push`, from any checkout.
- **After each merge in this repository**, by a new workflow, `.github/workflows/knowledge-graph.yml`,
  on push to `main`, with `contents: read` only. It runs `node kit/dist/omni.mjs kb graph push` with a
  kit token in the `OMNI_TOKEN` secret, and does nothing when the secret is not set. A failed push
  fails that workflow only, never the release. It skips a push whose head is a
  `chore(release): ` commit, as `release.yml` does.
- **Other repositories** add the same workflow from the guide (`docs/guide/products.md` gains a
  "Knowledge graph" section with it). The kit installs no workflow in a repository today, and this PRD
  does not start doing so.

## Decisions

- **The project ships both a CLI graph (P5) and a server API, in this roadmap** (the person).
- **The server reuses the CLI's JSON shape as its contract** (the person). The push and the API both
  carry P5's node and edge types. The API answers P5's neighbourhood JSON at `version: 2`, version
  1 plus `repo` on each node, `unresolved`, `repositories` and the product state `server`, because P5
  adds a field only with a new version (decided here).
- **Legal and Glossary are per product, on the Omni page** (the person, P3).
- **This PRD adds a page:** the product's Knowledge tab, drawn when the PRD is planned (the person).
- **When the push happens:** on demand, plus after merge through a separate workflow that runs only
  when `OMNI_TOKEN` is set (decided here: the most reversible, since deleting one workflow file
  undoes it). It is not added to `release.yml`, which holds the deploy key that writes to `main`.
- **How stale data is shown:** each repository's commit, `pushedAt` and `pushedBy`, in the API, the
  CLI and the page, and "never pushed" for a repository that has not (decided here). No age makes a
  graph "stale" on its own; a threshold can be added later without changing the stored shape.
- **The graph is stored per repository and joined per product at read time** (decided here), so a
  repository in two products is pushed once and its link changes take effect without a push.
- **Only `own` knowledge is served** (decided here). A link whose knowledge is `imported` or `none`
  is listed with no graph; serving an imported copy is left for later.
- **History kept: the last 20 commits per repository** (decided here, a constant to change).
- **Agents read the graph through the MCP link too, and Never lines are product nodes** (the person,
  reviewing the roadmap against concept #746's areas): the link PRD 855 built is the one read path
  for an editor's agent, so the graph joins it as a tool answering the route's body; and the
  product's Never lines, its law above every priority, sit beside its Legal entries.
- **Personas are not nodes** (decided here): no knowledge entry names one, and `get_business`
  already answers them.

## User stories

1. As a **PM**, I open the product's Knowledge tab, pick a Legal entry, and see which rules, in which
   repositories, serve it.
2. As a **developer**, I see that the front-end and the back-end both use the term "credit note", and
   find the two rules.
3. As an **agent** in the front-end, I run `omni kb graph --product <key> L-INVOICING-1` and get the
   back-end's rules that serve it, without a clone; an agent in an editor gets the same through the
   MCP link's `get_knowledge_graph`.
4. As a **maintainer**, I read each repository's commit and push time, so I know how old the graph I
   read is.
5. As a **member of another workspace**, I can read nothing of a product that is not mine.

## Scope

**In:** `omni kb graph push`; `omni kb graph --product <key>`; the client call; the push route and
the read route; the MCP tool `get_knowledge_graph`; Never lines as product nodes; the migration, its row-level security and its check; the join; the product's
Knowledge tab; the `knowledge-graph.yml` workflow of this repository; the guide section.

**Out:** the graph itself, its JSON shape and `omni kb graph` on a checkout (P5, #1797); writing or
editing Legal and Glossary (P3, #1795); serving an imported knowledge base's graph; installing a
workflow in other repositories; any edit of knowledge from the page.

## Test seams

- **The CLI**, through `main()` on a fixture repository (`makeRepo()`, `kit/test/fixture.ts`), with a
  stubbed `fetch` as `kit/bin/commands/product.test.ts` does: the push body, the dirty-folder refusal, each
  one-line failure, and `--product` printing the repository header lines.
- **The routes**, as plain functions of a `Request` with a stubbed Supabase client, as
  `apps/galaxy/src/roadmap/api.test.ts` does: each refusal and its status, the 2 MiB cap, an unknown
  field, the `id` and `depth` rules.
- **The MCP tool**, in `apps/galaxy/src/agent-connect/mcp/server.test.ts`: `get_knowledge_graph`
  answers the read route's body for the same product, `id` and `depth`; a revoked token, an unknown
  `id` and `depth: 4` each answer one line as a tool error.
- **The join**, `joinProductGraph`, a pure unit test on small graphs: prefixed ids, a Legal edge
  resolved and one unresolved, a term shared by two repositories and one the Glossary no longer holds, an
  imported link listed with no graph, a live Never line as a `never` node and a removed one absent.
- **The database**, `supabase/checks/knowledge_graphs.sql`, with realistic rows: a member pushes and
  reads, a stranger and a signed-out caller read nothing and cannot push, the 21st commit removes the
  oldest, a repeat of one commit replaces it.
- **The page**, a render test of its states: no repository pushed, one pushed and one never pushed,
  a node's neighbourhood, the unresolved list.
- No test calls GitHub, Supabase or the network.

## Risks

- **What merging publishes:** a migration applied to production by the `supabase` workflow; two new
  routes, a new tool on every agent link and a tab on the arcade's next deploy; a new `omni` subcommand in `kit/dist/omni.mjs`; a
  workflow that pushes this repository's graph after each merge once `OMNI_TOKEN` is set.
- **Rollback:** revert the pull request. The table is new and nothing else reads it; a follow-up
  migration drops it. Deleting `knowledge-graph.yml` stops the pushes.
- **Exposure:** a graph holds the text of a repository's knowledge entries. Only members of a
  workspace that tracks the repository read it; the check proves a stranger reads nothing.
- **Size:** a large knowledge base could pass 2 MiB. The push names the cap in its refusal; the cap
  is one constant.
- **Routing:** `/api/products/<key>/…` sits beside the fixed segments `which`, `targets` and
  `import`. A route test proves a product keyed `which` still reaches its graph.
- **Blocked by P5:** the push, the route's schema and the CLI reuse P5's types in
  `kit/lib/knowledge/neighbourhood.ts`, so the server changes when they change, never the reverse.
  The join reads P3's Legal and Glossary tables; P5 is itself blocked by P3 (#1795), so they exist
  before this PRD starts.
- **The locked laws.** `omni kb laws --paths` on the files this design adds or changes prints all 17
  locked laws, since none carries a `Governs:` line yet. Two bear on this design:
  - BR-PRODUCT-63: an agent link reading another workspace's repositories would let an agent read
    another team's private work; the read route, the MCP tool (whose token reads only its own
    business's product) and the row-level security must hold it. Changing it
    needs @pierrederval to approve the pull request on GitHub.
  - BR-PRODUCT-94: the push and read routes write no answer and change no answer's state, so a
    terminal token still cannot mark an answer given. Changing it needs @pierrederval to approve the
    pull request on GitHub.
  - The other 15 (BR-PRODUCT-3, -5, -6, -12, -28, -29, -39, -59, -64, N-PRODUCT-3, -4, -7, -8, -13,
    -14) are not changed by this design. Changing any of them needs @pierrederval to approve the pull
    request on GitHub.

## Acceptance criteria

1. In a signed-in checkout with a clean knowledge folder, `omni kb graph push` prints the repository,
   the short commit, the node and edge counts and the product links, and exits 0.
2. With uncommitted changes under `paths.knowledge`, `omni kb graph push` prints one line naming them
   and exits 1, and nothing is sent.
3. Pushing the same commit twice leaves one stored row for that commit, holding the second graph.
4. After a 21st commit is pushed for one repository, its oldest stored commit is gone.
5. A caller who is not a member of a workspace tracking the repository is refused with 403 and
   nothing is stored.
6. `GET /api/products/<key>/knowledge/graph?id=<id>` returns P5's neighbourhood JSON at
   `version: 2`, with `unresolved` and `repositories`, every repository node id prefixed by its
   repository's short name and a slash.
7. A rule whose `Serves:` names a Legal id the product holds has a `serves` edge to that `legal`
   node; a Legal id the product lacks or retired appears under `unresolved` with its repository, node
   and id.
8. Two repositories whose rules use the same Glossary term of the product share one `term:<word>`
   node, with a `uses-term` edge from each.
9. With `depth=2`, the API returns only the nodes within two edges of `id`; no `id`, or `depth=4`,
   is refused with 400; an `id` absent from the graph with 404.
10. A caller who cannot read the product gets 404, the same answer as for a key that does not exist.
11. Each entry of `repositories` carries its commit, `pushedAt` and `pushedBy`; a linked repository
    that never pushed has `commit`, `pushedAt` and `pushedBy` null; an `imported` or `none` link has
    `graph: "none"`.
12. `omni kb graph --product <key> <id>` prints the same nodes the API returns, under one header
    line per repository with its commit and push time, or "never pushed".
13. The product home shows a Knowledge tab whose page lists each repository's commit and push time,
    lets a person pick a node and see its neighbours, and offers no control that edits anything.
14. In this repository, a merge to `main` with `OMNI_TOKEN` set pushes the graph of the merged
    commit; without the secret, the workflow does nothing and passes.
15. Through the MCP link, `get_knowledge_graph {id: "L-INVOICING-1", depth: 2}` answers the same body
    as `GET /api/products/<key>/knowledge/graph?id=L-INVOICING-1&depth=2` for the link's product; a
    revoked link answers one line as a tool error.
16. Each live Never line of the product is a `never` node (`never#<n>`, `origin: "product"`), found
    by id; a removed one is not in the graph.
