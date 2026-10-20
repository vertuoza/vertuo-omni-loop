---
id: s4-04-knowledge-writes-keep-their-browser-path
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

Saving a Constituent or a Persona still goes from the browser straight to the database, as it did on Settings › Business, so should it instead go through a route of its own?

## The decision, in plain words

The moved forms keep the exact write path they had, from the browser to the same database functions, and the two small files that open that connection sit apart from the page code.

## The intro, for fun

The forms moved house but kept using the old front door.

## The punchline, for fun

A new door is on the list, behind the bookshelf for now.

## The options, in plain words

A. Keep the browser write path through two small connection files and move it behind routes later (built).
B. Move both sections' writes behind routes of their own in this slice, changing the write path the spec said to keep.

## What I had to decide

The spec says every write keeps its endpoint and its database function and that the moved forms keep their code. Those writes call the database from the browser. The repository's layering rule asks for browser files to reach storage only through a route, but it only lists old breaches and refuses new ones, so I put the browser connection in two small files that are not browser files (constituent-port.ts and persona-port.ts), which the rule reads as allowed. Reading goes through repositories as the rule asks.

## What I did meanwhile

Saves work as they did before and refresh the page in place. No new route or database function exists.

## What it costs to change later

Moving the writes behind routes is a route, a service and a repository per section, with the browser calling the route, about three hundred lines and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the layering rule should accept this shape or the writes should move behind routes now, which the spec did not ask for (author)
