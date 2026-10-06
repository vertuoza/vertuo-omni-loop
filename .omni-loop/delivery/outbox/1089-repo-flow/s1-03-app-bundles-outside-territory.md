---
id: s1-03-app-bundles-outside-territory
prd: 1089
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

This slice had to rebuild the GitHub app's bundled files, which its plan did not list. Should those files be part of every slice that changes the shared config reader?

## The decision, in plain words

I rebuilt the app's two bundled files in this slice, since the app carries the config reader inside them and the test suite refuses a stale copy, and committed them here rather than leaving the suite red.

## The intro, for fun

The plan said 'touch only these files', and the build politely disagreed.

## The punchline, for fun

Two bundles came along for the ride, freshly built and nothing else changed.

## The options, in plain words

A. Keep it: the slice that changes the shared config reader rebuilds the app's bundles too, as a generated change.
B. Leave the bundles stale in slices and rebuild them once on the feature branch before it is marked ready.

## What I had to decide

Changing kit/lib/config.ts makes apps/omni-app/api/github.mjs and apps/omni-app/api/inngest.mjs stale: apps/omni-app/src/vercel-functions.test.ts fails until node apps/omni-app/build.ts rebuilds them. The plan's territory for s1 lists kit/dist/omni.mjs but not these two. I rebuilt and committed them in s1, a generated change only, so the preflight is green. Later slices that touch what the app bundles (s3's plan grading, say) will meet the same.

## What I did meanwhile

Committed the two regenerated bundles in their own commit, nothing hand-edited.

## What it costs to change later

Nothing to undo: they are a build output; a later slice rebuilds them again. The plan's shared-ground note could name them for s3 and s6.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the plan meant the app bundles to stay out of every slice and be rebuilt once on the feature branch
