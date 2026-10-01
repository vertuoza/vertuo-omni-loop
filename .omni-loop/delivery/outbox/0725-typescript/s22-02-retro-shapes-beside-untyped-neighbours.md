---
id: s22-02-retro-shapes-beside-untyped-neighbours
prd: 725
slice: s22
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The retro's main steps were typed while the parts they lean on were still being typed by other slices at the same time. Where should the shapes they share live?

## The decision, in plain words

The retro's steps describe the shapes they need in a file of their own beside them, written loosely enough that the other slices' shapes still fit. Where a helper was not typed yet, the retro names the shape that helper documents.

## The intro, for fun

Two crews built the two halves of a bridge at the same time, each from its own drawing.

## The punchline, for fun

The drawings agree on where the bridge meets; the bolts get compared once both halves are up.

## The options, in plain words

A. Keep the retro's own shapes beside it, loose enough to fit, and fold them into the neighbours' types after the wave
B. Wait for the kinds and the app's helpers to be typed first, and type the retro's steps after them
C. Move the shared shapes into one app-wide types file now, outside this slice's ground

## What I had to decide

s21 types apps/omni-app/src/retro/kinds/ and s19 types git-write, snapshot, outbox-check and the test helpers in the same wave; s22's territory holds neither. The kinds' registry exported its Kind type only as JSDoc, which a .ts file ignores, and git-write's addCommit and the kit's askModel still open with @ts-nocheck, so their parameters read as their defaults (files: never[]).

## What I did meanwhile

Wrote apps/omni-app/src/retro/retro.types.ts (Octokit, Kind with method signatures so a narrower kind still fits, the fact sheet, the prose, the run records). retro.ts filters kinds by run itself (kindsIn) rather than through kindsFor, whose parameter is typed by the registry's default. publish.ts and narrate.ts call addCommit and askModel through a typed view of what their doc comments say, each cast marked ts-allow. Tests reach the untyped scenario helpers through local loose wrappers.

## What it costs to change later

Cheap: once s19 and s21 merge, the wave check can point retro.types.ts at their exported types, drop kindsIn for kindsFor, and remove the two typed views; no output depends on any of it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which exported names s19 and s21 chose for the Octokit seam and the kind type (author)
