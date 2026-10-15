---
id: s2-01-stills-frost-ice-patch
prd: 1963
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

A frozen patch on the first bend of FROST EIGHT now shows in the picture of the race on the arcade's cabinet screen, so that picture was redrawn. Is that right?

## The decision, in plain words

We redrew the stored picture of the cabinet screen so that it shows the new ice, because leaving it as it was would have kept the tests red.

## The intro, for fun

The ice has barely arrived and it is already in the photo album.

## The punchline, for fun

Say whether the album keeps the new picture.

## The options, in plain words

A. A. Keep the regenerated still, with the ice patch in the picture.
B. B. Keep the old still and change the camera of the still so the patch is out of view.

## What I had to decide

The still of FROST EIGHT in apps/galaxy/src/arcade/games/stills.ts is generated from the real track and texture; it sits outside this slice's territory, so it was regenerated with the test's update flag (33 rows of pixels changed) and nothing else in that file.

## What I did meanwhile

The new still ships with the ice patch drawn in.

## What it costs to change later

Reverting means restoring the old still, which no longer matches the track.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the cabinet's still should show the patch or a calmer part of the track (author)
