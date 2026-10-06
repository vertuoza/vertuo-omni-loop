---
id: s6-04-changes-beyond-the-slice
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

Finishing this slice needed a few changes in files planned for other slices: removing the old generated music and the old video recipe, and fixing how the tool finds the browser it films with. Is it fine that this slice made them?

## The decision, in plain words

Yes: the old generated music and the old recipe that stitched a still slide to a clip are deleted, as the spec asks, and the browser lookup now works with the way the browser package is published. Nothing else in those files changed.

## The intro, for fun

Moving into the new flat meant taking out the neighbour's old sofa too.

## The punchline, for fun

We asked the sofa; it did not object.

## The options, in plain words

A. A. This slice removes the dead parts and fixes the browser lookup (built).
B. B. The dead parts stay until a later clean-up, and the browser fix goes in its own fix.

## What I had to decide

Whether this slice may change kit/lib/pitch/music.ts, kit/lib/pitch/ffmpeg.ts and the playwright capture provider, which sit outside its territory.

## What I did meanwhile

music.ts keeps only silenceWav (the none provider's), ffmpeg.ts keeps only framesArgs (the encode provider's), their tests lose the parts that tested what was removed, and the playwright capture provider reads chromium from the default export when the package resolves to its CommonJS entry (without that no frame could be captured in this repository).

## What it costs to change later

Nothing to undo: the removed code had no caller left, and the fix is two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the music and ffmpeg modules are used only through the registry, not changed, by this slice; the spec asks for the procedural music and the stitching to go away.
