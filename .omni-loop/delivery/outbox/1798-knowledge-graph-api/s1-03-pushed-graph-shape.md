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
