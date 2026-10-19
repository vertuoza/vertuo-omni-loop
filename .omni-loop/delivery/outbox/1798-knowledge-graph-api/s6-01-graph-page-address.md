---
id: s6-01-graph-page-address
prd: 1798
slice: s6
rank: medium
bears-on: none
raised: 2026-10-19
wave: 3
---

## The question, in plain words

Where does the product's knowledge graph page live, and how does a person reach it from the Knowledge tab?

## The decision, in plain words

The graph has its own page under the product's Knowledge tab, linked from that tab's heading with the words Explore the knowledge graph. The tab itself stays as it is and stays the marked one, and what is searched or picked is kept in the page address.

## The intro, for fun

The graph gets a door of its own, right next to the Knowledge tab.

## The punchline, for fun

The tab keeps its place in the row, and the address remembers where you were.

## The options, in plain words

A. A. A page of its own under the Knowledge tab, linked from the tab's heading (built).
B. B. The graph inside the Knowledge tab itself, below Legal and Glossary.
C. C. A tab of its own in the product home's row, after Knowledge.

## What I had to decide

The address is /app/products/<id>/knowledge/graph, with q for the search, node for the picked node and depth for 1 to 3. The Knowledge tab's heading carries the link. A Never line is labelled Never beside Legal and Glossary.

## What I did meanwhile

Built the page as a server-rendered, read-only screen with a plain GET search form, so it needs no script and no new tab in the product home's row.

## What it costs to change later

Moving the page to another address is a change to one route folder and one link; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for the page to be reached from the Knowledge tab but names no address; the plan names this one.
