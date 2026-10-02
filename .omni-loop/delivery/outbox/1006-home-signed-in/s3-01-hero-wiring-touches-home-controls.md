---
id: s3-01-hero-wiring-touches-home-controls
prd: 1006
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

The plan said this step would leave the home page's interactive part untouched, but swapping the photo for the player's hero needs it to listen for a second answer. Should this step change it anyway?

## The decision, in plain words

It changes one line there, so the pill shows the photo at once and then the hero. Without that line the photo would show and the hero never would.

## The intro, for fun

The hero was ready to walk on stage, but nobody had left the door open.

## The punchline, for fun

So we oiled one hinge and wrote down that we did.

## The options, in plain words

A. A. Change that one line so the hero replaces the photo (built).
B. B. Leave the file untouched and let the no-flash slice wire the callback when it merges.
C. C. Wait for every read and draw only once: no photo first, the hero after a longer blank.

## What I had to decide

Whether this slice may change one line of the home page's interactive part, outside the paths its plan row lists, to draw the hero after the photo.

## What I did meanwhile

The session read takes an optional callback that receives the photo at once, then the hero; the home page passes it. Called without it, the read still resolves with the photo, as before. The parallel no-flash slice edits the same spot, so the wave merge may need to keep both changes.

## What it costs to change later

Reverting is one line: the home page goes back to drawing the photo only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan said this slice leaves that file unchanged, but the pill draws only what one answer returns, so a second face cannot reach it without that line.
