---
id: s5-01-shared-chrome-in-reads
prd: 1550
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

The menu and top bar sit around every app page. Should a change to them count as a change to the dashboard's drawing, or only as something the dashboard depends on?

## The decision, in plain words

They count as something the dashboard depends on, so a change to the shared menu never trips the dashboard's lock. The same goes for the arcade menu file that draws the game room's badge.

## The intro, for fun

Every app page wears the same jacket, and the dashboard was asked whether the jacket is part of its outfit.

## The punchline, for fun

It said no, so changing the jacket never wakes up four locked screens at once.

## The options, in plain words

A. A. Shared chrome goes in reads: a change to it never trips a screen's lock (built).
B. B. Shared chrome goes in implements of every screen it surrounds: any change to it trips every locked app screen.
C. C. Shared chrome becomes its own screen in the library, with its own mockup and lock.

## What I had to decide

Whether shared chrome (the app layout around every app page, the arcade menu file that also draws the game room's badge) goes in a screen's implements or its reads.

## What I did meanwhile

dashboard reads apps/galaxy/app/app/layout.tsx and game-room reads apps/galaxy/src/arcade/scenes/menu.tsx; both screens are drafts, so a lock is still to come and nothing trips today.

## What it costs to change later

One line moved between two lists in a draft screen's front matter: no code, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The rule in the mock skill (a file whose change can change what a person sees goes in implements) does not say how shared chrome is placed; the choice is recorded in dogfood.md (author)
