---
id: s1-02-level-up-before-menu-link
prd: 238
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

A player follows the link back to the game's menu with a new level this device has not celebrated yet. Should the level-up screen play first, or should the menu open at once?

## The decision, in plain words

The level-up screen plays first, as it does on every other way into the menu, and the menu follows once it is done.

## The intro, for fun

The menu was ready to open, but the fanfare had been waiting all week for its moment.

## The punchline, for fun

One press later the menu is there, and the new level got its applause.

## The options, in plain words

A. The level-up plays first, then the menu, the option built.
B. The menu opens at once, and the level-up waits for the next way into the menu.

## What I had to decide

Whether the #menu deep link skips a level-up the player has not seen on this device.

## What I did meanwhile

ArcadeApp.tsx opens a deep link through go(), the path every route to the menu takes, so a level not yet celebrated on this device plays LEVEL UP first; the menu follows from there.

## What it costs to change later

One line in ArcadeApp.tsx: set the scene directly instead of through go().

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says /#menu opens SELECT MODE "at once", and ArcadeApp.tsx says every route to the menu plays a waiting level-up first; neither names the other.
