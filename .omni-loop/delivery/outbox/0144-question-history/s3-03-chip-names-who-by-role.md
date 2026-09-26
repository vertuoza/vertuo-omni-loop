---
id: s3-03-chip-names-who-by-role
prd: 144
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The chip on each question says who set its category: should it give that person's name, or only say whether it was the model, you, the owner or a teammate?

## The decision, in plain words

It says it by role: sorted by the model, set by you, set by the session owner, or set by a teammate. Clearing a category shows the question as unsorted, cleared by that person.

## The intro, for fun

A sticky note on every question, signed by somebody.

## The punchline, for fun

For now the signature reads teammate, which narrows it down to everyone.

## The options, in plain words

A. By role: the model, you, the session owner, or a teammate
B. By the person's player name, falling back to a teammate when they have none

## What I had to decide

How the chip names who set a question's category, when the page only knows an account's id.

## What I did meanwhile

The page compares the id with the viewer and the session's owner and prints a role; no name is looked up.

## What it costs to change later

Showing names later is a read of the workspace's players on the page; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the chip shows who set it, without saying whether by name (author)
- A member who never joined the game has no player name to show, so names would need a fallback anyway (author)
