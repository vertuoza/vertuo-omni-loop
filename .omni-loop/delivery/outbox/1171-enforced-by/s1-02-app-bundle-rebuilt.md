---
id: s1-02-app-bundle-rebuilt
prd: 1171
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

This slice changed shared code the app's built files are made from. Should it rebuild those files too, though they sit outside its agreed area?

## The decision, in plain words

Yes. It rebuilt them, unchanged in behaviour, so the full test run stays green; the next slice that changes the app rebuilds them again on top.

## The intro, for fun

Change the recipe and the cake on the shelf goes stale, even if nobody ordered a new one.

## The punchline, for fun

So this slice baked a fresh one, same taste, just today's date.

## The options, in plain words

A. A. Rebuild the app's bundle in this slice, in its own commit, so the preflight is green.
B. B. Leave the app's bundle stale here and let the second slice rebuild it, with this slice's preflight red until then.

## What I had to decide

The plan gives this slice the kit's bundle to rebuild but not the app's committed bundle, which is also built from the kit's library. The full test run checks that bundle against a fresh build, so leaving it stale turns the preflight red.

## What I did meanwhile

It ran the app's build script and committed the rebuilt bundle with nothing else, in its own commit. The app's own code is untouched: reading the pull request's files in the app stays the next slice's work.

## What it costs to change later

One generated file; the next slice that touches the app or the kit's library rebuilds it again, and a conflict there is settled by rebuilding.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's shared-ground note names only the kit's bundle; it does not say whether the app's bundle was meant to be left to the second slice.
