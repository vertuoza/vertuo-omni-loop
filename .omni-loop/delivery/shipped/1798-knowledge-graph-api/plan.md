# Plan: The knowledge graph API on the server

PRD #1798, the spec beside this plan (`spec.md`). The feature branch `feat/knowledge-graph-api` goes
into `main` with `Closes #1798`; each slice is a sub-PR from `feat/knowledge-graph-api--<slice>` into
the feature branch with `Part of #1798`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | the store and the push route: the `knowledge_graphs` migration (dated after `main`'s newest) with `knowledge_graph_push(repo, commit, graph)` as `security definer`, row-level security for members of a workspace tracking the repository, the last 20 commits kept and a repeat commit replaced, its check run by the `supabase` workflow; the kit's schema of P5's `version: 1` graph with `shape: "repository"`; and `POST /api/knowledge/graphs {repo, commit, graph}` through `receivePush` with the 2 MiB cap (413), the schema refusing an unknown field, 403 a repository no workspace of the caller tracks, answering `{repo, commit, nodes, edges, products}` | `supabase/migrations/` `supabase/checks/knowledge_graphs.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` `kit/lib/knowledge/graph-schema` `apps/galaxy/app/api/knowledge/graphs/` `apps/galaxy/src/knowledge-graph/push` | — | 1 | deep |
| s2 | `omni kb graph push`: builds the whole repository's graph with P5's code (every node and edge, product nodes left out, `shape: "repository"`, no `start`, `depth` or `hop`), refreshes the product knowledge cache first, sends it with the repository's slug and `HEAD` through the client's new `pushKnowledgeGraph`, prints the pushed line and the product links, and refuses in one line (exit 1) a dirty knowledge folder, no `ask.url`, no sign-in, an unreachable server or a refusal | `kit/lib/knowledge/neighbourhood` `kit/lib/knowledge/graph-push` `kit/lib/ask/client` `kit/bin/commands/kb.ts` `kit/bin/kb-graph-push.test.ts` `kit/lib/help/entries.ts` `kit/README.md` | s1 | 2 | build |
| s3 | the join and the read route: `joinProductGraph` (repository ids prefixed by the short name with `repo`, Legal, Glossary and live Never lines as product nodes, `serves` to Legal and `uses-term` to the shared term, `unresolved`, `repositories` with commit, push time and pusher or nulls, `graph` `own` or `none`), the reader of the latest graph per `own` link as the caller, the walk at depth 1 to 3, the `version: 2` types in the kit, and `GET /api/products/<key>/knowledge/graph?id=…&depth=…` with its 400, 401, 404 and 503 | `kit/lib/knowledge/product-graph` `apps/galaxy/src/knowledge-graph/` `apps/galaxy/app/api/products/[key]/` | s1 | 2 | deep |
| s4 | the MCP link's fourth tool, `get_knowledge_graph {id, depth?, repo?}`, answering the read route's body for the link's product through the same reader, its token checked by the database, a refused token, an unknown `id` or a `depth` outside 1 to 3 one line as a tool error, its description asking the agent to cite the ids | `apps/galaxy/src/agent-connect/mcp/` `apps/galaxy/src/knowledge-graph/link` `supabase/migrations/` `supabase/checks/knowledge_graphs_link.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` | s3 | 3 | deep |
| s5 | `omni kb graph --product <key> <id> [--depth <n>] [--json]`: asks the read route, prints the neighbourhood as P5 prints one with each repository node's short name before its id, under one header line per repository (`<repo> @<commit> · pushed <time> by @<login>` or `<repo> · never pushed`), last line `product knowledge: server (<key>).`, `--json` the API's answer as is; P5's reader takes version 1 and 2 | `kit/lib/knowledge/neighbourhood` `kit/lib/knowledge/product-graph` `kit/lib/ask/client` `kit/bin/commands/kb.ts` `kit/bin/kb-graph-product.test.ts` `kit/lib/help/entries.ts` `kit/README.md` | s2, s3 | 3 | build |
| s6 | the page: the product's knowledge graph, rendered per request as the member, with the repositories strip (commit, push time and pusher, or "never pushed" and the push command), the search box and node list, a picked node's neighbourhood at depth 1 to 3 with each node labelled by its repository, `Legal` or `Glossary`, the `unresolved` list, read-only, reached from the product's Knowledge tab | `apps/galaxy/app/app/products/[id]/knowledge/graph/` `apps/galaxy/src/knowledge-graph/tab/` `apps/galaxy/src/product-knowledge/KnowledgeTab` `apps/galaxy/src/product-knowledge/product-knowledge.render.test.ts` `.omni-loop/knowledge/design/screens/product-knowledge-graph` | s3 | 3 | build |
| s7 | the push after each merge: `.github/workflows/knowledge-graph.yml` on push to `main`, `contents: read` only, `node kit/dist/omni.mjs kb graph push` with `OMNI_TOKEN`, doing nothing without the secret, skipping a `chore(release): ` head, its guard test; and the guide's "Knowledge graph" section in `docs/guide/products.md` with the workflow | `.github/workflows/knowledge-graph.yml` `scripts/knowledge-graph-workflow.test.ts` `docs/guide/products.md` | s2 | 3 | light |

**Shared ground.** `kit/lib/knowledge/neighbourhood`, `kit/lib/ask/client`, `kit/bin/commands/kb.ts`,
`kit/lib/help/entries.ts` and `kit/README.md` are declared by s2 (wave 2) and s5 (wave 3);
`kit/lib/knowledge/product-graph` by s3 (wave 2) and s5 (wave 3); `apps/galaxy/src/knowledge-graph/`
by s1 (its `push` files, wave 1), s3 (wave 2) and s6 (its `tab/` folder, wave 3). Each pair sits in
different waves, so the later slice builds on the merged one. `supabase/migrations/`, `supabase/database.types.ts` and `.github/workflows/supabase.yml` are
declared by s1 (wave 1) and s4 (wave 3). Wave 3's four slices share no prefix:
s4 stays in the MCP folder, its `knowledge-graph/link` files and its database read, and s6 in the graph's `tab/` folder and the Knowledge tab, both only
importing s3's reader; s5 stays in the kit, s7 in the workflow and the guide. `kit/dist/` and
`apps/omni-app/api/` are generated: each slice rebuilds them to test and commits none; the wave
rebuilds them once after merging.

**The Knowledge tab already exists.** P3 (#1795) shipped `/app/products/<id>/knowledge` as the
product's Knowledge tab, holding its Legal and Glossary. The spec's page is therefore drawn as the
graph of that tab, at `/app/products/<id>/knowledge/graph`, linked from the tab's heading with the
tab still marked current, and P3's page is left as it is apart from that link: the most reversible
reading, recorded by s6 as an outbox item.

## Per slice: done when

### s1 (deep: a migration, a security-definer function and row-level security under BR-PRODUCT-63)

- `node scripts/migration-order.ts` passes: the new migration is dated after the newest on `main`.
- `supabase/checks/knowledge_graphs.sql`, with realistic rows and run by `.github/workflows/supabase.yml`:
  a member of a workspace tracking the repository pushes and reads; a stranger and a signed-out
  caller read nothing and cannot push (42501); the 21st commit of one repository removes its oldest;
  a repeat of one commit leaves one row holding the second graph; nobody writes the table directly.
- `kit/lib/knowledge/graph-schema.ts` exports the zod schema of a pushed graph, P5's `version: 1`
  node and edge types with `shape: "repository"`, strict (an unknown field refused), tested beside it.
- The push route, tested as a plain function of a `Request` with a stubbed Supabase client: 401
  without a token, 413 above 2 MiB naming the cap, 400 on an unknown field or a bad shape, 403 a
  repository no workspace of the caller tracks (nothing stored), 200 with `{repo, commit, nodes,
  edges, products: [{key, href}]}` and `products: []` for a repository in no product.
- `supabase/database.types.ts` regenerated (`node scripts/supabase-types.ts`) when the types check
  needs it.

### s2

- `kit/bin/kb-graph-push.test.ts`, through `main()` on a fixture repository with a stubbed `fetch`:
  the body sent (slug, `HEAD`, `shape: "repository"`, every repository node and edge, no product
  node, no `start`, `depth` or `hop`) and the body passes s1's schema; the printed lines
  (`pushed <slug>@<short> · <n> nodes, <m> edges`, `in products: <key> · see <href>`); a dirty
  knowledge folder refused in one line, exit 1, nothing sent; no `ask.url`, no sign-in, unreachable
  and a refusal each one line and exit 1.
- The whole-repository builder in `kit/lib/knowledge/neighbourhood.ts` is tested beside it.
- `omni help kb` and `kit/README.md` name `kb graph push`.

### s3 (deep: the join across repositories, the walk and the read path under BR-PRODUCT-63)

- `apps/galaxy/src/knowledge-graph/join.test.ts`, a pure unit test on small graphs: prefixed ids
  with `repo`; a Legal edge resolved and one unresolved (absent and retired); a term shared by two
  repositories meeting on one `term:<word>` (compared without case) and one the Glossary no longer
  holds unresolved; an `imported` link listed with `graph: "none"`; a never-pushed link with nulls; a
  live Never line as a `never` node with `origin: "product"` and a removed one absent.
- The walk returns only the nodes within `depth` edges of `id`, entry nodes walked further and the
  others leaves, as P5 walks.
- The read route, tested as a plain function with a stubbed Supabase client: 400 no `id` and
  `depth=4`, 401 no token, 404 a key the caller cannot read and one that does not exist (the same
  body), 404 an absent `id`, 503 no database, 200 at `version: 2` with `unresolved` and
  `repositories`; a product keyed `which` still reaches its graph.
- The reader exposes both the neighbourhood and the whole joined graph's nodes, which the page
  searches.
- `kit/lib/knowledge/product-graph.ts` holds the `version: 2` types (version 1 plus `repo`,
  `unresolved`, `repositories`, the kind `never` and the state `server`), imported by the route.

### s4 (deep: a token-checked database read under BR-PRODUCT-63)

The link's read-only token is no Supabase session, so it cannot read `knowledge_graphs` or P3's
tables through s3's reader, which reads as the caller (s3's report). The territory was widened after
wave 2 to hold a token-checked read: a `security definer` function in a new migration (dated after
`main`'s newest), as `business_for_token` reads the business, with its check.

- The function answers only the link's own business's product: a revoked or unknown token reads
  nothing, proved by `supabase/checks/knowledge_graphs_link.sql`, run by the `supabase` workflow.
- `apps/galaxy/src/agent-connect/mcp/server.test.ts`: `get_knowledge_graph` answers the read route's
  body for the same product, `id` and `depth`; a revoked token, an unknown `id` and `depth: 4` each
  answer one line as a tool error; the tool lists beside the other three, its description naming
  `L-INVOICING-1` and `vertuo-omni-loop/BR-PRODUCT-3` as ids to cite.

### s5

- `kit/bin/kb-graph-product.test.ts`, through `main()` with a stubbed `fetch`: the header line per
  repository (`… @<commit> · pushed <YYYY-MM-DD HH:MM> by @<login>` and `… · never pushed`), each
  repository node printed with its short name, the last line `product knowledge: server (<key>).`,
  `--json` printing the answer unchanged, the depth rules, and each one-line failure.
- P5's reader parses version 1 and version 2 answers.
- `omni help kb` and `kit/README.md` name `--product`.

### s6 (`ui: yes`)

- A render test of the page's states: no repository pushed, one pushed and one never pushed, a
  node's neighbourhood with labels (repository, `Legal`, `Glossary`), the unresolved list, and no
  control that edits anything.
- The Knowledge tab's heading links the graph; the tab stays the marked one.
- `.omni-loop/knowledge/design/screens/product-knowledge-graph.md` drafts the screen (never locked).
- An outbox item records the graph's address under the existing Knowledge tab.

### s7 (light: a workflow file and a guide section)

- `scripts/knowledge-graph-workflow.test.ts`: on push to `main`, `permissions: contents: read`, the
  step gated on `OMNI_TOKEN` being set, a `chore(release): ` head skipped, the command
  `node kit/dist/omni.mjs kb graph push`.
- `docs/guide/products.md` has a "Knowledge graph" section holding the workflow.
