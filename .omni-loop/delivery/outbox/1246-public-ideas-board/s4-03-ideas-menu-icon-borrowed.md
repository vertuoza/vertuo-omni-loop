---
id: s4-03-ideas-menu-icon-borrowed
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

The Ideas entry in the menu needs a small pixel icon like the others. Should it get one drawn for it?

## The decision, in plain words

It borrows the game's question block icon for now, since drawing a new one is outside this part of the work. When the menu is folded, the entry still shows that icon.

## The intro, for fun

Every menu line wears a tiny pixel hat.

## The punchline, for fun

Ideas borrowed one from the game's wardrobe.

## The options, in plain words

A. Keep the borrowed question block icon, as built.
B. Draw a menu-ideas sprite of its own, such as a light bulb, in a follow-up.
C. Show the entry with no icon, and only its name.

## What I had to decide

Which 16 px sprite the Ideas entry shows: every Dashboard and Work entry has its own menu-* sprite in packages/design, outside this slice's territory.

## What I did meanwhile

The entry uses the existing tile-block sprite (the ? block); the folded rail shows it like every other entry.

## What it costs to change later

A new menu-ideas sprite in packages/design/src/sprites.ts with its fingerprint in sprites.test.ts, then one word in apps/galaxy/src/nav/sidebar.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) packages/design is not in the slice's territory, and the spec says nothing of the entry's icon.
