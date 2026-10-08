---
id: s4-02-which-board-work-ideas-opens
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

A team can have several repositories, each with its own ideas board. Which board should the Ideas entry in the menu open?

## The decision, in plain words

It opens the board that is public, and when none is, the first repository the team added. A team with no repository yet lands on the settings page where boards are switched on.

## The intro, for fun

One door, several rooms behind it.

## The punchline, for fun

We open the room with the lights on first.

## The options, in plain words

A. Open the public board first, else the first repository's, else Settings › Repositories, as built.
B. Open a small page listing every board of the workspace to choose from.
C. Always open Settings › Repositories, where each row links its board.

## What I had to decide

Which repository's board Work › Ideas opens when the workspace lists several, and where it goes when it lists none.

## What I did meanwhile

The viewer reads one repository per page load (public_ideas first, then added_at) through workspaceBoard() in apps/galaxy/src/ideas/members/store.ts; the sidebar links its board, else /app/settings/repositories.

## What it costs to change later

The ordering of one query in apps/galaxy/src/ideas/members/store.ts, or a small board picker page later.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the entry opens the workspace's board, but a workspace holds a board per repository and the spec does not say which one.
