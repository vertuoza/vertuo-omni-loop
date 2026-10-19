# Settled outbox items — PRD 1798

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-tracks-means-lists -->

## s1-01-tracks-means-lists — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-tracks-means-lists
prd: 1798
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Who counts as a member of a workspace that tracks a repository, when that workspace has switched the repository's tracking off on its Engineering board?

## The decision, in plain words

Any workspace that has the repository among its repositories counts, whether its tracking is on or off. Its members may push the repository's knowledge graph and read it.

## The intro, for fun

Switching tracking off mutes the Engineering board, but does it mute the knowledge too?

## The punchline, for fun

For now the knowledge keeps talking to the team that owns the repository.

## The options, in plain words

A. A. A workspace that lists the repository counts, tracked or not (built).
B. B. Only a workspace that tracks it on the Engineering board counts.

## What I had to decide

Whether the knowledge graph follows the workspace's list of repositories (as built) or only the repositories it tracks on the Engineering board. B changes one condition in knowledge_graph_push() and the read policy of knowledge_graphs, through a follow-up migration.

## What I did meanwhile

knowledge_graph_push() and the row-level security of knowledge_graphs read public.repositories with no condition on `tracked`, as knowledge_pack_for_token() reads a repository its workspace lists (supabase/migrations/20261214090000_knowledge_graphs.sql). The check proves a member of a listing workspace pushes and reads, and a stranger does neither.

## What it costs to change later

Low: one condition in one function and one policy, in a follow-up migration. No stored row changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says tracks without saying whether the Engineering board's tracking switch counts; the repositories table keeps a repository switched off as the workspace's own (author).

```

<!-- /omni-outbox-settled: s1-01-tracks-means-lists -->

<!-- omni-outbox-settled: s1-03-pushed-graph-shape -->

## s1-03-pushed-graph-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-pushed-graph-shape
prd: 1798
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

What exactly does a repository send when it shares its knowledge graph, and which products does the answer name?

## The decision, in plain words

A repository sends its own rules and links only, with nothing about the product: the product's Legal entries and Glossary terms stay on the server. The answer names the products of the sender's own workspaces that show this repository's knowledge.

## The intro, for fun

A repository packs its own suitcase and leaves the product's luggage at home.

## The punchline, for fun

The server already holds the product's Legal and Glossary, so nobody carries them twice.

## The options, in plain words

A. A. The graph holds the repository's own rules and links only; the answer names the sender's products that show them (built).
B. B. The graph also carries the repository's name and the product's state, as the terminal's view does.
C. C. The answer names every product holding the repository in the sender's workspaces, whatever it shows.

## What I had to decide

Whether the pushed graph is version, shape, nodes and edges alone (as built: the repository and commit travel beside it, an edge may end at a Legal id or a term the product holds, any other end must be a node, and a product node is refused), and whether the answer lists only the products whose link serves the repository's own knowledge, in the pusher's workspaces (as built).

## What I did meanwhile

kit/lib/knowledge/graph-schema.ts exports RepositoryGraphSchema, strict at every level, which POST /api/knowledge/graphs reads the graph with; s2's push must pass it. knowledge_graph_push() answers products whose product_repositories link has knowledge own, of the caller's workspaces, each with its key (null when the product has none), and the route adds its Knowledge tab's address.

## What it costs to change later

Low before s2 merges: one schema in the kit. After, a field added to the graph needs a new version on both sides.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says P5's version 1 types with no start, depth or hop, but not whether repo and product stay in the graph; P5's neighbourhood carries both (author).

```

<!-- /omni-outbox-settled: s1-03-pushed-graph-shape -->

<!-- omni-outbox-settled: s3-01-whole-product-standing -->

## s3-01-whole-product-standing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-whole-product-standing
prd: 1798
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

When someone asks about one rule or one legal entry, should the answer list every broken link and every repository of the product, or only those near what they asked about?

## The decision, in plain words

Every answer lists all the product's broken links and all its repositories, whatever was asked, so a reader always sees how complete and how old the whole graph is.

## The intro, for fun

Ask about one rule, and the answer hands you the whole product's report card.

## The punchline, for fun

Nobody can say they were not told the back-end never sent its homework.

## The options, in plain words

A. The whole product's lists in every answer (built).
B. Only the unresolved ids of the walked nodes, and every repository.
C. Only the walked nodes' unresolved ids and repositories.

## What I had to decide

Whether the read route's `unresolved` and `repositories` cover the whole product (as built) or only the neighbourhood walked.

## What I did meanwhile

productNeighbourhood (apps/galaxy/src/knowledge-graph/walk.ts) copies the joined graph's whole `unresolved` and `repositories` into every answer; only `nodes` and `edges` are the walk's. The page (s6) reads the same lists from the whole graph.

## What it costs to change later

Low: trimming `unresolved` to the walked nodes is one filter in walk.ts and its test; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's answer carries `unresolved` and `repositories` beside the walk without saying whether they are trimmed to it.
- A product with many unresolved ids sends them all in every answer; no product is that large yet (author).

```

<!-- /omni-outbox-settled: s3-01-whole-product-standing -->

<!-- omni-outbox-settled: s3-02-twin-repository-names -->

## s3-02-twin-repository-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-twin-repository-names
prd: 1798
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

If a product holds two repositories with the same name from two different owners, how are their rules told apart?

## The decision, in plain words

Each rule is named after its repository's short name, unless another repository of the product has that same short name: then both are named by their owner and name in full.

## The intro, for fun

Two repositories walk into a product, both called web.

## The punchline, for fun

Their surnames come out, so nobody mixes up whose rule is whose.

## The options, in plain words

A. The owner and the name in full for repositories sharing a short name, the short name otherwise (built).
B. Always the owner and the name in full.
C. Always the short name, letting such ids meet.

## What I had to decide

How a repository node's id is prefixed when two linked repositories share a short name: by `owner/name` for both (as built), or always by the short name.

## What I did meanwhile

joinProductGraph (apps/galaxy/src/knowledge-graph/join.ts) prefixes with the short name, and with the whole `owner/name` for every link whose short name another link of the product shares, so `acme/web/BR-1` and `other/web/BR-1` never collide. `repo` on the node and in `repositories` follows the same name.

## What it costs to change later

Low: the naming is one function of the join, read at request time; nothing stored carries the prefix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec prefixes by the short name and says two repositories never collide, without naming the case of two links with one short name.

```

<!-- /omni-outbox-settled: s3-02-twin-repository-names -->

<!-- omni-outbox-settled: s3-03-product-key-in-two-workspaces -->

## s3-03-product-key-in-two-workspaces — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-product-key-in-two-workspaces
prd: 1798
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

A product's short name is unique only inside one team. If someone belongs to two teams that both use the same name, which product do they get?

## The decision, in plain words

They get the product created first, the same way the loop already picks between two teams' products of one name when no repository says which.

## The intro, for fun

Two teams, one product name, one person who belongs to both.

## The punchline, for fun

The older product wins, by the oldest rule there is: it was there first.

## The options, in plain words

A. The oldest product holding the key (built).
B. A 409 naming both workspaces, asking for a repository to choose by.
C. The caller names a repository, and the team that lists it is chosen.

## What I had to decide

Which product `GET /api/products/<key>/knowledge/graph` reads when two of the caller's workspaces hold the key: the oldest (as built), or a refusal asking to name the workspace.

## What I did meanwhile

productGraphRepository.productByKey (apps/galaxy/src/knowledge-graph/product-graph.repository.ts) reads the caller's products with that key, oldest first (created_at, then id), as product_of_key() orders them when no repository is given, and serves the first.

## What it costs to change later

Low: answering 409 for a key two workspaces hold, or taking a `repo` query to choose as product_of_key() does, changes the repository and the controller only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the product by its key alone, and products.key is unique per workspace, not across them.

```

<!-- /omni-outbox-settled: s3-03-product-key-in-two-workspaces -->
