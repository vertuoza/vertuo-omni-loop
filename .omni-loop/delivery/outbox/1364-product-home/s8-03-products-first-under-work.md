---
id: s8-03-products-first-under-work
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Where does Products sit in the sidebar, and which picture does it carry?

## The decision, in plain words

Products comes first under Work, above Roadmaps, since a product holds the rest of the work. It reuses the existing coin picture until one is drawn for it.

## The intro, for fun

A new tenant moves into the sidebar and asks for the top floor.

## The punchline, for fun

It got the top floor, and a borrowed doorplate for now.

## The options, in plain words

A. First under Work with the coin sprite, the option built.
B. Under Dashboard, beside Workspace.
C. Last under Work, after Knowledge.

## What I had to decide

The Products entry's group, position and sprite.

## What I did meanwhile

First entry of the Work group, path /app/products, sprite 'coin' from @omni/design (a 16 px sprite that already exists).

## What it costs to change later

One line in src/nav/sidebar.ts and its tests; a new sprite is a change in packages/design.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a dedicated 'menu-products' sprite is wanted
