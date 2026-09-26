---
id: s2-02-games-new-tag-until-the-room-is-seen
prd: 160
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The approved drawing of the menu shows a NEW label beside the games entry, but nothing says when it should go away. Should it stay for good, or disappear once the player has looked inside the game room?

## The decision, in plain words

The NEW label shows until the player first opens the game room on a device, and then it is gone on that device.

## The intro, for fun

Every shop window loves a NEW sticker, until it has been there so long it is the oldest thing in the shop.

## The punchline, for fun

Ours peels itself off the moment you walk in.

## The options, in plain words

A. Show NEW until the game room is opened once on a device.
B. Show NEW for good, exactly as drawn.
C. Show no NEW label at all.

## What I had to decide

Section 1 of `before-after.html` draws a red NEW tag beside GAMES on the menu. The spec and the plan never mention it. The menu's existing `fresh` flag (on PLAY, MY HERO and CHANGE FLEET in `scenes/menu.tsx`) is not drawn anywhere, so there was no rule to follow for when a tag goes away.

## What I did meanwhile

`menuItems({ newGames })` in `apps/galaxy/src/arcade/scenes/menu.tsx` puts `tag: 'NEW'` on GAMES, drawn beside its label. `ArcadeApp.tsx` reads `omni-loop:games-seen` from the browser's storage on the first render and writes it when the `games` scene opens. With storage refused, no tag shows, so it can never stick. `menu.test.ts` covers the tag on GAMES only, and its absence once seen.

## What it costs to change later

Low. One key in browser storage and one flag in `menuItems()`: dropping the tag, or keeping it for good, is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether NEW should come back when a later PRD adds a game to the room; a key that names the newest game would do it.
