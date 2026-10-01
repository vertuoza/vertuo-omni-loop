---
id: s28-01-player-first-save-typing
prd: 725
slice: s28
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When someone joins a fleet for the first time, the arcade may send their row without a name or a hero, and the database refuses a row missing either. Should the first save be made to always carry both?

## The decision, in plain words

The save that creates or changes a player stays as it was, untyped against the database, so nothing it does changes. Every other read and write in this slice is now checked against the database's own description.

## The intro, for fun

The types noticed a new player might arrive with no name and no face.

## The punchline, for fun

The database already turns such strangers away at the door; the question is who tells them first.

## The options, in plain words

A. Leave the save untyped against the database, and the database's refusal stands: what was built, with no behaviour change in this slice.
B. Type the first save so it must carry a name and a hero: a later change to the save and the fleet screens that call it, after which the compiler refuses a first save missing either.

## What I had to decide

Whether the first save of a player must carry a name and a hero, checked before it reaches the database.

## What I did meanwhile

The save works as before: a first save without a name or a hero is refused by the database and the screen shows that refusal.

## What it costs to change later

A constant: typing the save against the database later is a change to one function and its callers' patch type.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any screen ever creates a player without both a name and a hero was not traced through the arcade's fleet screens, which other slices own (author).
