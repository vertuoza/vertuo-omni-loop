---
id: s1-02-archived-by-login
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The banner on an archived product says who archived it. Should it show their GitHub name or their display name?

## The decision, in plain words

It shows their GitHub name, the one the approvals and questions already use, and leaves the name out when it is not known.

## The intro, for fun

Somebody put this product on the shelf.

## The punchline, for fun

The banner names them, the way the rest of the page does.

## The options, in plain words

A. A. The GitHub name, and no name when it is unknown (built).
B. B. The display name, falling back to the GitHub name.

## What I had to decide

Which name the banner `Archived <ago> by <name>.` shows: the screen library's draft leaves it as an open question.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

Built A: the archiver's GitHub login, read from their player row in the workspace; with none, the banner reads `Archived <ago>.`.

## What it costs to change later

A one-line change in the product home's service.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether members recognise each other by GitHub name or by display name on this page was not asked.
