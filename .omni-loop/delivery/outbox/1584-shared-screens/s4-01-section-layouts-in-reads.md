---
id: s4-01-section-layouts-in-reads
prd: 1584
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

Each part of the app has a small wrapper file that puts the sidebar and top bar around its pages and loads that page's styles. Should a change to it hold the shared frame, the page, or neither?

## The decision, in plain words

Neither: the wrapper is listed as background on both the shared frame and the page, so changing it never holds either one.

## The intro, for fun

Every app page sits in a frame, and every frame has a little hook on the wall.

## The punchline, for fun

We decided the hook belongs to nobody, which is very fair to the hook.

## The options, in plain words

A. A. In reads on both the shared frame and the page: a layout change holds nothing.
B. B. In what the shared frame implements: a layout change holds the frame's owner.
C. C. In what each page implements: a layout change holds that page's owner.

## What I had to decide

Whether each section's layout file belongs to the app-shell screen, to the page screen it wraps, or to neither.

## What I did meanwhile

The layouts are in reads on app-shell and on dashboard and prd-dossier; nothing is locked, so nothing waits either way.

## What it costs to change later

A constant: moving the paths from reads to implements in two or three screen files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The rule's four lines do not name a file that is both wiring for shared structure and a page's own stylesheet import (author).
