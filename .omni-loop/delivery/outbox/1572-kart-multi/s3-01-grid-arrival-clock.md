---
id: s3-01-grid-arrival-clock
prd: 1572
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The grid picks who starts the race, and who holds one of the four places, from the order players arrived in, and each browser says when it arrived by its own clock. What should the arrival be counted by?

## The decision, in plain words

A player's arrival is the moment their own browser joined the grid, by that browser's own clock, and a tie goes to the smaller player id. A browser with a wrong clock can look earlier or later than it is, which only changes who starts the race.

## The intro, for fun

Everybody swears they were first in the queue.

## The punchline, for fun

For now, each player's own watch is the referee.

## The options, in plain words

A. A. Each browser's own clock when it joined, a tie by player id (built).
B. B. The order Supabase Presence reports joins in, which needs no clock but is not documented as stable.
C. C. A counter kept by whoever is first on the grid, which breaks when they leave.

## What I had to decide

Decided by: the slice, with no spec line settling it. Reversible: the arrival is one field of the player's Presence entry, so counting it another way changes one function and no stored data.

## What I did meanwhile

Players are ordered by their own browser's clock, and equal moments by player id.

## What it costs to change later

Swapping to a server-given order touches the grid's join and one test file; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the workspace's players' clocks are close enough in practice (author)
