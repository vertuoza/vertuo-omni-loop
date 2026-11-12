---
id: s1-01-law-home-reexports-kit-builder
prd: 2728
slice: s1
rank: medium
bears-on: none
raised: 2026-11-12
wave: 1
---

## The question, in plain words

The code that reads a product's business laws had to move into the shared kit so the App can use it too. That took a small edit to a file outside this step's list; is that fine?

## The decision, in plain words

The galaxy file now takes the function from the kit and hands it on under the same name, so every caller keeps working and no logic was copied.

## The intro, for fun

A function packed its bags for the kit and left a forwarding address.

## The punchline, for fun

Mail still arrives; only the street changed.

## The options, in plain words

A. A. Move the function to the kit and let the old place hand it on (built).
B. B. Keep one copy in the kit and one in galaxy, and let the duplication count grow.

## What I had to decide

Moved lawsOfPackFiles to kit/lib/knowledge/entries.ts (the kit builder needs it, and the App's embed job in s4 cannot import galaxy). apps/galaxy/src/business-laws/law-home.ts, outside s1's territory, now imports and re-exports it: three lines, behaviour unchanged. The alternative, a copy in the kit, fails the repository's duplication audit.

## What I did meanwhile

Callers of law-home keep importing lawsOfPackFiles from it; nothing else changes.

## What it costs to change later

One small edit outside the listed paths; undone by moving the function back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner of the territory minds the three-line edit to law-home.ts (author)
