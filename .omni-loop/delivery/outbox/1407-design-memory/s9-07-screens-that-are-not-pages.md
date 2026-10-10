---
id: s9-07-screens-that-are-not-pages
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The game room is not a web page of its own: it is a scene inside the game, reached from a menu, and a PRD page holds a dozen tabs that each behave like a screen, while the library expects one address per screen. Should a screen say how to reach it, and which larger screen it is part of?

## The decision, in plain words

The game room is recorded at the address the game's own links use, and the PRD page as one screen with all its tabs, each with an open question about it.

## The intro, for fun

The game room has no street address, only a door at the back of the arcade.

## The punchline, for fun

The reviewer arrives at the front desk and asks for directions.

## The options, in plain words

A. Record each such screen at the nearest address, with an open question (built)
B. Let a screen name how it is reached and which screen it belongs to
C. Keep the library to whole pages, and leave scenes and tabs out

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a screen of the library may name how it is reached (a key path from a named screen, an account or demo state, a query) and the screen it is part of (a tab of a page, a scene of an app, a state of a dialog), so the review can open it and touched can name the parent with the part.

## What I did meanwhile

Nothing of the kit changed in this slice. game-room.md routes /play#games (DEEP_LINKS in apps/galaxy/src/arcade/deep-link.ts); prd-dossier.md routes /prd/<id> and lists its tabs under Words. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether tabs should be screens of their own or regions of one screen is the owner's call; the open questions of prd-dossier.md ask it
