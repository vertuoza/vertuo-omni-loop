---
id: s1-03-no-level-stored-as-zero
prd: 160
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

Someone who has not earned a point yet has no level. Should their saved record say level 0, or leave the level empty?

## The decision, in plain words

I save level 0 for no level, so every saved record always holds a number. The game room still to be built must read 0 as no level and show none.

## The intro, for fun

Zero or nothing? Philosophers have argued about it for centuries; databases just want a number.

## The punchline, for fun

We gave them a zero, and asked the screens to keep it to themselves.

## The options, in plain words

A. Save 0 for no level, and have every screen read 0 as no level.
B. Leave the level empty for no level, so an empty value, not a number, means no level.

## What I had to decide

The spec says 0 XP is no level and stores `level smallint`, but not how "no level" is stored. `player_xp` holds a row for every login the ledger names (D14), so a login with no counted credit needs some level value.

## What I did meanwhile

`levelFor()` returns 0 below the first point, and `player_xp.level` is `not null check (level >= 0)`: such a login is stored as `xp 0, level 0, unlocked {}`, by `pnpm game:xp` and by the demo seed. s2's badge and game room must treat 0 as no level.

## What it costs to change later

Low while nothing reads it: making the column nullable is a one-statement follow-up migration, plus one line in `levelFor()`. Once s2 reads 0, each screen that shows a level changes too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Nothing yet enforces that a screen never shows LV 0: that lands with s2.
