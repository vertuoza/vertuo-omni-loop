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
