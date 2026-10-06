---
id: s6-02-slide-images-are-the-intro-still
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

The Pitch tab still expects two pictures, a wide one and a square one, beside the videos. The old still slide that made them is gone, so where do they come from now?

## The decision, in plain words

Both pictures are the opening scene of the new video, taken once it has settled: the wide one at full size and the square one drawn for a square screen. The Pitch tab and the upload stay exactly as they were.

## The intro, for fun

The poster printer retired, but the cinema still has an empty frame by the door.

## The punchline, for fun

We hang the film's own opening shot in it.

## The options, in plain words

A. A. Both images are the intro scene's settled still, wide and square (built).
B. B. Both images are the contact sheet of every scene.
C. C. The push stops asking for the two images, and the Pitch tab shows a frame of the video instead.

## What I had to decide

What slide.png and slide-square.png hold now that PRD 859's still slide is removed, given that omni pitch push still requires the five files.

## What I did meanwhile

render captures the intro scene's still frame at 1920×1080 as slide.png and at 1080×1080 as slide-square.png, and records the five files in pitch.json under files, as before.

## What it costs to change later

One frame number and one name in the render; the push and the Pitch tab do not change either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec removes the still slide and keeps the push unchanged, but does not say what the two images the push requires should show.
