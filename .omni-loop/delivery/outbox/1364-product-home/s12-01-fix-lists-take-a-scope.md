---
id: s12-01-fix-lists-take-a-scope
prd: 1364
slice: s12
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

The bug fix and visual fix lists read their own fixes, outside the files this slice may change. How do they get a product filter?

## The decision, in plain words

The shared code behind both lists now accepts an optional narrowing step from the page; the two pages hand it the product filter. Nothing else about those lists changes.

## The intro, for fun

Two lists shared one kitchen, and the new recipe needed one extra door into it.

## The punchline, for fun

So the door was added, small and optional, and only the product filter walks through it.

## The options, in plain words

A. A. An optional narrowing step in the shared list code, handed by each page (built).
B. B. Copy the list's reads into each page so the change stays inside the pages.
C. C. Move the product filter into the fixes module itself, owned by a later slice.

## What I had to decide

Whether the bug fix and visual fix lists may be narrowed through a small optional step added to their shared list code, outside this slice's territory.

## What I did meanwhile

Added an optional third parameter, a FixListScope, to fixListRoute in apps/galaxy/src/fixes/FixListRoute.tsx: it narrows the fixes read and draws what it returns above the list. /bugs and /visual pass productListScope; with no scope the lists behave exactly as before.

## What it costs to change later

A few lines: drop the parameter and the two pages' third argument, or move the filter into the fixes module itself.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names only the two page files, which only delegate to the shared list code; it does not say whether that code may change.
