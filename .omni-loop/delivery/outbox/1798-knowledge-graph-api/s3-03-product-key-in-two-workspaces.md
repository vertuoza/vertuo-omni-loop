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
