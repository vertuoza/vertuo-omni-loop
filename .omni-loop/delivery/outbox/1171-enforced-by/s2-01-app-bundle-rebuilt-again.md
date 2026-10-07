---
id: s2-01-app-bundle-rebuilt-again
prd: 1171
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

This slice changed the app's harvest, and the app's built file is made from it. Should it rebuild that file too, though it sits outside its agreed area?

## The decision, in plain words

Yes. It rebuilt that file in a commit of its own, with nothing else in it, so the full test run stays green.

## The intro, for fun

The recipe changed again, so the cake on the shelf went stale again.

## The punchline, for fun

Same bakery, same oven, one more fresh cake.

## The options, in plain words

A. Rebuild the app's bundle in this slice, in its own commit, so the preflight is green.
B. Leave the app's bundle stale and let the feature branch rebuild it once, with this slice's preflight red until then.

## What I had to decide

Whether a slice that changes the app's code also rebuilds the app's committed bundle when the plan leaves that bundle out of its territory.

## What I did meanwhile

It ran the app's build script on top of the first slice's rebuild and committed the regenerated bundle alone, in its own commit. The app's own source changes stay inside the slice's folder.

## What it costs to change later

One generated file; any later change to the app or the kit's library rebuilds it again, and a conflict there is settled by rebuilding.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's shared-ground note says this slice never touches a bundle; it names only the kit's bundle, not the app's, which the full test run also checks against a fresh build.
