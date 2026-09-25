---
id: s2-02-bundle-hands-out-the-kit-defaults
prd: 45
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The shared default pages must travel inside the one file every repository installs. How should that file carry them, and how can anyone check that its copy matches the kit's?

## The decision, in plain words

The installed file carries every default page and hands them out on request, so a test can prove the installed copy says exactly what the kit's own pages say.

## The options, in plain words

A. The installed file carries every default page and hands them out on request, and a test compares them with the kit's own pages.
B. The installed file carries the pages but shows them only through the knowledge commands of the next slice; until then nothing checks the installed copy.
C. The pages ship as separate files beside the installed file, which reads them from there.

## What I had to decide

The spec says kit defaults "travel inside the bundled `omni.mjs`", and s2's "done when" asks that "from source and from the committed bundle, the same loader returns the same template text". But no command reads a template until s3's `omni kb`, so esbuild would leave the loader out of a bundle built from `kit/bin/omni.mjs`, which is not s2's territory. The plan asks that `kit/build.mjs` keep PRD 39's bundle marker and pinned working directory; it does not say whether the bundle may export more than `main`.

## What I did meanwhile

`kit/build.mjs` now builds from a one-line virtual entry (esbuild `stdin`) that keeps the hashbang, re-exports `kit/bin/omni.mjs`, and exports `formTemplate` and `frontDoorTemplate` from `kit/lib/playbook/templates.mjs` beside `main`. It defines `__OMNI_TEMPLATES__` as the JSON of `readTemplates()`, the loader's own reader, as a string parsed once (an object define would add an initialiser to every bundled module). `__OMNI_BUNDLE__` and `absWorkingDir` are unchanged. Test: "from source and from kit/dist/omni.mjs alone, the same loader returns the same text" in `kit/lib/playbook/templates.test.mjs`, which copies the committed bundle alone into a temporary folder and imports it with plain Node.

## What it costs to change later

A constant: dropping the two exports is one line of `kit/build.mjs` and a rebuild, once s3's `omni kb show` can prove the same thing through a command; that test would then move to it. Nothing stored depends on the exports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the committed bundle's exports are meant to stay `main` alone: PRD 39's tests assert its hashbang, its usage line and that it equals a fresh build, and nothing about its exports.
