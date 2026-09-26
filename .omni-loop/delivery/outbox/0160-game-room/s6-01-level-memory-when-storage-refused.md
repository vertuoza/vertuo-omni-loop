---
id: s6-01-level-memory-when-storage-refused
prd: 160
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The level last celebrated is kept in the browser. When the browser refuses to keep anything, as a private or embedded page may, should the level-up still play?

## The decision, in plain words

It plays once each time the page is opened, and not again until the page is reloaded. The level is remembered per GitHub name written in lower case, the same way the XP is saved.

## The intro, for fun

A browser that forgets everything is a goldfish at a party: every lap round the bowl is the first.

## The punchline, for fun

So it gets the cake once per visit, and nobody sings twice in the same room.

## The options, in plain words

A. Play it once each time the page opens when the browser keeps nothing, the option built.
B. Never play it when the browser keeps nothing, as the NEW label on the games entry already does.
C. Keep the level celebrated with the player's saved record instead, so every device agrees.

## What I had to decide

The spec keeps the level celebrated in browser storage and says losing it only replays a fanfare. It does not say what to do when storage cannot be read at all, which the single-file demo page may meet, nor how the login in the storage key is written.

## What I did meanwhile

`createSeen()` in `apps/galaxy/src/arcade/levelup.ts` reads and writes `omni-loop:level-seen:<login>` inside try/catch, the login lower-cased as `player_xp` stores it, and also remembers the level in the page: storage that refuses replays the level-up once per page load, never at every arrival at the menu. The NEW tag on GAMES (s2-02) takes the other side: no storage, no tag.

## What it costs to change later

Low: one fallback in one function. Keeping the level in the database instead would need a migration, and is not what this built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person wants the demo page to replay the level-up on every visit when its browser keeps nothing.
