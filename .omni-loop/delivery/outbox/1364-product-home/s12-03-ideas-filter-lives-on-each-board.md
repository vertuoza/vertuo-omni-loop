---
id: s12-03-ideas-filter-lives-on-each-board
prd: 1364
slice: s12
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

There is no single list of all ideas, only one board per repository. Where does the ideas product filter go, and who sees it?

## The decision, in plain words

Each repository's ideas board gets the product filter, shown only to members of its workspace; a visitor of a public board sees the whole board and no product names.

## The intro, for fun

The ideas had no lobby, only a room per repository.

## The punchline, for fun

So every room got its own product switch, hidden from passers-by.

## The options, in plain words

A. A. The filter on each repository's board, for members only (built).
B. B. A new /ideas page listing every idea of the workspace, with the filter.
C. C. Both: the board's filter and a new workspace-wide page.

## What I had to decide

Whether the ideas product filter belongs on each repository's board, members only, or on a new page listing every idea of the workspace.

## What I did meanwhile

On /ideas/<owner>/<repo>, a member reads the products of the board's workspace and which ideas carry one, and the board's lanes are narrowed to all, one product or no product. No /ideas index page was created; the public board reads nothing more for a visitor.

## What it costs to change later

A new page later (app/ideas/page.tsx) can reuse the same filter rules; the board's filter stays or goes with one line in its page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says /ideas stays and gains a product filter, but no /ideas page exists today, only the per-repository boards.
