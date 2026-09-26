---
id: s2-03-game-room-needs-the-galaxy
prd: 160
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When the galaxy cannot be loaded, the other screens on the menu refuse to open and say why. Should the game room refuse the same way, or open anyway with every cabinet locked?

## The decision, in plain words

The game room opens only when the galaxy is loaded, like the other screens. When it is not, choosing the games entry says the galaxy is out of reach.

## The intro, for fun

When the power is out, every ride at the fair closes, but the arcade tent wondered if it could stay open by candlelight.

## The punchline, for fun

It closes with the rest, and the sign on the door says why.

## The options, in plain words

A. Refuse the game room without the galaxy, as the other screens do.
B. Open the game room anyway, with XP OUT OF REACH and every cabinet locked.

## What I had to decide

The spec says GAMES shows to everyone signed in and a visitor sees every cabinet locked; it says nothing of the room when the galaxy itself is out of reach. `doorOf()` in `apps/galaxy/src/arcade/scenes/menu.tsx` refuses every galaxy screen without a galaxy, with the page's problem or "SIGN IN TO SEE THE GALAXY". When the galaxy is out of reach, `arcadeFor()` has read no XP either, so an open room could only show XP OUT OF REACH.

## What I did meanwhile

GAMES goes through the same `doorOf()` as the galaxy's screens: without a galaxy it buzzes with the page's problem, as `menu.test.ts` pins. The menu still lists GAMES, with the hint "XP out of reach".

## What it costs to change later

Low. Opening the room without the galaxy is one line in `doorOf()`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a room that can only say XP out of reach is worth opening when everything else on the menu is closed.
