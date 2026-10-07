---
id: s1-01-generated-sources-wider
prd: 1138
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The spec lists the folders each built bundle is rebuilt from, but both builds read a few more. Should the list name every folder each build reads?

## The decision, in plain words

The list names every folder each build really reads, so a change to the kit's templates, its pitch engine, the App's entry points or the shared packages also marks the right bundle as needing a rebuild.

## The intro, for fun

Two bundles, and each reads a few more folders than the spec remembered.

## The punchline, for fun

A list of sources that forgets one is a rebuild that never happens.

## The options, in plain words

A. A. Name every folder each build reads (built).
B. B. Keep only the folders the spec spelled out, and let the tests that compare each bundle with a fresh build catch the rest.

## What I had to decide

Whether this repository's generated list names every source folder of each build, or only the ones the spec spelled out.

## What I did meanwhile

Both entries list the wider sources: the kit bundle from kit/lib/, kit/bin/, kit/templates/, kit/pitch-engine/ and kit/build.ts; the App's bundles from apps/omni-app/src/, apps/omni-app/entries/, apps/omni-app/build.ts, kit/lib/, packages/design/ and packages/github/.

## What it costs to change later

One line of .omni-loop/config.yml either way; nothing else reads the list differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) packages/design/ and packages/github/ were read from the App's imports today; a package it starts importing later must be added by hand.
