---
id: s3-01-s3-rebuilds-the-bundle
prd: 522
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The plan said the new skill's slice would not touch the built copy of the command line, but adding its help page does change it. Should that slice rebuild it anyway?

## The decision, in plain words

It rebuilt the built copy so the help page for the new skill ships with the next release and the checks stay green; the other slice of this wave rebuilds it too, so the two copies are merged by building once more.

## The intro, for fun

The plan swore this slice would never touch the build. The help page had other ideas.

## The punchline, for fun

So it rebuilt it, politely, and left a note on the fridge.

## The options, in plain words

A. Rebuild the bundle in this slice, beside the help entry (what was built).
B. Leave the bundle stale in this slice and rebuild it once after the wave merges; the slice's own test run stays red until then.

## What I had to decide

Whether the skill slice may rebuild the committed bundle outside its listed territory.

## What I did meanwhile

The bundle carries the new help entry; when the wave merges both slices, the bundle is rebuilt once from the merged source.

## What it costs to change later

A constant: the rebuilt bundle is a pure build of the source, so dropping this commit and rebuilding after the wave merge gives the same file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's shared-ground note says s3 changes no bundled source; it did not count the help entries, which the bundle carries. (author)
