---
id: s4-04-guide-tests-outside-territory
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Adding the new help page meant updating the two automatic checks that list every help page, which sit outside this part's agreed area. Is that fine?

## The decision, in plain words

Yes: the new page sits after Roadmaps, and both checks now expect it. Without that, the help page could not be added at all.

## The intro, for fun

A new book on the shelf means a new line in the catalogue.

## The punchline, for fun

The librarian's list was in another room.

## The options, in plain words

A. Keep the page after Roadmaps, the two tests updated here, as built.
B. Also point Roadmaps' Next link at the ideas page, so a reader reaches it in order.
C. Move the page elsewhere in the guide's order.

## What I had to decide

Whether to change apps/galaxy/src/docs/guide.test.ts and docs.test.ts, outside the slice's territory, so that docs/guide/ideas.md and its meta.json entry pass the docs guard.

## What I did meanwhile

Both tests list Ideas board after Roadmaps, with its Next link to Landings; no other guide page changed, so no page links to it as its Next.

## What it costs to change later

A few lines in each of the two test files, and the page's place in docs/guide/meta.json.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice docs/guide/ideas.md and meta.json but not the tests that pin the guide's page list.
