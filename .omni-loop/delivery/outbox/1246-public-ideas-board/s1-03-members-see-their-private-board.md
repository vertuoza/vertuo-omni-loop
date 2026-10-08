---
id: s1-03-members-see-their-private-board
prd: 1246
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

When a board is still private, may the workspace's own members open it at its public address?

## The decision, in plain words

Yes: a member signed in sees their private board at the same address, with a line saying only members see it. Anyone else gets the same no public board here page as for a repository with no board.

## The intro, for fun

The shop is closed, but the staff still have keys.

## The punchline, for fun

Customers see the closed sign, the team sees the shelves.

## The options, in plain words

A. A. Members see their private board at its address, marked private; everyone else sees no public board here.
B. B. Everyone, members included, sees no public board here until the board is public.

## What I had to decide

Whether members should see a private board at its address, or get the same no public board page as everyone else until it is public.

## What I did meanwhile

Members read a private board at its address, marked private; signed-out visitors and non-members see the no public board page, which never tells a private board from a missing one.

## What it costs to change later

Hiding it from members too is a one-line change in the database function and the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a private board answers no public board here, and that members reach the board from the sidebar, but not what a member sees on a private board.
