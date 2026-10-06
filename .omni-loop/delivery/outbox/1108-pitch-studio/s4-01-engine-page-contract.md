---
id: s4-01-engine-page-contract
prd: 1108
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

How should the tool that films a pitch tell the animation page what to draw, and learn how long the video is?

## The decision, in plain words

The page reads one input file holding the storyboard, the look, the fonts, the logo and the credits, draws any frame on request once everything has loaded, and answers the video's length and each scene's best still image. A player mode with keyboard keys and an automatic reload is built in for the preview.

## The intro, for fun

Every film set needs one script that everybody reads from.

## The punchline, for fun

Ours fits in a single file, and the camera can ask for any frame it likes.

## The options, in plain words

A. A. One input file beside the run, a call to draw a frame and one to read the video's length and stills, a built-in player mode (built).
B. B. The page reads the storyboard and the look from fixed file names in the run's folder, and the render works out the length itself.
C. C. The render injects everything into the page through calls, with no input file at all.

## What I had to decide

Whether one input file and two page calls are the right way for the render and the preview to drive the animation page, before the render is built on it.

## What I did meanwhile

The render and the preview, built next, write the input file beside the run and ask the page for frames, its length and its stills through these calls.

## What it costs to change later

A few lines in the page and in the render: the file's name, a field, or a call can be renamed while only these two use them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the call that draws a frame but not how the page learns its storyboard, nor how the render learns the video's length; both are this slice's choice.
- (author) The preview's keys and its reload follow the spec's line on the studio; the studio itself is built in a later slice, which may want them otherwise.
