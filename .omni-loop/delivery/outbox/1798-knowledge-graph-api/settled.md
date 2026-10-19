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
