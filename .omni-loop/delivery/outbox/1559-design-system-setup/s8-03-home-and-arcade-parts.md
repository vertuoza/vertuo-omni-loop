---
id: s8-03-home-and-arcade-parts
prd: 1559
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

Our design system file lists the parts of the app pages only; the home page and the game draw their own buttons and arcade cabinets. Should those two places get a list of their own, or join this one?

## The decision, in plain words

I listed the app pages' parts, tagged the home page's sign-up button and the game's cabinets as parts not on the list, and asked the question in the file.

## The intro, for fun

The arcade cabinets asked to join the design system and were told the dress code is business casual.

## The punchline, for fun

They came in pixel art anyway.

## The options, in plain words

A. A. The list stays the app pages' only; the home page and the game wait for a list of their own.
B. B. Their buttons and cabinets join this list as parts, each naming the file that draws it.
C. C. The home page joins this list, and the game keeps its own world off any list.

## What I had to decide

DESIGN.md's Overview names three surfaces (the app pages, HOME, the arcade); the semantic colour tokens are Ask's, which only the app pages use, and HOME and the arcade use the named primitives as they are. HOME's SIGN UP WITH GITHUB is an element of Poster.tsx wired by Controls.tsx, and the game room's cabinets are drawn inside games.tsx: neither is a component, so neither is listed (init.md). The spec puts areas with their own system out of scope (1407's s9-01). home.html and game-room.html tag them `sign-up-button` and `cabinet`, off-list, named under each mockup.

## What I did meanwhile

DESIGN.md asks it as a TODO(human) under Overview; the two mockups print `off-list:` for those tags and no `untagged:`.

## What it costs to change later

A constant now; a second design system file, if chosen, needs the loop to read more than one, which is the open s9-01 question.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the home page and the game are meant to follow the app's rules at all (author).
