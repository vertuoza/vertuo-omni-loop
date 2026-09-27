---
id: s3-03-wide-menu-rows-tightened
prd: 238
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

With the new way to the app, a player's menu has ten rows, and on a computer or a phone held sideways the last one now touched the line at the bottom of the screen. Should the rows sit a little closer together there too, as they now do on a phone held upright?

## The decision, in plain words

Yes: on the wide screen the rows sit slightly closer together and start slightly higher, so all ten end clear of the bottom line. Nothing is dropped or split over pages.

## The intro, for fun

Ten rows walked into a menu built for nine, and the last one stood on the footer's toes.

## The punchline, for fun

Everyone shuffled up a couple of pixels, and there was room for all.

## The options, in plain words

A. The rows sit slightly closer together on the wide screen, the option built.
B. The rows keep their spacing, and the bottom line moves lower instead.

## What I had to decide

How a linked player's ten-row SELECT MODE fits the wide grid (640×360). The spec names only the tall grid as the tight fit, but on the wide one SIGN OUT's row overlapped the footer by about a pixel.

## What I did meanwhile

In src/arcade/scenes/menu.css the wide long menu's rows are 2px apart instead of 3px, under a 12px margin instead of 16px: SIGN OUT now ends about 12px above the footer, checked at 852×393 and 1440×900.

## What it costs to change later

Two numbers in menu.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the tall grid as the tightest fit and says how to tighten it there; it says nothing of the wide grid, which also overflowed.
