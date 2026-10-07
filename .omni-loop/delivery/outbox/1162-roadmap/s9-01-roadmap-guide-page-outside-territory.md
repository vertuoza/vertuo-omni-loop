---
id: s9-01-roadmap-guide-page-outside-territory
prd: 1162
slice: s9
rank: medium
bears-on: none
raised: 2026-10-07
wave: 6
---

## The question, in plain words

The new guide page on roadmaps had to sit between two existing pages, which meant changing one line of a neighbouring page and the test of the guide's menu, both outside this piece of work.

## The decision, in plain words

The roadmaps page comes right after the page on several repositories and before landings; that page's next link now points to it, and the menu's test lists thirteen pages.

## The intro, for fun

A new page moved into the guide and needed the neighbours to shift over.

## The punchline, for fun

One next link changed hands, and the menu learned to count to thirteen.

## The options, in plain words

A. A. After Several repositories, before Landings, changing that page's Next link (built)
B. B. After Drive the loop, changing that page's Next link instead
C. C. Last in the guide, after When something goes wrong, with no Next link leading to it

## What I had to decide

Whether the roadmaps page sits after the several-repositories page (built), or somewhere that needs no change to another page.

## What I did meanwhile

docs/guide/several-repositories.md now ends with Next → Roadmaps, docs/guide/roadmaps.md ends with Next → Landings, and apps/galaxy/src/docs/docs.test.ts lists the thirteenth page in the sidebar, the served pages and the Next links; neither file is in s9's territory.

## What it costs to change later

Moving the page is one entry in meta.json, two Next links and the matching lines of the two guide tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names meta.json and guide.test.ts but not docs.test.ts, which also lists every page, nor the page whose Next link must lead to the new one.
