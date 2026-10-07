---
id: s6-01-drive-guide-page-place
prd: 1139
slice: s6
rank: medium
bears-on: none
raised: 2026-10-07
wave: 4
---

## The question, in plain words

Where does the new guide page on driving the loop sit among the guide's pages, and should the page before it point to it?

## The decision, in plain words

It sits right after Your first PRD in the sidebar, and Your first PRD still sends readers on to Several repositories, so the new page is reached from the sidebar only.

## The intro, for fun

A new page walked into the guide and had to pick a seat.

## The punchline, for fun

It sat next to its closest friend, who has not noticed it yet.

## The options, in plain words

A. After Your first PRD, reached from the sidebar; Your first PRD's Next link unchanged (built).
B. After Your first PRD, and Your first PRD's Next link points to it.
C. At the end of the guide, after When something goes wrong.

## What I had to decide

Keep the page after Your first PRD with no link into it, or link Your first PRD's Next to it.

## What I did meanwhile

The page shows in the sidebar after Your first PRD; its own Next link goes to Several repositories.

## What it costs to change later

One line in one guide page and two lines of the docs tests to change either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory left out the sidebar test (apps/galaxy/src/docs/docs.test.ts), which lists every guide page; this slice changed it to add the page, outside its territory. (author)
- The plan's territory left out docs/guide/first-prd.md, so its Next link was not moved to the new page. (author)
