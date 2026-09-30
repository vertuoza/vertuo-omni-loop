---
id: s4-02-dock-select-stays-with-the-page
prd: 817
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

In the corner game box, should the select button fold the box from the platform game's pause screen, as the spec says?

## The decision, in plain words

The corner box still ignores the select keys, which are also the page's own keys for moving between links; Escape folds the box instead, and B goes back to the game list.

## The intro, for fun

Two buttons wanted the same key, and the page had it first.

## The punchline, for fun

Escape still gets you out, and your links still work.

## The options, in plain words

A. Keep SELECT for the page, fold with Escape and go back with B, as built.
B. Hear Shift as SELECT in the dock and fold on it, leaving Tab to the page.
C. Hear both Tab and Shift in the dock while a game is open.

## What I had to decide

Whether SELECT folds the dock from SUPER OMNI WORLD's pause screen. SELECT is Tab or Shift on the keyboard, and the dock has always left those to the page so a reader can still move between links.

## What I did meanwhile

The dock's pure steps fold on SELECT from the pause, but the dock's keyboard never sends it, so in practice Escape folds and B goes back to the picker. Hearing SELECT is one line in the dock's key handling.

## What it costs to change later

One line in the dock's keyboard handling; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says SELECT folds the dock from the pause, while the dock built earlier deliberately ignores SELECT so Tab keeps moving focus on the page
