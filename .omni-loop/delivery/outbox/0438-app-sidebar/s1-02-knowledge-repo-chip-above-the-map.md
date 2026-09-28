---
id: s1-02-knowledge-repo-chip-above-the-map
prd: 438
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The knowledge page names the repository it reads. Where exactly should that name sit now that the page has no bar of its own?

## The decision, in plain words

The repository name sits as a small chip on its own line at the top of the page, beside the star chart link, above the map and its title.

## The intro, for fun

The repository's name lost its seat on the bus and had to find a spot on the page.

## The punchline, for fun

It picked the front row, next to the star chart.

## The options, in plain words

A. A heading row above the map, holding the chip and the star chart link, the option built.
B. Inside the map's own title, beside the domain's name.
C. In the top bar, after the page's title.

## What I had to decide

Whether the repository chip on /knowledge goes in a heading row above the map (built) or inside the map's own title.

## What I did meanwhile

KnowledgeScreen renders a km-page-head row (repository chip, then Open the star chart) in every state, above the map; the map's own h1 is unchanged.

## What it costs to change later

A few lines of markup and CSS; moving it into the map's title means editing KnowledgeMap.tsx, outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's words, in its heading, meant the map's own title (author)
