---
id: s4-01-f-key-on-every-device
prd: 94
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The plan says the F key switches fullscreen on and off on a computer. Should it also do so on a phone or a tablet played with a keyboard plugged in?

## The decision, in plain words

Yes: the F key switches fullscreen on every device, since the keyboard works the same everywhere and only the body around the screen changes. On the name screen it still types an F.

## The intro, for fun

A tablet with a keyboard plugged in is a computer on weekends.

## The punchline, for fun

So it gets the same F key, and nobody asks about its day job.

## The options, in plain words

A. The F key switches fullscreen on every device, except on the name screen. This is what was built.
B. The F key switches fullscreen on a computer only; on a phone or a tablet it does nothing, and only the first press of each page load asks.

## What I had to decide

Decision 11 and the `full` section of the spec say F toggles fullscreen on `full`, except on the name screen. The spec does not say whether F also toggles on `handheld` and `advance`, where a Bluetooth keyboard drives the Game Boy ("The keyboard still works in every form").

## What I did meanwhile

`fullscreenPress()` in `apps/galaxy/src/arcade/fullscreen.ts` reads F the same way in every form: it toggles fullscreen, except on the name screen, where F types an F. The rule never reads the form, as the spec's Solution has a form pick only the body around the screen and the grid inside it. Pinned in `fullscreen.test.ts`.

## What it costs to change later

A constant: pass the form to the rule and let F through unless it is `full`, plus one test. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a tablet player with a keyboard expects F to do anything: nobody has played it
