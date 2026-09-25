---
id: s4-02-esc-just-after-leaving-fullscreen
prd: 94
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Some browsers tell the page that fullscreen has ended before they pass on the Esc press that ended it. How should the arcade tell that press apart from an Esc meant to go back?

## The decision, in plain words

An Esc pressed within half a second of leaving fullscreen is taken as the one that left it, and does nothing more. A later Esc goes back, as before.

## The intro, for fun

One key, two jobs, and a browser that sometimes reports the second job first.

## The punchline, for fun

So the arcade waits half a second before it takes Esc at its word again.

## The options, in plain words

A. Half a second: an Esc that soon after leaving does nothing more. This is what was built.
B. No wait at all: only an Esc that arrives while still fullscreen is held back, and one arriving just after goes back.
C. A whole second, which covers slower browsers, at the price of ignoring a quick second Esc meant to go back.

## What I had to decide

The spec says the Esc that leaves fullscreen never also counts as B. Chromium keeps that Esc to itself, but a browser may deliver its keydown after `fullscreenchange`, when `document.fullscreenElement` already reads null, and the page cannot tell it from a new Esc by the fullscreen state alone.

## What I did meanwhile

`ESC_AFTER_LEAVING_MS = 500` in `apps/galaxy/src/arcade/fullscreen.ts`. An Esc keydown while fullscreen leaves it and is spent (the page calls `exitFullscreen()` itself when the browser passes the key on, as headless Chromium does); an Esc within 500 ms of any exit from fullscreen is spent too. After that, Esc is B again. Pinned in `fullscreen.test.ts`.

## What it costs to change later

A constant: the number, or dropping the window, one line and one test. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) which browsers deliver the Esc keydown after `fullscreenchange`: checked in headless Chromium only, where the page sees that Esc while still fullscreen
