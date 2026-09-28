---
id: s2-02-disbanded-with-no-fleets
prd: 400
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

A player whose fleet was retired is asked to pick a new one. What happens when the workspace has no other fleet left to pick?

## The decision, in plain words

They play on. While another fleet flies they are sent to pick one, as today; when none does, they go straight to the menu, still shown under their retired fleet's name.

## The intro, for fun

The ship was retired, and the harbour is empty.

## The punchline, for fun

The captain keeps sailing the old flag until a new one is raised.

## The options, in plain words

A. Let them play on under their retired fleet's name until a fleet flies again.
B. Make them solo automatically, clearing their retired fleet.
C. Show them the invitation screen and let them go on to the menu from it.

## What I had to decide

The spec makes a fleet optional and says a player is ready once they have a player row, but also keeps sending a player whose fleet was retired to pick again. With no active fleet, that pick screen would be the invitation, a dead end.

## What I did meanwhile

A player whose fleet was retired counts as ready when no fleet is active, and is sent to pick again only while at least one fleet is active. Their stored fleet is left as it is.

## What it costs to change later

A constant: one condition in the rule that says who is ready.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether such a player should read SOLO instead of their retired fleet's name was not settled. (author)
