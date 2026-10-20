---
id: s1-04-archived-read-answers
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a repository's only product is archived, what should the readers that agents use answer?

## The decision, in plain words

The business read answers that the product is archived, with its name and nothing of it, and the knowledge graph read refuses with the archived sentence. A PRD whose own product is archived reads the same, rather than falling back to another product of its repository.

## The intro, for fun

An agent asks for the rules of a product that went into storage.

## The punchline, for fun

It is told the product is in storage, not that the rulebook is blank.

## The options, in plain words

A. A. The database says the product is archived, with its name, and the graph refuses with the archived sentence (built).
B. B. The database answers as if the repository had no product, and s3 asks the products table whether one was archived.

## What I had to decide

The shape the database gives the readers that s3 turns into words, since every SQL change lands in this slice. The spec names `{state: archived, product: {name}}` for the business read, and the archived sentence for the graph.

## What I did meanwhile

Built A: business_for_repo() and business_for_token() answer `{state: 'archived', business, product: {name}}` with empty lists when the lookup finds no live product and the repository (or the PRD named) points at exactly one archived one; without a repository, a link whose business sells only archived products reads one of them as archived. knowledge_graph_for_token() refuses those cases with P0002 and the archived message. A repository linked to an archived and a live product reads the live one.

## What it costs to change later

A follow-up migration and s3's readers change together; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A repository whose several products are all archived reads as in no product, not as archived.
