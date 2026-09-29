---
id: s3-01-s3-rebuilds-the-bundle
prd: 549
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The help page's list of skills is packed into the installable command file, so adding the new skill to help changes that file too, which the plan had not given this piece of work. Should this piece rebuild it?

## The decision, in plain words

It rebuilds the installable command file so the new skill shows in help once installed; the other piece of the same round also rebuilds it, and the second to land simply rebuilds it again.

## The intro, for fun

The plan said this piece would not touch the packed command file. The packed command file disagreed.

## The punchline, for fun

One rebuild each, and the last one to land presses the button again.

## The options, in plain words

A. This piece rebuilds the packed command file; the round rebuilds it again when it merges the second piece (built).
B. This piece leaves the packed command file stale, with its check red, and the round rebuilds it once after merging both pieces.
C. Move this piece to the next round and give it the packed command file, so the two pieces never both rebuild in one round.

## What I had to decide

Whether slice s3 may rebuild the committed bundle kit/dist/omni.mjs, outside its territory, because its help entry is bundled.

## What I did meanwhile

s3 commits a rebuilt kit/dist/omni.mjs. s1, in the same wave, also rebuilds it; whichever sub-PR merges second conflicts only on that generated file, which is resolved by running pnpm kit:build on the merged tree.

## What it costs to change later

A constant: dropping the commit and rebuilding the bundle on the feature branch undoes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's shared-ground note says s3 changes no bundled source; kit/lib/help/entries.mjs is bundled, so the note was wrong (author).
