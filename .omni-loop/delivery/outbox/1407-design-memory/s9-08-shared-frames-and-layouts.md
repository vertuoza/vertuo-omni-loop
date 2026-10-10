---
id: s9-08-shared-frames-and-layouts
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

A few files frame every screen at once: the top layout that sets zoom for the whole site, and the app shell with its sidebar; a change to them touches every screen, but no screen of the library says it depends on them. Should the library know which frame each screen sits in?

## The decision, in plain words

Each draft screen lists only its own files. A change to the shared layout or the app shell names no screen.

## The intro, for fun

Every painting hangs in the same frame, and nobody listed the frame.

## The punchline, for fun

Re-gild it and the catalogue says no painting changed.

## The options, in plain words

A. Leave frames out of the screens' files (built)
B. Add a frame to the library that names the layouts each screen sits in
C. List the shared layout in every screen's files

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a frame kind in the library (or a frame field on a screen) naming the layouts and shells a screen sits in; touched lists every screen in a frame the diff changes.

## What I did meanwhile

Nothing of the kit changed in this slice. design.paths includes apps/galaxy/app/, so a layout change still reads ui: yes, but its screens: line is empty: none of the four drafts lists apps/galaxy/app/layout.tsx or apps/galaxy/src/nav/. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Listing the shell under every screen's implements would work today but makes every shell change name every screen, which may be what a person wants
