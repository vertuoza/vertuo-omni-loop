---
id: s4-02-no-single-product-one-line
prd: 1798
slice: s4
rank: medium
bears-on: none
raised: 2026-10-19
wave: 3
---

## The question, in plain words

What does an agent get when it asks for the product's knowledge graph but its link cannot tell which one product it means?

## The decision, in plain words

It gets one line saying why and what to name: the repository is in no product or in several, or the business sells several products (naming the repositories to choose from), or none yet. It never gets an empty graph that looks like a product with no knowledge.

## The intro, for fun

An agent asked for the map, but the shop sells three towns.

## The punchline, for fun

So it hears which town to name, not a blank sheet of paper.

## The options, in plain words

A. Answer one line naming why, as the database words it (what was built)
B. Answer an empty graph, as the business read answers no product

## What I had to decide

What get_knowledge_graph answers when the product the link resolves for `repo` (as get_business resolves it) is none: the spec names the refusals (a refused token, an unknown id, a depth outside 1 to 3) and no answer for no product, where get_business answers state none.

## What I did meanwhile

knowledge_graph_for_token() refuses with 22023 and a plain line: a repository in no product or several (`Repository: <repo> is not in exactly one product of this workspace, …`), several products and no repository (naming the tracked repositories, as business_for_token() once did), and no product yet. The tool answers that line as a tool error, as it answers another workspace's repository (42501).

## What it costs to change later

A constant: answering an empty version 2 body instead is a change to the function's last branch and the tool's mapping, with no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a link with no single product should read as an error or as an empty graph; get_business answers state none there.
