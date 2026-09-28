---
id: s1-01-mascot-choices
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Which pictures may an owner pick as a fleet's mascot?

## The decision, in plain words

The six fleet animals and characters the game already draws: the beaver, the octopus, the duck, the spy, the pirate and the invincible hero. The commander, the enemy, the plain heroes and the small icons are not offered.

## The intro, for fun

Six mascots walk into a fleet screen and ask to be picked.

## The punchline, for fun

The commander stays on the bridge, and the enemy stays outside.

## The options, in plain words

A. The six fleet mascots, kept as a list in the database, as built.
B. Every drawable sprite except the plain heroes and icons, the commander and the enemy included.
C. No list in the database: accept any short key and let the app draw a hero when it does not know it.

## What I had to decide

Which sprites count as mascots an owner may choose, and whether that list lives in the database or is read from the sprite library.

## What I did meanwhile

The database holds the six fleet mascots in one small list; adding a mascot later is one line in a new migration.

## What it costs to change later

One list in one migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the commander or the enemy should ever be a fleet mascot (author)
- whether the list should instead be generated from the sprite library at build time (author)
