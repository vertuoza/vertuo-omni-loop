---
id: s3-01-vercel-ignore-bundle-fallback
prd: 675
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Vercel decides whether to skip a preview before it installs anything, and this repository's own omni tool needs its installed packages to run. How should the skip step read the branch rule then?

## The decision, in plain words

The skip step tries the repository's own omni first and, when that cannot run, falls back to the ready-made single-file copy of the kit kept in the repository. If neither can read the rule, the preview is built as usual.

## The intro, for fun

The bouncer checks the guest list before the lights are even on.

## The punchline, for fun

So it keeps a pocket copy of the list, just in case.

## The options, in plain words

A. Try the repository's omni, then the kit's single-file copy; build when both fail
B. Use the repository's omni only; previews are built whenever it cannot run before install
C. Hard-code the phase-0 branch prefix in the script, as the test workflow does

## What I had to decide

Whether the skip step may read the branch rule through the kit's single-file copy when the repository's own omni cannot run before install.

## What I did meanwhile

scripts/vercel-ignore.sh tries .omni-loop/bin/omni.mjs, then kit/dist/omni.mjs; if both fail it builds.

## What it costs to change later

One line in the script: drop the fallback, or replace it with a literal branch prefix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not yet seen on a real Vercel build whether node_modules is ever restored from the build cache before the ignore step (author)
