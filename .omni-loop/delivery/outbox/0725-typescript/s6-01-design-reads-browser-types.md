---
id: s6-01-design-reads-browser-types
prd: 725
slice: s6
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The drawing helpers paint on browser canvases, but the main type check only knows the server's words. How should the check learn what a canvas is?

## The decision, in plain words

The two drawing files now tell the check to load the browser's vocabulary. The whole main check then knows browser words too, which other parts of the code could start to lean on.

## The intro, for fun

The paintbrush walked into a room that had never heard of paint.

## The punchline, for fun

So it brought its own dictionary, and lent it to everyone.

## The options, in plain words

A. Keep the browser reference in the two drawing files, the whole main check sees browser words
B. Give the design package its own check settings with browser words, and leave the main check without them
C. Describe the few canvas pieces the helpers use by hand, so no browser vocabulary is loaded at all

## What I had to decide

draw.ts and logo.ts name canvas types (CanvasRenderingContext2D, OffscreenCanvas, HTMLCanvasElement) that the root tsconfig, lib es2023 with only node types, does not declare.

## What I did meanwhile

Added `/// <reference lib="dom" />` at the top of packages/design/src/draw.ts and logo.ts. That pulls lib.dom into the root program, so every root file type-checks with DOM globals beside @types/node.

## What it costs to change later

A constant: delete the two reference lines and give packages/design its own tsconfig with lib dom (the root then excludes it), or declare small structural canvas types locally. No runtime code changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether DOM globals in the root program will hide a missing import or widen a timer type in a later typing slice; no file outside packages/design is checked yet, as all are still @ts-nocheck.
