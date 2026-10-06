---
id: s7-04-changes-beyond-the-slice
prd: 1108
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

Making the video from the settings needed small changes in a few files outside this slice's ground. Were they right to make?

## The decision, in plain words

Yes: the terminal's call to the Omni page gained the new settings address and lost the old look-only one nothing used any more, the step that loads fonts now finds an uploaded font, and the skill's tests follow the rewritten skill.

## The intro, for fun

A few small screws turned outside the cupboard the carpenter was hired to build.

## The punchline, for fun

Without them the cupboard's door would not close.

## The options, in plain words

A. Keep these edits in this slice (built).
B. Move them to a slice of their own, leaving this one unable to read the settings or draw an uploaded font.

## What I had to decide

Whether these edits stay, or move to slices of their own.

## What I did meanwhile

kit/lib/ask/client.ts gains readPitchSettings (GET /api/pitch-settings) and drops readPitchLook, now unused; kit/lib/pitch/render-input.ts asks each font through fontRequestOf so a family asset:<file> is drawn from the run's file; kit/test/plugin.test.ts's pitch block tests the rewritten skill, including the never-invent rule. The providers' network type is renamed ProviderFetch (kit/lib/pitch/providers/types.ts and the seven files that use it), so it no longer shares its name with the Omni page client's Fetch, which the dead-code audit against main reported. The render's local server (kit/lib/pitch/render-server.ts) now answers a byte range of a run's file: without it the browser could seek a clip only as far as it had downloaded, and a filmed walk-through's frame often showed the clip's first, blank frame, in the stills and the videos alike.

## What it costs to change later

Each is a few lines; reverting one means the old look-only read, no uploaded fonts, or the old skill's tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice names neither the Omni page client, the render's input nor the plugin's test file, though the slice cannot be done without them.
